import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { findOwnerAdminUser } from "@/lib/auth";
import {
  ADMIN_SESSION_COOKIE,
  createAdminSession,
  getAdminSessionCookieOptions,
} from "@/lib/security/admin-session";
import {
  clearLoginThrottle,
  getLoginIdentity,
  getLoginThrottle,
  registerInvalidLogin,
} from "@/lib/security/login-rate-limit";
import { normalizeLoginEmail } from "@/lib/security/hmac";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { createRouteSupabaseClient } from "@/lib/supabase/route";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  turnstileToken: z.string().min(1),
});

function getRequestIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function invalidLoginResponse() {
  return NextResponse.json(
    {
      error: "No se pudo iniciar sesión. Verificá los datos e intentá nuevamente.",
    },
    { status: 401 },
  );
}

export async function POST(request: NextRequest) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidLoginResponse();

  const { email, password, turnstileToken } = parsed.data;
  const normalizedEmail = normalizeLoginEmail(email);
  const ipAddress = getRequestIp(request);
  let identity;

  try {
    identity = getLoginIdentity(ipAddress, normalizedEmail);
    const throttle = await getLoginThrottle(identity);
    if (throttle.blocked) return invalidLoginResponse();

    const turnstile = await verifyTurnstile(turnstileToken, ipAddress);
    if (turnstile.configurationError) {
      return NextResponse.json(
        { error: "El inicio de sesión no está disponible temporalmente." },
        { status: 503 },
      );
    }
    if (!turnstile.ok) return invalidLoginResponse();
  } catch {
    return NextResponse.json(
      { error: "El inicio de sesión no está disponible temporalmente." },
      { status: 503 },
    );
  }

  const routeClient = await createRouteSupabaseClient();
  if (!routeClient) {
    return NextResponse.json(
      { error: "El inicio de sesión no está disponible temporalmente." },
      { status: 503 },
    );
  }

  const { data, error } = await routeClient.client.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  // Only known credential failures count. Transport/provider failures do not.
  if (error || !data.user) {
    const isInvalidCredential = Boolean(error && error.status && error.status >= 400 && error.status < 500);
    if (isInvalidCredential) {
      await registerInvalidLogin(identity).catch(() => null);
      return invalidLoginResponse();
    }

    return NextResponse.json(
      { error: "El inicio de sesión no está disponible temporalmente." },
      { status: 503 },
    );
  }

  try {
    const adminUser = await findOwnerAdminUser(data.user.id);
    if (!adminUser) {
      await routeClient.client.auth.signOut();
      await registerInvalidLogin(identity);
      return routeClient.applyAuthCookies(invalidLoginResponse());
    }

    const session = await createAdminSession(adminUser.id);
    await clearLoginThrottle(identity);

    const response = NextResponse.json({ ok: true });
    response.cookies.set(ADMIN_SESSION_COOKIE, session.rawSessionId, getAdminSessionCookieOptions());
    return routeClient.applyAuthCookies(response);
  } catch {
    // A successfully authenticated account never receives panel access when the
    // authorization or session record cannot be created.
    await routeClient.client.auth.signOut().catch(() => undefined);
    return routeClient.applyAuthCookies(
      NextResponse.json(
        { error: "El inicio de sesión no está disponible temporalmente." },
        { status: 503 },
      ),
    );
  }
}

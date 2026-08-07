import "server-only";
import { cookies } from "next/headers";
import { getPrisma } from "@/lib/prisma";
import { createOpaqueSecret, hashSecurityValue } from "@/lib/security/hmac";

export const ADMIN_SESSION_COOKIE = "revuelto_admin_session";
export const ADMIN_SESSION_IDLE_MS = 30 * 60 * 1000;
export const ADMIN_SESSION_MAX_MS = 60 * 60 * 1000;

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/admin",
  maxAge: ADMIN_SESSION_MAX_MS / 1000,
};

export function getAdminSessionCookieOptions() {
  return cookieOptions;
}

export function getNextAdminSessionExpiration(now: Date, absoluteExpiresAt: Date) {
  const idleExpiresAt = new Date(now.getTime() + ADMIN_SESSION_IDLE_MS);
  return idleExpiresAt < absoluteExpiresAt ? idleExpiresAt : absoluteExpiresAt;
}

export async function createAdminSession(adminUserId: string) {
  const rawSessionId = createOpaqueSecret();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ADMIN_SESSION_IDLE_MS);
  const absoluteExpiresAt = new Date(now.getTime() + ADMIN_SESSION_MAX_MS);

  await getPrisma().adminSessionActivity.create({
    data: {
      adminUserId,
      sessionHash: hashSecurityValue("admin-session", rawSessionId),
      lastActivityAt: now,
      expiresAt,
      absoluteExpiresAt,
    },
  });

  return { rawSessionId, expiresAt, absoluteExpiresAt };
}

export async function getActiveAdminSession(adminUserId: string) {
  const cookieStore = await cookies();
  const rawSessionId = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!rawSessionId) return null;

  const sessionHash = hashSecurityValue("admin-session", rawSessionId);
  const session = await getPrisma().adminSessionActivity.findUnique({
    where: { sessionHash },
    select: { id: true, adminUserId: true, expiresAt: true, absoluteExpiresAt: true },
  });

  const now = new Date();
  if (
    !session ||
    session.adminUserId !== adminUserId ||
    session.expiresAt <= now ||
    session.absoluteExpiresAt <= now
  ) {
    return null;
  }

  return { id: session.id, sessionHash, absoluteExpiresAt: session.absoluteExpiresAt };
}

export async function recordAdminActivity(adminUserId: string) {
  const activeSession = await getActiveAdminSession(adminUserId);
  if (!activeSession) return false;

  const now = new Date();
  const expiresAt = getNextAdminSessionExpiration(now, activeSession.absoluteExpiresAt);
  await getPrisma().adminSessionActivity.update({
    where: { id: activeSession.id },
    data: {
      lastActivityAt: now,
      expiresAt,
    },
  });

  return true;
}

export async function deleteCurrentAdminSession() {
  const cookieStore = await cookies();
  const rawSessionId = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!rawSessionId) return;

  await getPrisma().adminSessionActivity.deleteMany({
    where: { sessionHash: hashSecurityValue("admin-session", rawSessionId) },
  });
}

import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, deleteCurrentAdminSession, getAdminSessionCookieOptions } from "@/lib/security/admin-session";
import { createRouteSupabaseClient } from "@/lib/supabase/route";

export async function POST() {
  const routeClient = await createRouteSupabaseClient();

  await deleteCurrentAdminSession().catch(() => undefined);
  if (routeClient) await routeClient.client.auth.signOut().catch(() => undefined);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    ...getAdminSessionCookieOptions(),
    maxAge: 0,
  });
  return routeClient ? routeClient.applyAuthCookies(response) : response;
}

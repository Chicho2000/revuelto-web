import { NextResponse } from "next/server";
import { recordAdminActivity } from "@/lib/security/admin-session";
import { getOwnerRouteAuthorization } from "@/lib/security/owner-route";
import { reportUnexpectedServerError } from "@/lib/observability/server-errors";

export async function POST() {
  const authorization = await getOwnerRouteAuthorization();
  if (authorization.response) return authorization.response;
  const { access } = authorization;

  let updated: boolean;
  try {
    updated = await recordAdminActivity(access.adminUser.id);
  } catch (error) {
    reportUnexpectedServerError("session.activity", error);
    return NextResponse.json({ error: "Ocurrió un error. Intentá nuevamente." }, { status: 500 });
  }
  if (!updated) return NextResponse.json({ error: "Sesión administrativa inválida." }, { status: 403 });

  return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}

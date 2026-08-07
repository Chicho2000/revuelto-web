import { NextResponse } from "next/server";
import { getOwnerAccess } from "@/lib/auth";
import { recordAdminActivity } from "@/lib/security/admin-session";

export async function POST() {
  const access = await getOwnerAccess();
  if (access.status !== "owner") return NextResponse.json({ error: "Sesión expirada." }, { status: 401 });

  const updated = await recordAdminActivity(access.adminUser.id);
  if (!updated) return NextResponse.json({ error: "Sesión expirada." }, { status: 401 });

  return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}

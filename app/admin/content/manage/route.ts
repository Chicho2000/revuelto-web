import { NextRequest, NextResponse } from "next/server";
import { siteContentFormSchema } from "@/lib/content/schema";
import { updateSiteContent } from "@/lib/content/service";
import { reportUnexpectedServerError } from "@/lib/observability/server-errors";
import { getOwnerRouteAuthorization } from "@/lib/security/owner-route";

export async function PUT(request: NextRequest) {
  const authorization = await getOwnerRouteAuthorization();
  if (authorization.response) return authorization.response;

  const parsed = siteContentFormSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Revisá los datos del contenido.", fields: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    await updateSiteContent(parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const migrationMissing = typeof error === "object" && error !== null && "code" in error && error.code === "P2022";
    if (!migrationMissing) reportUnexpectedServerError("content.update", error);
    return NextResponse.json(
      { error: migrationMissing ? "Falta aplicar la migración de contenido y galería." : "No se pudieron guardar los cambios." },
      { status: migrationMissing ? 503 : 500 },
    );
  }
}

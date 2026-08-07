import { NextRequest, NextResponse } from "next/server";
import { getOwnerAccess } from "@/lib/auth";
import { siteContentFormSchema } from "@/lib/content/schema";
import { updateSiteContent } from "@/lib/content/service";

export async function PUT(request: NextRequest) {
  const access = await getOwnerAccess();
  if (access.status !== "owner") return NextResponse.json({ error: "No autorizado." }, { status: 401 });

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
    console.error("No se pudo actualizar el contenido general.", error);
    const migrationMissing = typeof error === "object" && error !== null && "code" in error && error.code === "P2022";
    return NextResponse.json(
      { error: migrationMissing ? "Falta aplicar la migración de contenido y galería." : "No se pudieron guardar los cambios." },
      { status: migrationMissing ? 503 : 500 },
    );
  }
}

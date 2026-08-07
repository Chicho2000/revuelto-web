import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { TemporaryImageTarget } from "@/generated/prisma/client";
import { getOwnerAccess } from "@/lib/auth";
import { createTemporaryImageUpload } from "@/lib/images/temporary-images";

const intentSchema = z.object({ target: z.nativeEnum(TemporaryImageTarget) });

export async function POST(request: NextRequest) {
  const access = await getOwnerAccess();
  if (access.status !== "owner") return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const parsed = intentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Destino de imagen inválido." }, { status: 400 });

  try {
    const upload = await createTemporaryImageUpload(access.adminUser.id, parsed.data.target);
    return NextResponse.json({ imageId: upload.id, uploadUrl: upload.signedUrl, expiresAt: upload.expiresAt.toISOString() });
  } catch {
    return NextResponse.json({ error: "No se pudo preparar la subida." }, { status: 503 });
  }
}

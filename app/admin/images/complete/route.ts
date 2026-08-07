import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOwnerAccess } from "@/lib/auth";
import { InvalidImageError } from "@/lib/images/image-processing";
import { completeTemporaryImage } from "@/lib/images/temporary-images";

const completeSchema = z.object({ imageId: z.string().uuid() });

export async function POST(request: NextRequest) {
  const access = await getOwnerAccess();
  if (access.status !== "owner") return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const parsed = completeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Imagen inválida." }, { status: 400 });

  try {
    return NextResponse.json(await completeTemporaryImage(access.adminUser.id, parsed.data.imageId));
  } catch (error) {
    const status = error instanceof InvalidImageError ? 400 : 503;
    return NextResponse.json({ error: "No se pudo procesar la imagen." }, { status });
  }
}

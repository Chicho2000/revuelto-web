import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ImageTooLargeError, InvalidImageError } from "@/lib/images/image-processing";
import { completeTemporaryImage } from "@/lib/images/temporary-images";
import { reportUnexpectedServerError } from "@/lib/observability/server-errors";
import { getOwnerRouteAuthorization } from "@/lib/security/owner-route";

const completeSchema = z.object({ imageId: z.string().uuid() });

export async function POST(request: NextRequest) {
  const authorization = await getOwnerRouteAuthorization();
  if (authorization.response) return authorization.response;
  const { access } = authorization;
  const parsed = completeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Imagen inválida." }, { status: 400 });

  try {
    return NextResponse.json(await completeTemporaryImage(access.adminUser.id, parsed.data.imageId));
  } catch (error) {
    if (error instanceof ImageTooLargeError) {
      return NextResponse.json({ error: "La imagen supera el límite de 5 MB." }, { status: 413 });
    }
    if (error instanceof InvalidImageError) {
      return NextResponse.json({ error: "La imagen no cumple los requisitos permitidos." }, { status: 400 });
    }
    reportUnexpectedServerError("images.complete", error);
    return NextResponse.json({ error: "Ocurrió un error. Intentá nuevamente." }, { status: 500 });
  }
}

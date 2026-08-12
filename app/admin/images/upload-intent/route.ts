import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { TemporaryImageTarget } from "@/generated/prisma/client";
import { UploadRateLimitError, createTemporaryImageUpload } from "@/lib/images/temporary-images";
import { reportUnexpectedServerError } from "@/lib/observability/server-errors";
import { getOwnerRouteAuthorization } from "@/lib/security/owner-route";

const intentSchema = z.object({ target: z.nativeEnum(TemporaryImageTarget) }).strict();

export async function POST(request: NextRequest) {
  const authorization = await getOwnerRouteAuthorization();
  if (authorization.response) return authorization.response;
  const { access } = authorization;

  const parsed = intentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Destino de imagen inválido." }, { status: 400 });

  try {
    const upload = await createTemporaryImageUpload(access.adminUser.id, parsed.data.target);
    return NextResponse.json({ imageId: upload.id, uploadUrl: upload.signedUrl, expiresAt: upload.expiresAt.toISOString() });
  } catch (error) {
    if (error instanceof UploadRateLimitError) {
      return NextResponse.json(
        { error: "Esperá unos minutos antes de preparar más imágenes." },
        { status: 429, headers: { "retry-after": "600" } },
      );
    }
    reportUnexpectedServerError("images.upload-intent", error);
    return NextResponse.json({ error: "Ocurrió un error. Intentá nuevamente." }, { status: 500 });
  }
}

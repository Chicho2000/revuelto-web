import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { discardTemporaryImage } from "@/lib/images/temporary-images";
import { reportUnexpectedServerError } from "@/lib/observability/server-errors";
import { getOwnerRouteAuthorization } from "@/lib/security/owner-route";

const discardSchema = z.object({ imageId: z.string().uuid() }).strict();

export async function POST(request: NextRequest) {
  const authorization = await getOwnerRouteAuthorization();
  if (authorization.response) return authorization.response;
  const { access } = authorization;

  const parsed = discardSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Imagen inválida." }, { status: 400 });
  }

  try {
    await discardTemporaryImage(access.adminUser.id, parsed.data.imageId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    reportUnexpectedServerError("images.discard", error);
    return NextResponse.json({ error: "Ocurrió un error. Intentá nuevamente." }, { status: 500 });
  }
}

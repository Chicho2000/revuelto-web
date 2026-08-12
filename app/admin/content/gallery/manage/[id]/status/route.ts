import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { galleryItemStatusSchema, getGalleryMutationError } from "@/lib/gallery/schema";
import { setGalleryItemActive } from "@/lib/gallery/service";
import { mutationErrorResponse } from "@/lib/observability/route-errors";
import { getOwnerRouteAuthorization } from "@/lib/security/owner-route";

const galleryItemIdSchema = z.string().uuid();

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await getOwnerRouteAuthorization();
  if (authorization.response) return authorization.response;
  const { id } = await params;
  const parsed = galleryItemStatusSchema.safeParse(await request.json().catch(() => null));
  if (!galleryItemIdSchema.safeParse(id).success || !parsed.success) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  try {
    await setGalleryItemActive(id, parsed.data.isActive);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return mutationErrorResponse("gallery.status", error, getGalleryMutationError);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  galleryItemFormSchema,
  galleryItemInputFromForm,
  getGalleryMutationError,
} from "@/lib/gallery/schema";
import { updateGalleryItem } from "@/lib/gallery/service";
import { mutationErrorResponse } from "@/lib/observability/route-errors";
import { getOwnerRouteAuthorization } from "@/lib/security/owner-route";

const galleryItemIdSchema = z.string().uuid();

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await getOwnerRouteAuthorization();
  if (authorization.response) return authorization.response;
  const { access } = authorization;
  const { id } = await params;
  const parsed = galleryItemFormSchema.safeParse(await request.json().catch(() => null));
  if (!galleryItemIdSchema.safeParse(id).success || !parsed.success) {
    return NextResponse.json({ error: "Revisá los datos del elemento." }, { status: 400 });
  }
  try {
    await updateGalleryItem(access.adminUser.id, id, galleryItemInputFromForm(parsed.data));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return mutationErrorResponse("gallery.update", error, getGalleryMutationError);
  }
}

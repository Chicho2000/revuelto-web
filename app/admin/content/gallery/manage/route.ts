import { NextRequest, NextResponse } from "next/server";
import {
  galleryItemCreateSchema,
  galleryItemInputFromForm,
  getGalleryMutationError,
} from "@/lib/gallery/schema";
import { createGalleryItem } from "@/lib/gallery/service";
import { mutationErrorResponse } from "@/lib/observability/route-errors";
import { getOwnerRouteAuthorization } from "@/lib/security/owner-route";

export async function POST(request: NextRequest) {
  const authorization = await getOwnerRouteAuthorization();
  if (authorization.response) return authorization.response;
  const { access } = authorization;
  const parsed = galleryItemCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Revisá los datos y la imagen del elemento.", fields: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  try {
    const item = await createGalleryItem(access.adminUser.id, galleryItemInputFromForm(parsed.data));
    return NextResponse.json({ ok: true, galleryItemId: item.id }, { status: 201 });
  } catch (error) {
    return mutationErrorResponse("gallery.create", error, getGalleryMutationError);
  }
}

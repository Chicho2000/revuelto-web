import { NextRequest, NextResponse } from "next/server";
import { getOwnerAccess } from "@/lib/auth";
import {
  galleryItemCreateSchema,
  galleryItemInputFromForm,
  getGalleryMutationError,
} from "@/lib/gallery/schema";
import { createGalleryItem } from "@/lib/gallery/service";

export async function POST(request: NextRequest) {
  const access = await getOwnerAccess();
  if (access.status !== "owner") return NextResponse.json({ error: "No autorizado." }, { status: 401 });
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
    console.error("No se pudo crear el elemento de galería.", error);
    const mutationError = getGalleryMutationError(error);
    return NextResponse.json({ error: mutationError.message }, { status: mutationError.status });
  }
}

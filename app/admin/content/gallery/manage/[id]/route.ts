import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOwnerAccess } from "@/lib/auth";
import {
  galleryItemFormSchema,
  galleryItemInputFromForm,
  getGalleryMutationError,
} from "@/lib/gallery/schema";
import { updateGalleryItem } from "@/lib/gallery/service";

const galleryItemIdSchema = z.string().uuid();

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getOwnerAccess();
  if (access.status !== "owner") return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { id } = await params;
  const parsed = galleryItemFormSchema.safeParse(await request.json().catch(() => null));
  if (!galleryItemIdSchema.safeParse(id).success || !parsed.success) {
    return NextResponse.json({ error: "Revisá los datos del elemento." }, { status: 400 });
  }
  try {
    await updateGalleryItem(access.adminUser.id, id, galleryItemInputFromForm(parsed.data));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("No se pudo actualizar el elemento de galería.", error);
    const mutationError = getGalleryMutationError(error);
    return NextResponse.json({ error: mutationError.message }, { status: mutationError.status });
  }
}

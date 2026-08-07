import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOwnerAccess } from "@/lib/auth";
import { galleryItemStatusSchema, getGalleryMutationError } from "@/lib/gallery/schema";
import { setGalleryItemActive } from "@/lib/gallery/service";

const galleryItemIdSchema = z.string().uuid();

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getOwnerAccess();
  if (access.status !== "owner") return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { id } = await params;
  const parsed = galleryItemStatusSchema.safeParse(await request.json().catch(() => null));
  if (!galleryItemIdSchema.safeParse(id).success || !parsed.success) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  try {
    await setGalleryItemActive(id, parsed.data.isActive);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const mutationError = getGalleryMutationError(error);
    return NextResponse.json({ error: mutationError.message }, { status: mutationError.status });
  }
}

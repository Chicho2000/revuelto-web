import "server-only";
import { randomUUID } from "node:crypto";
import { TemporaryImageTarget } from "@/generated/prisma/client";
import type { GalleryItemInput } from "@/lib/gallery/schema";
import {
  confirmTemporaryImageFinalization,
  deleteFinalImage,
  discardTemporaryImage,
  prepareTemporaryImageFinalization,
  rollbackPreparedFinalImage,
} from "@/lib/images/temporary-images";
import { runImageMutation } from "@/lib/images/mutation-workflow";
import { getPrisma } from "@/lib/prisma";

function galleryValues(input: GalleryItemInput) {
  return {
    type: input.type,
    title: input.title || null,
    description: input.description || null,
    externalUrl: input.externalUrl || null,
    sortOrder: input.sortOrder,
    isActive: input.isActive,
  };
}

export async function createGalleryItem(ownerId: string, input: GalleryItemInput) {
  const galleryItemId = randomUUID();
  return runImageMutation({
    prepare: () =>
      prepareTemporaryImageFinalization(
        ownerId,
        input.temporaryImageId!,
        galleryItemId,
        TemporaryImageTarget.GALLERY,
      ),
    persist: (prepared) =>
      getPrisma().galleryItem.create({
        data: {
          id: galleryItemId,
          ...galleryValues(input),
          imagePath: prepared!.finalPath,
        },
      }),
    confirm: (prepared) => confirmTemporaryImageFinalization(ownerId, prepared),
    rollback: (prepared) => rollbackPreparedFinalImage(prepared.finalPath),
  });
}

export async function updateGalleryItem(ownerId: string, galleryItemId: string, input: GalleryItemInput) {
  const existing = await getPrisma().galleryItem.findUnique({
    where: { id: galleryItemId },
    select: { id: true, imagePath: true },
  });
  if (!existing) throw Object.assign(new Error("Elemento no encontrado."), { code: "P2025" });

  return runImageMutation({
    prepare: input.temporaryImageId
      ? () =>
          prepareTemporaryImageFinalization(
            ownerId,
            input.temporaryImageId!,
            galleryItemId,
            TemporaryImageTarget.GALLERY,
          )
      : null,
    persist: (prepared) =>
      getPrisma().galleryItem.update({
        where: { id: galleryItemId },
        data: {
          ...galleryValues(input),
          ...(prepared ? { imagePath: prepared.finalPath } : {}),
        },
      }),
    confirm: (prepared) => confirmTemporaryImageFinalization(ownerId, prepared),
    rollback: (prepared) => rollbackPreparedFinalImage(prepared.finalPath),
    deletePrevious: input.temporaryImageId
      ? async () => {
          await deleteFinalImage(existing.imagePath).catch((error) => {
            console.error("No se pudo borrar la imagen anterior de galería.", error);
          });
        }
      : undefined,
  });
}

export async function setGalleryItemActive(galleryItemId: string, isActive: boolean) {
  return getPrisma().galleryItem.update({ where: { id: galleryItemId }, data: { isActive } });
}

export async function cancelTemporaryGalleryImage(ownerId: string, imageId: string) {
  return discardTemporaryImage(ownerId, imageId);
}

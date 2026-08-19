import "server-only";
import { randomUUID } from "node:crypto";
import { TemporaryImageTarget } from "@/generated/prisma/client";
import type { MerchandiseItemInput } from "@/lib/merchandise/schema";
import {
  confirmTemporaryImageFinalization,
  deleteFinalImage,
  discardTemporaryImage,
  prepareTemporaryImageFinalization,
  rollbackPreparedFinalImage,
} from "@/lib/images/temporary-images";
import { runImageMutation } from "@/lib/images/mutation-workflow";
import { reportUnexpectedServerError } from "@/lib/observability/server-errors";
import { getPrisma } from "@/lib/prisma";

function merchandiseValues(input: MerchandiseItemInput) {
  return {
    name: input.name,
    description: input.description || null,
    price: input.price,
    sortOrder: input.sortOrder,
    isActive: input.isActive,
  };
}

export async function createMerchandiseItem(ownerId: string, input: MerchandiseItemInput) {
  const itemId = randomUUID();
  return runImageMutation({
    prepare: () =>
      prepareTemporaryImageFinalization(
        ownerId,
        input.temporaryImageId!,
        itemId,
        TemporaryImageTarget.MERCHANDISE,
      ),
    persist: (prepared) =>
      getPrisma().merchandiseItem.create({
        data: { id: itemId, ...merchandiseValues(input), imagePath: prepared!.finalPath },
      }),
    confirm: (prepared) => confirmTemporaryImageFinalization(ownerId, prepared),
    rollback: (prepared) => rollbackPreparedFinalImage(prepared.finalPath),
  });
}

export async function updateMerchandiseItem(ownerId: string, itemId: string, input: MerchandiseItemInput) {
  const existing = await getPrisma().merchandiseItem.findUnique({
    where: { id: itemId },
    select: { id: true, imagePath: true },
  });
  if (!existing) throw Object.assign(new Error("Producto no encontrado."), { code: "P2025" });

  return runImageMutation({
    prepare: input.temporaryImageId
      ? () =>
          prepareTemporaryImageFinalization(
            ownerId,
            input.temporaryImageId!,
            itemId,
            TemporaryImageTarget.MERCHANDISE,
          )
      : null,
    persist: (prepared) =>
      getPrisma().merchandiseItem.update({
        where: { id: itemId },
        data: { ...merchandiseValues(input), ...(prepared ? { imagePath: prepared.finalPath } : {}) },
      }),
    confirm: (prepared) => confirmTemporaryImageFinalization(ownerId, prepared),
    rollback: (prepared) => rollbackPreparedFinalImage(prepared.finalPath),
    deletePrevious: input.temporaryImageId
      ? async () => {
          await deleteFinalImage(existing.imagePath).catch((error) => {
            reportUnexpectedServerError("merchandise.delete-previous-image", error);
          });
        }
      : undefined,
  });
}

export async function setMerchandiseItemActive(itemId: string, isActive: boolean) {
  return getPrisma().merchandiseItem.update({ where: { id: itemId }, data: { isActive } });
}

export async function cancelTemporaryMerchandiseImage(ownerId: string, imageId: string) {
  return discardTemporaryImage(ownerId, imageId);
}

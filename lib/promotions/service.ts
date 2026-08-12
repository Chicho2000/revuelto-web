import "server-only";
import { randomUUID } from "node:crypto";
import { TemporaryImageTarget } from "@/generated/prisma/client";
import {
  confirmTemporaryImageFinalization,
  deleteFinalImage,
  discardTemporaryImage,
  prepareTemporaryImageFinalization,
  rollbackPreparedFinalImage,
} from "@/lib/images/temporary-images";
import { runImageMutation } from "@/lib/images/mutation-workflow";
import type { PromotionInput } from "@/lib/promotions/schema";
import { cancelPromotionImage } from "@/lib/promotions/workflow";
import { getPrisma } from "@/lib/prisma";
import { reportUnexpectedServerError } from "@/lib/observability/server-errors";

function promotionValues(input: PromotionInput) {
  return {
    title: input.title,
    description: input.body,
    weeklyDays: input.weeklyDays,
    dailyStartTime: input.dailyStartTime || null,
    dailyEndTime: input.dailyEndTime || null,
    isActive: input.isActive,
  };
}

export async function createPromotion(ownerId: string, input: PromotionInput) {
  const promotionId = randomUUID();
  const prisma = getPrisma();
  return runImageMutation({
    prepare: input.temporaryImageId
      ? () =>
          prepareTemporaryImageFinalization(
            ownerId,
            input.temporaryImageId!,
            promotionId,
            TemporaryImageTarget.PROMOTION,
          )
      : null,
    persist: (prepared) =>
      prisma.promotion.create({
        data: {
          id: promotionId,
          ...promotionValues(input),
          imagePath: prepared?.finalPath ?? null,
          imageUrl: prepared?.publicUrl ?? null,
        },
      }),
    confirm: (prepared) => confirmTemporaryImageFinalization(ownerId, prepared),
    rollback: (prepared) => rollbackPreparedFinalImage(prepared.finalPath),
  });
}

export async function updatePromotion(
  ownerId: string,
  promotionId: string,
  input: PromotionInput,
) {
  const prisma = getPrisma();
  const existing = await prisma.promotion.findUnique({
    where: { id: promotionId },
    select: { id: true, imagePath: true },
  });
  if (!existing) throw Object.assign(new Error("Promoción no encontrada."), { code: "P2025" });

  const result = await runImageMutation({
    prepare: input.temporaryImageId
      ? () =>
          prepareTemporaryImageFinalization(
            ownerId,
            input.temporaryImageId!,
            promotionId,
            TemporaryImageTarget.PROMOTION,
          )
      : null,
    persist: (prepared) =>
      prisma.promotion.update({
        where: { id: promotionId },
        data: {
          ...promotionValues(input),
          ...(prepared
            ? { imagePath: prepared.finalPath, imageUrl: prepared.publicUrl }
            : input.removeImage
              ? { imagePath: null, imageUrl: null }
              : {}),
        },
      }),
    confirm: (prepared) => confirmTemporaryImageFinalization(ownerId, prepared),
    rollback: (prepared) => rollbackPreparedFinalImage(prepared.finalPath),
    deletePrevious:
      input.temporaryImageId && existing.imagePath
        ? async () => {
            await deleteFinalImage(existing.imagePath!).catch((error) => {
              reportUnexpectedServerError("promotions.delete-previous-image", error);
            });
          }
        : undefined,
  });

  if (input.removeImage && !input.temporaryImageId && existing.imagePath) {
    await deleteFinalImage(existing.imagePath).catch((error) => {
      reportUnexpectedServerError("promotions.delete-removed-image", error);
    });
  }
  return result;
}

export async function setPromotionActive(promotionId: string, isActive: boolean) {
  return getPrisma().promotion.update({
    where: { id: promotionId },
    data: { isActive },
  });
}

export async function cancelTemporaryPromotionImage(ownerId: string, imageId: string) {
  return cancelPromotionImage(imageId, (id) => discardTemporaryImage(ownerId, id));
}

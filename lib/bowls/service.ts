import "server-only";
import { randomUUID } from "node:crypto";
import { BowlSizeType, TemporaryImageTarget } from "@/generated/prisma/client";
import type { BowlInput } from "@/lib/bowls/schema";
import { cancelBowlImage, runBowlImageMutation } from "@/lib/bowls/workflow";
import {
  confirmTemporaryImageFinalization,
  deleteFinalImage,
  discardTemporaryImage,
  prepareTemporaryImageFinalization,
  rollbackPreparedFinalImage,
} from "@/lib/images/temporary-images";
import { getPrisma } from "@/lib/prisma";
import { reportUnexpectedServerError } from "@/lib/observability/server-errors";

const sizeDefaults = {
  SMALL: { ounces: 25, eggQuantity: 3 },
  LARGE: { ounces: 35, eggQuantity: 5 },
} as const;

export function buildBowlValues(input: BowlInput) {
  return {
    name: input.name,
    slug: input.slug,
    shortDescription: (input.description || input.name).slice(0, 180),
    description: input.description,
    isAvailable: input.isActive,
  };
}

function sizeValues(input: BowlInput, size: BowlSizeType) {
  const defaults = sizeDefaults[size];
  return {
    size,
    ounces: defaults.ounces,
    eggQuantity: defaults.eggQuantity,
    price: input.sizes[size].price,
    isAvailable: true,
  };
}

export async function createBowl(ownerId: string, input: BowlInput) {
  const prisma = getPrisma();
  const bowlId = randomUUID();

  return runBowlImageMutation({
    prepare: input.temporaryImageId
      ? () =>
          prepareTemporaryImageFinalization(
            ownerId,
            input.temporaryImageId!,
            bowlId,
            TemporaryImageTarget.BOWL,
          )
      : null,
    persist: (prepared) =>
      prisma.bowl.create({
        data: {
          id: bowlId,
          ...buildBowlValues(input),
          imagePath: prepared?.finalPath ?? null,
          imageUrl: prepared?.publicUrl ?? null,
          // Prisma ejecuta el create anidado de Bowl + ambos BowlSize como una
          // única transacción atómica, sin requerir una transacción interactiva.
          sizes: {
            create: [
              sizeValues(input, BowlSizeType.SMALL),
              sizeValues(input, BowlSizeType.LARGE),
            ],
          },
        },
        include: { sizes: true },
      }),
    confirm: (prepared) => confirmTemporaryImageFinalization(ownerId, prepared),
    rollback: (prepared) => rollbackPreparedFinalImage(prepared.finalPath),
  });
}

export async function updateBowl(ownerId: string, bowlId: string, input: BowlInput) {
  const prisma = getPrisma();
  const existing = await prisma.bowl.findUnique({
    where: { id: bowlId },
    select: { id: true, imagePath: true },
  });
  if (!existing) throw Object.assign(new Error("Bowl no encontrado."), { code: "P2025" });

  return runBowlImageMutation({
    prepare: input.temporaryImageId
      ? () =>
          prepareTemporaryImageFinalization(
            ownerId,
            input.temporaryImageId!,
            bowlId,
            TemporaryImageTarget.BOWL,
          )
      : null,
    persist: (prepared) =>
      prisma.bowl.update({
        where: { id: bowlId },
        data: {
          ...buildBowlValues(input),
          ...(prepared
            ? { imagePath: prepared.finalPath, imageUrl: prepared.publicUrl }
            : {}),
          // El upsert anidado comparte la transacción del update del Bowl.
          // No reemplaza eggQuantity ni quantityNotes existentes al editar.
          sizes: {
            upsert: [BowlSizeType.SMALL, BowlSizeType.LARGE].map((size) => {
              const values = sizeValues(input, size);
              return {
                where: { bowlId_size: { bowlId, size } },
                create: values,
                update: {
                  ounces: values.ounces,
                  price: values.price,
                },
              };
            }),
          },
        },
        include: { sizes: true },
      }),
    confirm: (prepared) => confirmTemporaryImageFinalization(ownerId, prepared),
    rollback: (prepared) => rollbackPreparedFinalImage(prepared.finalPath),
    deletePrevious:
      input.temporaryImageId && existing.imagePath
        ? async () => {
            await deleteFinalImage(existing.imagePath!).catch((error) => {
              reportUnexpectedServerError("bowls.delete-previous-image", error);
            });
          }
        : undefined,
  });
}

export async function setBowlActive(bowlId: string, isActive: boolean) {
  return getPrisma().bowl.update({
    where: { id: bowlId },
    data: { isAvailable: isActive },
  });
}

export async function deleteBowl(bowlId: string, confirmation: string) {
  const prisma = getPrisma();
  const bowl = await prisma.bowl.findUnique({
    where: { id: bowlId },
    select: { id: true, name: true, imagePath: true },
  });

  if (!bowl) throw Object.assign(new Error("Bowl no encontrado."), { code: "P2025" });
  if (confirmation !== bowl.name) {
    throw Object.assign(new Error("La confirmación no coincide."), { code: "CONFIRMATION_MISMATCH" });
  }

  await prisma.bowl.delete({ where: { id: bowl.id } });

  if (bowl.imagePath) {
    await deleteFinalImage(bowl.imagePath).catch((error) => {
      reportUnexpectedServerError("bowls.delete-final-image", error);
    });
  }
}

export async function cancelTemporaryBowlImage(ownerId: string, imageId: string) {
  return cancelBowlImage(imageId, (id) => discardTemporaryImage(ownerId, id));
}

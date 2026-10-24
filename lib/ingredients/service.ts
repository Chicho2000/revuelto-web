import "server-only";
import { randomUUID } from "node:crypto";
import { TemporaryImageTarget } from "@/generated/prisma/client";
import type { IngredientInput } from "@/lib/ingredients/schema";
import {
  confirmTemporaryImageFinalization,
  deleteFinalImage,
  prepareTemporaryImageFinalization,
  rollbackPreparedFinalImage,
} from "@/lib/images/temporary-images";
import { runImageMutation } from "@/lib/images/mutation-workflow";
import { reportUnexpectedServerError } from "@/lib/observability/server-errors";
import { getPrisma } from "@/lib/prisma";

function ingredientSlug(name: string, id: string) {
  const base = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
  return `${base || "ingrediente"}-${id}`;
}

export async function createIngredient(ownerId: string, input: IngredientInput) {
  const id = randomUUID();
  return runImageMutation({
    prepare: input.temporaryImageId
      ? () => prepareTemporaryImageFinalization(ownerId, input.temporaryImageId!, id, TemporaryImageTarget.INGREDIENT)
      : null,
    persist: (prepared) => getPrisma().ingredient.create({
      data: {
        id,
        slug: ingredientSlug(input.name, id),
        name: input.name,
        category: input.category,
        isActive: input.isActive,
        imagePath: prepared?.finalPath ?? null,
      },
    }),
    confirm: (prepared) => confirmTemporaryImageFinalization(ownerId, prepared),
    rollback: (prepared) => rollbackPreparedFinalImage(prepared.finalPath),
  });
}

export async function updateIngredient(ownerId: string, id: string, input: IngredientInput) {
  const existing = await getPrisma().ingredient.findUnique({ where: { id }, select: { imagePath: true } });
  if (!existing) throw Object.assign(new Error("Ingrediente no encontrado."), { code: "P2025" });

  return runImageMutation({
    prepare: input.temporaryImageId
      ? () => prepareTemporaryImageFinalization(ownerId, input.temporaryImageId!, id, TemporaryImageTarget.INGREDIENT)
      : null,
    persist: (prepared) => getPrisma().ingredient.update({
      where: { id },
      data: {
        name: input.name,
        category: input.category,
        isActive: input.isActive,
        ...(prepared ? { imagePath: prepared.finalPath } : input.removeImage ? { imagePath: null } : {}),
      },
    }),
    confirm: (prepared) => confirmTemporaryImageFinalization(ownerId, prepared),
    rollback: (prepared) => rollbackPreparedFinalImage(prepared.finalPath),
    deletePrevious: (input.temporaryImageId || input.removeImage) && existing.imagePath
      ? async () => {
          await deleteFinalImage(existing.imagePath!).catch((error) => {
            reportUnexpectedServerError("ingredients.delete-previous-image", error);
          });
        }
      : undefined,
  });
}

export async function setIngredientActive(id: string, isActive: boolean) {
  return getPrisma().ingredient.update({ where: { id }, data: { isActive } });
}

import "server-only";
import { randomUUID } from "node:crypto";
import { IngredientCategory, TemporaryImageTarget } from "@/generated/prisma/client";
import type { RevueltoInput } from "@/lib/revueltos/schema";
import {
  confirmTemporaryImageFinalization,
  deleteFinalImage,
  prepareTemporaryImageFinalization,
  rollbackPreparedFinalImage,
} from "@/lib/images/temporary-images";
import { runImageMutation } from "@/lib/images/mutation-workflow";
import { reportUnexpectedServerError } from "@/lib/observability/server-errors";
import { getPrisma } from "@/lib/prisma";

const customGroups = [
  { code: "protein", category: IngredientCategory.PROTEIN, min: 1, max: 1 },
  { code: "vegetables", category: IngredientCategory.VEGETABLE, min: 0, max: 4 },
  { code: "seed-nut", category: IngredientCategory.SEED_NUT, min: 1, max: 1 },
  { code: "sauce", category: IngredientCategory.SAUCE, min: 1, max: 1 },
] as const;

function newMenuSlug(name: string, id: string) {
  const base = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
  return `${base || "revuelto"}-${id}`;
}

function inputError(message: string): never {
  throw new Error(`RECIPE_${message}`);
}

async function validateRecipe(input: RevueltoInput) {
  if (input.menuCategory === "BEBIDA") {
    if (input.recipeIngredients.length || input.choiceGroups.length || input.drinkOptions.length === 1) inputError("Las bebidas admiten ninguna opción o al menos dos variantes propias.");
    return;
  }
  if (input.drinkOptions.length || (input.menuCategory !== "REVUELTO" && input.choiceGroups.length)) inputError("Esta categoría no admite grupos de elección.");
  const ids = [
    ...input.recipeIngredients.map((item) => item.ingredientId),
    ...input.choiceGroups.flatMap((group) => group.options.map((option) => option.ingredientId)),
  ];
  const ingredients = await getPrisma().ingredient.findMany({
    where: { id: { in: [...new Set(ids)] } },
    select: { id: true, category: true },
  });
  const byId = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
  if (byId.size !== new Set(ids).size) inputError("Uno de los ingredientes ya no existe.");

  const baseIngredients = input.recipeIngredients.filter((item) => byId.get(item.ingredientId)?.category === IngredientCategory.BASE);
  if (input.menuCategory === "SANGUCHITO") return;
  if (baseIngredients.length !== 1) {
    inputError("Cada Revuelto debe tener una única base obligatoria.");
  }
  if (baseIngredients[0]?.isRemovable) {
    inputError("Los ingredientes de base no se pueden quitar.");
  }

  const groupsByCode = new Map(input.choiceGroups.map((group) => [group.code, group]));
  for (const group of input.choiceGroups) {
    if (group.options.some((option) => byId.get(option.ingredientId)?.category !== group.category)) {
      inputError("Cada opción debe pertenecer a la categoría de su grupo.");
    }
  }

  if (input.menuCategory === "REVUELTITO") {
    if (input.kind !== "FIXED") inputError("Los Revueltitos tienen una receta definida.");
    return;
  }

  if (input.kind === "FIXED") {
    if (input.choiceGroups.length === 0) return;
    const breakfast = groupsByCode.get("breakfast-protein");
    if (!breakfast || input.choiceGroups.length !== 1 || breakfast.category !== IngredientCategory.PROTEIN || breakfast.minSelections !== 1 || breakfast.maxSelections !== 1 || breakfast.options.length !== 2) {
      inputError("La elección de Buenos días, buenas tardes debe tener dos proteínas y exigir exactamente una.");
    }
    if (breakfast.options.some((option) => input.recipeIngredients.some((item) => item.ingredientId === option.ingredientId))) {
      inputError("Las opciones obligatorias no deben duplicarse en la receta fija.");
    }
    return;
  }

  if (input.choiceGroups.length !== customGroups.length || input.recipeIngredients.some((item) => byId.get(item.ingredientId)?.category !== IngredientCategory.BASE)) {
    inputError("Tu Revuelto requiere su base y los cuatro grupos de elección definidos.");
  }
  for (const expected of customGroups) {
    const group = groupsByCode.get(expected.code);
    if (!group || group.category !== expected.category || group.minSelections !== expected.min || group.maxSelections !== expected.max) {
      inputError("Tu Revuelto debe respetar los límites de proteína, vegetales, semillas/frutos secos y salsa.");
    }
  }
}

function recipeCreates(input: RevueltoInput) {
  return {
    recipeIngredients: input.recipeIngredients.map((item) => ({
      ingredientId: item.ingredientId,
      sortOrder: item.sortOrder,
      isRemovable: item.isRemovable,
    })),
    choiceGroups: input.choiceGroups.map((group) => ({
        code: group.code,
        label: group.label,
        category: group.category,
        minSelections: group.minSelections,
        maxSelections: group.maxSelections,
        sortOrder: group.sortOrder,
        options: {
          create: group.options.map((option) => ({ ingredientId: option.ingredientId, sortOrder: option.sortOrder })),
        },
      })),
    drinkOptions: input.drinkOptions.map((option) => ({ name: option.name, sortOrder: option.sortOrder })),
  };
}

function revueltoBaseData(input: RevueltoInput) {
  return {
    name: input.name,
    menuCategory: input.menuCategory,
    kind: input.kind,
    price: input.price,
    comboPrice: input.comboPrice,
    shortDescription: input.description.slice(0, 180),
    description: input.description,
    displayOrder: input.displayOrder,
    isVisibleInNewMenu: input.isVisibleInNewMenu,
  };
}

function recipeCreateData(input: RevueltoInput) {
  const creates = recipeCreates(input);
  return {
    recipeIngredients: { create: creates.recipeIngredients },
    choiceGroups: { create: creates.choiceGroups },
    drinkOptions: { create: creates.drinkOptions },
  };
}

function recipeUpdateData(input: RevueltoInput) {
  const creates = recipeCreates(input);
  return {
    recipeIngredients: { deleteMany: {}, create: creates.recipeIngredients },
    choiceGroups: { deleteMany: {}, create: creates.choiceGroups },
    drinkOptions: { deleteMany: {}, create: creates.drinkOptions },
  };
}

export async function createRevuelto(ownerId: string, input: RevueltoInput) {
  await validateRecipe(input);
  const id = randomUUID();
  return runImageMutation({
    prepare: input.temporaryImageId
      ? () => prepareTemporaryImageFinalization(ownerId, input.temporaryImageId!, id, TemporaryImageTarget.BOWL)
      : null,
    persist: (prepared) => getPrisma().bowl.create({
      data: {
        id,
        slug: newMenuSlug(input.name, id),
        // New Revueltos must not enter the legacy 25/35 oz public menu.
        isAvailable: false,
        imagePath: prepared?.finalPath ?? null,
        imageUrl: prepared?.publicUrl ?? null,
        ...revueltoBaseData(input),
        ...recipeCreateData(input),
      },
    }),
    confirm: (prepared) => confirmTemporaryImageFinalization(ownerId, prepared),
    rollback: (prepared) => rollbackPreparedFinalImage(prepared.finalPath),
  });
}

export async function updateRevuelto(ownerId: string, id: string, input: RevueltoInput) {
  await validateRecipe(input);
  const existing = await getPrisma().bowl.findUnique({ where: { id }, select: { imagePath: true } });
  if (!existing) throw Object.assign(new Error("Revuelto no encontrado."), { code: "P2025" });

  return runImageMutation({
    prepare: input.temporaryImageId
      ? () => prepareTemporaryImageFinalization(ownerId, input.temporaryImageId!, id, TemporaryImageTarget.BOWL)
      : null,
    persist: (prepared) => getPrisma().bowl.update({
      where: { id },
      data: {
        ...(prepared ? { imagePath: prepared.finalPath, imageUrl: prepared.publicUrl } : input.removeImage ? { imagePath: null, imageUrl: null } : {}),
        ...revueltoBaseData(input),
        ...recipeUpdateData(input),
      },
    }),
    confirm: (prepared) => confirmTemporaryImageFinalization(ownerId, prepared),
    rollback: (prepared) => rollbackPreparedFinalImage(prepared.finalPath),
    deletePrevious: (input.temporaryImageId || input.removeImage) && existing.imagePath
      ? async () => {
          await deleteFinalImage(existing.imagePath!).catch((error) => {
            reportUnexpectedServerError("revueltos.delete-previous-image", error);
          });
        }
      : undefined,
  });
}

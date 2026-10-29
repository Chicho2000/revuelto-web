import "server-only";
import { randomUUID } from "node:crypto";
import type { IngredientInput } from "@/lib/ingredients/schema";
import { getPrisma } from "@/lib/prisma";

function ingredientSlug(name: string, id: string) {
  const base = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
  return `${base || "ingrediente"}-${id}`;
}

export async function createIngredient(input: IngredientInput) {
  const id = randomUUID();
  return getPrisma().ingredient.create({
    data: {
      id,
      slug: ingredientSlug(input.name, id),
      name: input.name,
      category: input.category,
      isActive: input.isActive,
    },
  });
}

export async function updateIngredient(id: string, input: IngredientInput) {
  return getPrisma().ingredient.update({
    where: { id },
    data: {
      name: input.name,
      category: input.category,
      isActive: input.isActive,
    },
  });
}

export async function setIngredientActive(id: string, isActive: boolean) {
  return getPrisma().ingredient.update({ where: { id }, data: { isActive } });
}

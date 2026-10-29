import assert from "node:assert/strict";
import test from "node:test";
import { revueltoFormSchema } from "../lib/revueltos/schema";

const eggId = "11111111-1111-4111-8111-111111111111";
const proteinId = "22222222-2222-4222-8222-222222222222";

const fixedRevuelto = {
  name: "Horneadito",
  menuCategory: "REVUELTO",
  kind: "FIXED",
  description: "Una receta lista para servir.",
  price: null,
  comboPrice: null,
  displayOrder: 1,
  isVisibleInNewMenu: false,
  recipeIngredients: [{ ingredientId: eggId, sortOrder: 0, isRemovable: false }],
  choiceGroups: [],
  temporaryImageId: null,
  removeImage: false,
};

test("acepta un Revuelto definido en preparación sin precio ni foto", () => {
  const parsed = revueltoFormSchema.parse(fixedRevuelto);
  assert.equal(parsed.name, "Horneadito");
  assert.equal(parsed.price, null);
  assert.equal(parsed.recipeIngredients[0]?.isRemovable, false);
});

test("rechaza ingredientes repetidos y quitar/reemplazar imagen al mismo tiempo", () => {
  assert.equal(revueltoFormSchema.safeParse({
    ...fixedRevuelto,
    recipeIngredients: [...fixedRevuelto.recipeIngredients, { ingredientId: eggId, sortOrder: 1, isRemovable: false }],
  }).success, false);
  assert.equal(revueltoFormSchema.safeParse({
    ...fixedRevuelto,
    temporaryImageId: proteinId,
    removeImage: true,
  }).success, false);
});

test("acepta los grupos tipados que usará Tu Revuelto", () => {
  const parsed = revueltoFormSchema.parse({
    ...fixedRevuelto,
    name: "Tu Revuelto",
    kind: "CUSTOM",
    choiceGroups: [{
      code: "protein",
      label: "Elegí 1 proteína",
      category: "PROTEIN",
      minSelections: 1,
      maxSelections: 1,
      sortOrder: 0,
      options: [{ ingredientId: proteinId, sortOrder: 0 }],
    }],
  });
  assert.equal(parsed.choiceGroups[0]?.code, "protein");
});

test("permite bebidas sin receta y rechaza un combo en otra categoría", () => {
  assert.equal(revueltoFormSchema.safeParse({ ...fixedRevuelto, menuCategory: "BEBIDA", description: "", recipeIngredients: [] }).success, true);
  assert.equal(revueltoFormSchema.safeParse({ ...fixedRevuelto, menuCategory: "SANGUCHITO", comboPrice: 9000 }).success, false);
  assert.equal(revueltoFormSchema.safeParse({ ...fixedRevuelto, menuCategory: "REVUELTITO", price: 7000, comboPrice: 9000 }).success, true);
});

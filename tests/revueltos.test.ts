import assert from "node:assert/strict";
import test from "node:test";
import { revueltoFormSchema } from "../lib/revueltos/schema";
import { toggleIngredientChoice } from "../lib/revueltos/vegetable-choice";

const eggId = "11111111-1111-4111-8111-111111111111";
const proteinId = "22222222-2222-4222-8222-222222222222";
const vegetableId = "33333333-3333-4333-8333-333333333333";
const otherVegetableId = "44444444-4444-4444-8444-444444444444";

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
  drinkOptions: [],
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
  assert.equal(revueltoFormSchema.safeParse({ ...fixedRevuelto, menuCategory: "BEBIDA", recipeIngredients: [], drinkOptions: [{ name: "Naranja", sortOrder: 0 }] }).success, false);
  assert.equal(revueltoFormSchema.safeParse({ ...fixedRevuelto, menuCategory: "BEBIDA", recipeIngredients: [], drinkOptions: [{ name: "Naranja", sortOrder: 0 }, { name: "Manzana", sortOrder: 1 }] }).success, true);
  assert.equal(revueltoFormSchema.safeParse({ ...fixedRevuelto, menuCategory: "BEBIDA", recipeIngredients: [], drinkOptions: [{ name: "Naranja", sortOrder: 0 }, { name: " naranja ", sortOrder: 1 }] }).success, false);
  assert.equal(revueltoFormSchema.safeParse({ ...fixedRevuelto, menuCategory: "SANGUCHITO", comboPrice: 9000 }).success, false);
  assert.equal(revueltoFormSchema.safeParse({ ...fixedRevuelto, menuCategory: "REVUELTITO", price: 7000, comboPrice: 9000 }).success, true);
});

const vegetableGroup = {
  code: "vegetables", label: "Elegí 1 vegetal", category: "VEGETABLE",
  minSelections: 1, maxSelections: 1, sortOrder: 0,
  options: [{ ingredientId: vegetableId, sortOrder: 0 }, { ingredientId: otherVegetableId, sortOrder: 1 }],
};
const vegetableRevueltito = { ...fixedRevuelto, menuCategory: "REVUELTITO", choiceGroups: [vegetableGroup] };

test("el Revueltito permite activar y desactivar la elección de vegetales y configurar la cantidad exacta", () => {
  assert.equal(revueltoFormSchema.safeParse(vegetableRevueltito).success, true);
  assert.equal(revueltoFormSchema.safeParse({ ...vegetableRevueltito, choiceGroups: [] }).success, true);
  assert.equal(revueltoFormSchema.safeParse({ ...vegetableRevueltito, choiceGroups: [{ ...vegetableGroup, minSelections: 2, maxSelections: 2 }] }).success, true);
});

test("rechaza grupos de otra categoría, cantidades inconsistentes y opciones insuficientes en Revueltitos", () => {
  for (const group of [
    { ...vegetableGroup, code: "breakfast-protein", category: "PROTEIN" },
    { ...vegetableGroup, category: "PROTEIN" },
    { ...vegetableGroup, minSelections: 0 },
    { ...vegetableGroup, minSelections: 1, maxSelections: 2 },
    { ...vegetableGroup, minSelections: 3, maxSelections: 3 },
    { ...vegetableGroup, minSelections: 21, maxSelections: 21 },
    { ...vegetableGroup, options: [] },
    { ...vegetableGroup, options: [vegetableGroup.options[0], vegetableGroup.options[0]] },
  ]) assert.equal(revueltoFormSchema.safeParse({ ...vegetableRevueltito, choiceGroups: [group] }).success, false);
});

test("un vegetal a elección no puede duplicarse en la receta fija ni pueden habilitarse otros grupos en el Revueltito", () => {
  assert.equal(revueltoFormSchema.safeParse({ ...vegetableRevueltito, recipeIngredients: [...fixedRevuelto.recipeIngredients, { ingredientId: vegetableId, sortOrder: 1, isRemovable: true }] }).success, false);
  assert.equal(revueltoFormSchema.safeParse({ ...vegetableRevueltito, choiceGroups: [vegetableGroup, { ...vegetableGroup, code: "sauce", category: "SAUCE" }] }).success, false);
});

test("puede cambiar un vegetal único o desmarcar uno de una selección obligatoria múltiple para reemplazarlo", () => {
  assert.deepEqual(toggleIngredientChoice([vegetableId], otherVegetableId, true, 1), [otherVegetableId]);
  const selected = [vegetableId, otherVegetableId];
  assert.deepEqual(toggleIngredientChoice(selected, vegetableId, false, 2), [otherVegetableId]);
  assert.deepEqual(toggleIngredientChoice(selected, proteinId, true, 2), selected);
  assert.deepEqual(toggleIngredientChoice([vegetableId], vegetableId, true, 2), [vegetableId]);
  assert.deepEqual(selected, [vegetableId, otherVegetableId]);
});

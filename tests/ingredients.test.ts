import assert from "node:assert/strict";
import test from "node:test";
import { ingredientFormSchema, ingredientStatusSchema } from "../lib/ingredients/schema";

const imageId = "11111111-1111-4111-8111-111111111111";
const ingredient = {
  name: "Huevos revueltos",
  category: "BASE",
  isActive: true,
};

test("normaliza el nombre de un ingrediente de texto", () => {
  const parsed = ingredientFormSchema.parse({ ...ingredient, name: "  Huevos revueltos  " });
  assert.equal(parsed.name, "Huevos revueltos");
});

test("rechaza categoría inválida, cuerpo extra y campos de imagen", () => {
  assert.equal(ingredientFormSchema.safeParse({ ...ingredient, category: "TOPPING" }).success, false);
  assert.equal(ingredientFormSchema.safeParse({ ...ingredient, price: 100 }).success, false);
  assert.equal(ingredientFormSchema.safeParse({ ...ingredient, temporaryImageId: imageId }).success, false);
  assert.equal(ingredientFormSchema.safeParse({ ...ingredient, removeImage: true }).success, false);
  assert.equal(ingredientStatusSchema.safeParse({ isActive: false }).success, true);
});

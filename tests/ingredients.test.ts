import assert from "node:assert/strict";
import test from "node:test";
import { ingredientFormSchema, ingredientStatusSchema } from "../lib/ingredients/schema";
import { runImageMutation } from "../lib/images/mutation-workflow";

const imageId = "11111111-1111-4111-8111-111111111111";
const ingredient = {
  name: "Huevos revueltos",
  category: "BASE",
  isActive: true,
  temporaryImageId: null,
  removeImage: false,
};

test("permite ingredientes sin imagen y normaliza su nombre", () => {
  const parsed = ingredientFormSchema.parse({ ...ingredient, name: "  Huevos revueltos  " });
  assert.equal(parsed.name, "Huevos revueltos");
  assert.equal(parsed.temporaryImageId, null);
});

test("rechaza categoría inválida, cuerpo extra y quitar y reemplazar imagen juntos", () => {
  assert.equal(ingredientFormSchema.safeParse({ ...ingredient, category: "TOPPING" }).success, false);
  assert.equal(ingredientFormSchema.safeParse({ ...ingredient, price: 100 }).success, false);
  assert.equal(ingredientFormSchema.safeParse({ ...ingredient, temporaryImageId: imageId, removeImage: true }).success, false);
  assert.equal(ingredientStatusSchema.safeParse({ isActive: false }).success, true);
});

test("al quitar la imagen guarda primero y luego elimina el archivo anterior", async () => {
  const calls: string[] = [];
  await runImageMutation({
    prepare: null,
    persist: async () => { calls.push("persist"); },
    confirm: async () => { calls.push("confirm"); },
    rollback: async () => { calls.push("rollback"); },
    deletePrevious: async () => { calls.push("delete-previous"); },
  });
  assert.deepEqual(calls, ["persist", "delete-previous"]);
});

test("un fallo de persistencia conserva la imagen anterior", async () => {
  const calls: string[] = [];
  await assert.rejects(runImageMutation({
    prepare: null,
    persist: async () => { calls.push("persist"); throw new Error("db"); },
    confirm: async () => { calls.push("confirm"); },
    rollback: async () => { calls.push("rollback"); },
    deletePrevious: async () => { calls.push("delete-previous"); },
  }));
  assert.deepEqual(calls, ["persist"]);
});

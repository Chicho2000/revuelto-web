import assert from "node:assert/strict";
import test from "node:test";
import { deletionSchema, getDeletionError, runConfirmedDeletion } from "../lib/admin/deletion";

const inactive = { name: "Foto de Revuelto", active: false, imagePath: "gallery/id/photo.jpg" };

test("el borrado rechaza elementos activos, confirmaciones incorrectas y relaciones sin modificar datos", async () => {
  for (const [entity, confirmation, code] of [
    [{ ...inactive, active: true }, inactive.name, "ENTITY_ACTIVE"],
    [inactive, "foto de Revuelto", "CONFIRMATION_MISMATCH"],
    [inactive, `${inactive.name} `, "CONFIRMATION_MISMATCH"],
    [{ ...inactive, inUse: true }, inactive.name, "ENTITY_IN_USE"],
    [null, inactive.name, "P2025"],
  ] as const) {
    let deletions = 0;
    await assert.rejects(runConfirmedDeletion({ entity, confirmation, remove: async () => { deletions++; return { count: 1 }; } }), { code });
    assert.equal(deletions, 0);
  }
});

test("solo un borrado confirmado devuelve la imagen para su limpieza posterior", async () => {
  let deletions = 0;
  const path = await runConfirmedDeletion({
    entity: inactive, confirmation: inactive.name,
    remove: async () => { deletions++; return { count: 1 }; },
  });
  assert.equal(deletions, 1);
  assert.equal(path, inactive.imagePath);
});

test("una reactivación o edición concurrente impide confirmar el borrado y limpiar la imagen", async () => {
  await assert.rejects(runConfirmedDeletion({
    entity: inactive, confirmation: inactive.name, remove: async () => ({ count: 0 }),
  }), { code: "ENTITY_CHANGED" });
});

test("los errores de base de datos impiden devolver una imagen para borrar", async () => {
  await assert.rejects(runConfirmedDeletion({
    entity: inactive, confirmation: inactive.name,
    remove: async () => { throw Object.assign(new Error("foreign key"), { code: "P2003" }); },
  }), { code: "P2003" });
  assert.equal(getDeletionError({ code: "P2003" }).status, 409);
  assert.equal(getDeletionError({ code: "P2034" }).status, 409);
  assert.equal(getDeletionError(new Error("private database detail")).message, "No se pudo borrar el elemento.");
});

test("sin imagen también se pueden borrar elementos inactivos", async () => {
  assert.equal(await runConfirmedDeletion({ entity: { name: "Ingrediente", active: false }, confirmation: "Ingrediente", remove: async () => ({ count: 1 }) }), null);
});

test("el contrato de borrado exige confirmación y rechaza campos adicionales", () => {
  assert.equal(deletionSchema.safeParse({ confirmation: inactive.name }).success, true);
  assert.equal(deletionSchema.safeParse({ confirmation: "" }).success, false);
  assert.equal(deletionSchema.safeParse({ confirmation: inactive.name, force: true }).success, false);
});

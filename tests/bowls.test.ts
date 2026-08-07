import assert from "node:assert/strict";
import test from "node:test";
import {
  bowlDeleteSchema,
  bowlInputSchema,
  bowlStatusSchema,
  getBowlMutationError,
} from "../lib/bowls/schema";
import { runBowlImageMutation, cancelBowlImage } from "../lib/bowls/workflow";
import { isActiveOwner } from "../lib/security/authorization";

const validBowl = {
  name: "Revuelto verde",
  slug: "revuelto-verde",
  description: "Huevos y vegetales.",
  isActive: true,
  temporaryImageId: null,
  sizes: {
    SMALL: { price: 8500 },
    LARGE: { price: 11000 },
  },
};

test("acepta una creación con SMALL y LARGE", () => {
  const parsed = bowlInputSchema.parse(validBowl);
  assert.equal(parsed.sizes.SMALL.price, 8500);
  assert.equal(parsed.sizes.LARGE.price, 11000);
});

test("rechaza una creación si falta un tamaño", () => {
  const withoutLarge = { ...validBowl, sizes: { SMALL: { price: 8500 } } };
  assert.equal(bowlInputSchema.safeParse(withoutLarge).success, false);
});

test("rechaza precios iguales o menores que cero", () => {
  assert.equal(
    bowlInputSchema.safeParse({
      ...validBowl,
      sizes: { SMALL: { price: 0 }, LARGE: { price: -1 } },
    }).success,
    false,
  );
});

test("traduce un conflicto Prisma de slug a un error comprensible", () => {
  assert.deepEqual(getBowlMutationError({ code: "P2002" }), {
    status: 409,
    message: "Ya existe un bowl con ese slug.",
  });
});

test("informa cuando falta el bucket de imágenes finales", () => {
  assert.deepEqual(getBowlMutationError({ message: "Bucket not found" }), {
    status: 503,
    message: "Falta configurar el bucket público bucket-media para guardar la imagen final.",
  });
});

test("valida edición de nombre, descripción y ambos precios", () => {
  const edited = bowlInputSchema.parse({
    ...validBowl,
    name: "Revuelto fuerte",
    description: "Nueva descripción.",
    sizes: { SMALL: { price: 9000 }, LARGE: { price: 12000 } },
  });
  assert.equal(edited.name, "Revuelto fuerte");
  assert.equal(edited.description, "Nueva descripción.");
  assert.deepEqual(edited.sizes, { SMALL: { price: 9000 }, LARGE: { price: 12000 } });
});

test("acepta activación y desactivación explícitas", () => {
  assert.equal(bowlStatusSchema.parse({ isActive: true }).isActive, true);
  assert.equal(bowlStatusSchema.parse({ isActive: false }).isActive, false);
});

test("requiere una confirmación no vacía para borrar un bowl", () => {
  assert.equal(bowlDeleteSchema.safeParse({ confirmation: "Revuelto verde" }).success, true);
  assert.equal(bowlDeleteSchema.safeParse({ confirmation: "" }).success, false);
});

test("traduce una confirmación de borrado incorrecta", () => {
  assert.deepEqual(getBowlMutationError({ code: "CONFIRMATION_MISMATCH" }), {
    status: 400,
    message: "Escribí exactamente el nombre del bowl para confirmarlo.",
  });
});

test("reemplaza una imagen solo después de persistir y confirmar la nueva", async () => {
  const calls: string[] = [];
  await runBowlImageMutation({
    prepare: async () => {
      calls.push("prepare");
      return { imageId: "image", tempPath: "temp", finalPath: "new", publicUrl: "url" };
    },
    persist: async () => {
      calls.push("persist");
      return true;
    },
    confirm: async () => {
      calls.push("confirm");
    },
    rollback: async () => {
      calls.push("rollback");
    },
    deletePrevious: async () => {
      calls.push("delete-previous");
    },
  });
  assert.deepEqual(calls, ["prepare", "persist", "confirm", "delete-previous"]);
});

test("si falla la confirmación conserva la imagen anterior", async () => {
  let previousDeleted = false;
  await assert.rejects(
    runBowlImageMutation({
      prepare: async () => ({ imageId: "image", tempPath: "temp", finalPath: "new", publicUrl: "url" }),
      persist: async () => true,
      confirm: async () => {
        throw new Error("confirm failed");
      },
      rollback: async () => undefined,
      deletePrevious: async () => {
        previousDeleted = true;
      },
    }),
  );
  assert.equal(previousDeleted, false);
});

test("deniega autorización a no OWNER o inactivo", () => {
  assert.equal(isActiveOwner({ role: "OWNER", isActive: true }), true);
  assert.equal(isActiveOwner({ role: "USER", isActive: true }), false);
  assert.equal(isActiveOwner({ role: "OWNER", isActive: false }), false);
});

test("cancelar descarta la imagen temporal", async () => {
  const discarded: string[] = [];
  await cancelBowlImage("temporary-id", async (id) => {
    discarded.push(id);
  });
  assert.deepEqual(discarded, ["temporary-id"]);
});

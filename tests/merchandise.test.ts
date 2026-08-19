import assert from "node:assert/strict";
import test from "node:test";
import {
  isPublicMerchandiseItem,
  merchandiseItemCreateSchema,
  merchandiseItemFormSchema,
  merchandiseItemStatusSchema,
  sortMerchandiseItems,
} from "../lib/merchandise/schema";
import { cancelMerchandiseImage } from "../lib/merchandise/workflow";
import { runImageMutation } from "../lib/images/mutation-workflow";

const imageId = "11111111-1111-4111-8111-111111111111";
const validItem = {
  name: "Tote bag Revuelto",
  description: "Bolsa reutilizable.",
  price: 12500,
  sortOrder: 2,
  isActive: true,
  temporaryImageId: imageId,
};

test("acepta la creación válida de merchandising con imagen", () => {
  assert.equal(merchandiseItemCreateSchema.safeParse(validItem).success, true);
  assert.equal(merchandiseItemCreateSchema.safeParse({ ...validItem, temporaryImageId: null }).success, false);
});

test("exige precio mayor que cero y rechaza cero o negativos", () => {
  assert.equal(merchandiseItemFormSchema.safeParse(validItem).success, true);
  assert.equal(merchandiseItemFormSchema.safeParse({ ...validItem, price: 0 }).success, false);
  assert.equal(merchandiseItemFormSchema.safeParse({ ...validItem, price: -1 }).success, false);
});

test("acepta edición sin una nueva imagen temporal", () => {
  const edited = merchandiseItemFormSchema.parse({
    ...validItem,
    name: "Pin Revuelto",
    description: "Nuevo texto.",
    price: 4500,
    temporaryImageId: null,
  });
  assert.equal(edited.name, "Pin Revuelto");
  assert.equal(edited.price, 4500);
});

test("valida activación y desactivación", () => {
  assert.equal(merchandiseItemStatusSchema.parse({ isActive: true }).isActive, true);
  assert.equal(merchandiseItemStatusSchema.parse({ isActive: false }).isActive, false);
});

test("ordena merchandising por sortOrder, createdAt e id", () => {
  const sorted = sortMerchandiseItems([
    { id: "b", sortOrder: 2, createdAt: new Date("2026-08-04") },
    { id: "c", sortOrder: 1, createdAt: new Date("2026-08-05") },
    { id: "a", sortOrder: 1, createdAt: new Date("2026-08-04") },
  ]);
  assert.deepEqual(sorted.map((item) => item.id), ["a", "c", "b"]);
});

test("el reemplazo confirma la imagen nueva antes de borrar la anterior", async () => {
  const calls: string[] = [];
  await runImageMutation({
    prepare: async () => ({ imageId: "new", tempPath: "temp", finalPath: "merchandise/id/new.png", publicUrl: "url" }),
    persist: async () => { calls.push("persist"); },
    confirm: async () => { calls.push("confirm"); },
    rollback: async () => { calls.push("rollback"); },
    deletePrevious: async () => { calls.push("delete-previous"); },
  });
  assert.deepEqual(calls, ["persist", "confirm", "delete-previous"]);
});

test("cancelar descarta la imagen temporal de merchandising", async () => {
  const discarded: string[] = [];
  await cancelMerchandiseImage("temporary", async (id) => { discarded.push(id); });
  assert.deepEqual(discarded, ["temporary"]);
});

test("solo publica merchandising activo con imagen", () => {
  const active = { isActive: true, imagePath: "merchandise/id/item.webp" };
  assert.equal(isPublicMerchandiseItem(active), true);
  assert.equal(isPublicMerchandiseItem({ ...active, isActive: false }), false);
  assert.equal(isPublicMerchandiseItem({ ...active, imagePath: "" }), false);
});

test("valida imágenes de merchandising sin transformar y conserva el formato", async () => {
  const sharp = (await import("sharp")).default;
  const { TemporaryImageTarget } = await import("../generated/prisma/client");
  const { validateAndProcessImage } = await import("../lib/images/image-processing");
  const source = await sharp({ create: { width: 900, height: 900, channels: 3, background: "#efe5da" } }).jpeg().toBuffer();
  const result = await validateAndProcessImage(source, TemporaryImageTarget.MERCHANDISE);
  assert.equal(result.buffer.equals(source), true);
  assert.equal(result.format, "jpeg");
  assert.equal(result.width, 900);
  assert.equal(result.height, 900);
});

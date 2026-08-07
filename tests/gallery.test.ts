import assert from "node:assert/strict";
import test from "node:test";
import {
  galleryItemCreateSchema,
  galleryItemFormSchema,
  galleryItemStatusSchema,
  getSafeGalleryLinkProps,
  isPublicGalleryItem,
  normalizeInstagramUrl,
  sortGalleryItems,
} from "../lib/gallery/schema";
import { cancelGalleryImage } from "../lib/gallery/workflow";
import { runImageMutation } from "../lib/images/mutation-workflow";
import {
  getNextGallerySlide,
  getPreviousGallerySlide,
  shouldUseGalleryCarousel,
} from "../lib/gallery/carousel";

const imageId = "11111111-1111-4111-8111-111111111111";
const validImage = {
  type: "IMAGE" as const,
  title: "Equipo Revuelto",
  description: "Después de entrenar.",
  externalUrl: "",
  sortOrder: 2,
  isActive: true,
  temporaryImageId: imageId,
};

test("crea IMAGE válido y exige imagen en el alta", () => {
  assert.equal(galleryItemCreateSchema.safeParse(validImage).success, true);
  assert.equal(galleryItemCreateSchema.safeParse({ ...validImage, temporaryImageId: null }).success, false);
});

test("crea INSTAGRAM_VIDEO válido y normaliza su URL", () => {
  const video = { ...validImage, type: "INSTAGRAM_VIDEO" as const, externalUrl: "https://m.instagram.com/reel/Abc_123/?igsh=tracking" };
  assert.equal(galleryItemCreateSchema.safeParse(video).success, true);
  assert.equal(normalizeInstagramUrl(video.externalUrl), "https://www.instagram.com/reel/Abc_123/");
});

test("rechaza video sin URL, HTTP, dominios falsos, javascript y data", () => {
  const parse = (externalUrl: string) => galleryItemFormSchema.safeParse({ ...validImage, type: "INSTAGRAM_VIDEO", externalUrl }).success;
  assert.equal(parse(""), false);
  assert.equal(parse("http://www.instagram.com/reel/abc/"), false);
  assert.equal(parse("https://instagram.com.evil.test/reel/abc/"), false);
  assert.equal(parse("javascript:alert(1)"), false);
  assert.equal(parse("data:text/html,test"), false);
});

test("ordena por sortOrder, createdAt e id", () => {
  const sorted = sortGalleryItems([
    { id: "b", sortOrder: 2, createdAt: new Date("2026-08-04") },
    { id: "c", sortOrder: 1, createdAt: new Date("2026-08-05") },
    { id: "a", sortOrder: 1, createdAt: new Date("2026-08-04") },
  ]);
  assert.deepEqual(sorted.map((item) => item.id), ["a", "c", "b"]);
});

test("usa carrusel automático desde el cuarto elemento y navega de forma circular", () => {
  assert.equal(shouldUseGalleryCarousel(3), false);
  assert.equal(shouldUseGalleryCarousel(4), true);
  assert.equal(getNextGallerySlide(3, 4), 0);
  assert.equal(getPreviousGallerySlide(0, 4), 3);
});

test("valida activación y desactivación", () => {
  assert.equal(galleryItemStatusSchema.parse({ isActive: true }).isActive, true);
  assert.equal(galleryItemStatusSchema.parse({ isActive: false }).isActive, false);
});

test("el reemplazo confirma la nueva imagen antes de borrar la anterior", async () => {
  const calls: string[] = [];
  await runImageMutation({
    prepare: async () => ({ imageId: "new", tempPath: "temp", finalPath: "gallery/id/new.webp", publicUrl: "url" }),
    persist: async () => { calls.push("persist"); },
    confirm: async () => { calls.push("confirm"); },
    rollback: async () => { calls.push("rollback"); },
    deletePrevious: async () => { calls.push("delete-previous"); },
  });
  assert.deepEqual(calls, ["persist", "confirm", "delete-previous"]);
});

test("cancelar descarta la imagen temporal", async () => {
  const discarded: string[] = [];
  await cancelGalleryImage("temporary", async (id) => { discarded.push(id); });
  assert.deepEqual(discarded, ["temporary"]);
});

test("solo publica elementos activos con imagen y videos con URL válida", () => {
  const base = { type: "IMAGE", imagePath: "gallery/id/image.webp", externalUrl: null, isActive: true };
  assert.equal(isPublicGalleryItem(base), true);
  assert.equal(isPublicGalleryItem({ ...base, isActive: false }), false);
  assert.equal(isPublicGalleryItem({ ...base, imagePath: "" }), false);
  assert.equal(isPublicGalleryItem({ ...base, type: "INSTAGRAM_VIDEO" }), false);
  assert.equal(isPublicGalleryItem({ ...base, type: "INSTAGRAM_VIDEO", externalUrl: "https://www.instagram.com/p/abc/" }), true);
});

test("el enlace externo visible usa nueva pestaña y rel seguro", () => {
  assert.deepEqual(
    getSafeGalleryLinkProps({ type: "INSTAGRAM_VIDEO", externalUrl: "https://instagram.com/reel/abc/?igsh=x" }),
    { href: "https://www.instagram.com/reel/abc/", target: "_blank", rel: "noopener noreferrer" },
  );
});

test("procesa miniaturas de galería como WebP 1600x1200 y respeta 5 MB", async () => {
  const sharp = (await import("sharp")).default;
  const { TemporaryImageTarget } = await import("../generated/prisma/client");
  const { InvalidImageError, validateAndProcessImage } = await import("../lib/images/image-processing");
  const source = await sharp({ create: { width: 2400, height: 1800, channels: 3, background: "#6ebbbe" } }).png().toBuffer();
  const result = await validateAndProcessImage(source, TemporaryImageTarget.GALLERY);
  assert.equal(result.width, 1600);
  assert.equal(result.height, 1200);
  await assert.rejects(validateAndProcessImage(Buffer.alloc(5 * 1024 * 1024 + 1), TemporaryImageTarget.GALLERY), InvalidImageError);
});

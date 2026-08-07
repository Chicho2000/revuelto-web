import assert from "node:assert/strict";
import test from "node:test";
import {
  formatPromotionPublicAvailability,
  formatPromotionWeeklySchedule,
  promotionFormSchema,
  promotionInputFromForm,
  promotionStatusSchema,
  sortPublicPromotions,
} from "../lib/promotions/schema";
import { cancelPromotionImage } from "../lib/promotions/workflow";
import { runImageMutation } from "../lib/images/mutation-workflow";
import { isPublicPromotion } from "../lib/public-visibility";
import { isActiveOwner } from "../lib/security/authorization";

const validPromotion = {
  title: "Promo post entrenamiento",
  body: "Un beneficio para volver.",
  weeklyDays: [],
  dailyStartTime: "",
  dailyEndTime: "",
  isActive: true,
  temporaryImageId: null,
  removeImage: false,
};
test("acepta una promoción válida sin programación", () => {
  assert.equal(promotionFormSchema.safeParse(validPromotion).success, true);
  assert.deepEqual(promotionInputFromForm(validPromotion), validPromotion);
});

test("rechaza título, cuerpo o el formato anterior de fechas", () => {
  assert.equal(promotionFormSchema.safeParse({ ...validPromotion, title: "" }).success, false);
  assert.equal(promotionFormSchema.safeParse({ ...validPromotion, body: "" }).success, false);
  assert.equal(promotionFormSchema.safeParse({
    ...validPromotion,
    startAt: "2026-08-04T12:00",
  }).success, false);
});

test("valida días y una franja semanal dentro del mismo día", () => {
  assert.equal(promotionFormSchema.safeParse({
    ...validPromotion,
    weeklyDays: ["MONDAY", "TUESDAY", "WEDNESDAY"],
    dailyStartTime: "12:00",
    dailyEndTime: "15:00",
  }).success, true);
  assert.equal(promotionFormSchema.safeParse({
    ...validPromotion,
    dailyStartTime: "12:00",
    dailyEndTime: "",
  }).success, false);
  assert.equal(promotionFormSchema.safeParse({
    ...validPromotion,
    dailyStartTime: "15:00",
    dailyEndTime: "12:00",
  }).success, false);
});

test("una programación semanal es informativa y no oculta una promoción activa", () => {
  const scheduled = {
    isActive: true,
    weeklyDays: ["MONDAY", "TUESDAY", "WEDNESDAY"],
    dailyStartTime: "12:00",
    dailyEndTime: "15:00",
  };
  assert.equal(isPublicPromotion(scheduled), true);
});

test("un horario sin días y días completos se formatean para el público", () => {
  assert.equal(formatPromotionPublicAvailability({
    weeklyDays: [],
    dailyStartTime: "12:00",
    dailyEndTime: "15:00",
  }), "Todos los días, 12:00 a 15:00");
  assert.equal(formatPromotionPublicAvailability({
    weeklyDays: ["SUNDAY"],
    dailyStartTime: null,
    dailyEndTime: null,
  }), "Domingo, todo el día");
});

test("muestra promociones cargadas por un cliente Prisma anterior sin romper la página", () => {
  assert.equal(formatPromotionWeeklySchedule({}), "Sin restricción semanal");
  assert.equal(formatPromotionWeeklySchedule({
    weeklyDays: null,
    dailyStartTime: null,
    dailyEndTime: null,
  }), "Sin restricción semanal");
});

test("la visibilidad pública ignora fechas y horarios, pero respeta activación", () => {
  const legacyPromotion = {
    isActive: true,
    startDate: new Date("2026-08-05"),
    endDate: new Date("2026-08-06"),
    weeklyDays: ["TUESDAY"],
    dailyStartTime: "12:00",
    dailyEndTime: "15:00",
  };
  assert.equal(isPublicPromotion(legacyPromotion), true);
  assert.equal(isPublicPromotion({ ...legacyPromotion, isActive: false }), false);
});

test("ordena promociones por creación reciente", () => {
  const sorted = sortPublicPromotions([
    { id: "recent", createdAt: new Date("2026-08-04") },
    { id: "old", createdAt: new Date("2026-08-03") },
    { id: "middle", createdAt: new Date("2026-08-03T12:00:00Z") },
  ]);
  assert.deepEqual(sorted.map((promotion) => promotion.id), ["recent", "middle", "old"]);
});

test("valida edición, activación y desactivación", () => {
  assert.equal(promotionFormSchema.parse({ ...validPromotion, title: "Editada" }).title, "Editada");
  assert.equal(promotionStatusSchema.parse({ isActive: true }).isActive, true);
  assert.equal(promotionStatusSchema.parse({ isActive: false }).isActive, false);
});

test("exige OWNER activo", () => {
  assert.equal(isActiveOwner({ role: "OWNER", isActive: true }), true);
  assert.equal(isActiveOwner({ role: "OWNER", isActive: false }), false);
  assert.equal(isActiveOwner({ role: "USER", isActive: true }), false);
});

test("confirma una imagen nueva antes de borrar la anterior", async () => {
  const calls: string[] = [];
  await runImageMutation({
    prepare: async () => {
      calls.push("prepare");
      return { imageId: "id", tempPath: "temp", finalPath: "final", publicUrl: "url" };
    },
    persist: async () => calls.push("persist"),
    confirm: async () => { calls.push("confirm"); },
    rollback: async () => { calls.push("rollback"); },
    deletePrevious: async () => { calls.push("delete-previous"); },
  });
  assert.deepEqual(calls, ["prepare", "persist", "confirm", "delete-previous"]);
});

test("revierte la imagen final si falla la persistencia", async () => {
  const calls: string[] = [];
  await assert.rejects(runImageMutation({
    prepare: async () => ({ imageId: "id", tempPath: "temp", finalPath: "final", publicUrl: "url" }),
    persist: async () => { throw new Error("db"); },
    confirm: async () => undefined,
    rollback: async () => { calls.push("rollback"); },
  }));
  assert.deepEqual(calls, ["rollback"]);
});

test("cancelar descarta la imagen temporal", async () => {
  const discarded: string[] = [];
  await cancelPromotionImage("image-id", async (id) => { discarded.push(id); });
  assert.deepEqual(discarded, ["image-id"]);
});

test("procesa promociones a WebP 1920x1080 y respeta 5 MB", async () => {
  const sharp = (await import("sharp")).default;
  const { TemporaryImageTarget } = await import("../generated/prisma/client");
  const { InvalidImageError, validateAndProcessImage } = await import("../lib/images/image-processing");
  const source = await sharp({
    create: { width: 3000, height: 2000, channels: 3, background: "#e1a1a1" },
  }).jpeg().toBuffer();
  const result = await validateAndProcessImage(source, TemporaryImageTarget.PROMOTION);
  const metadata = await sharp(result.buffer).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(result.width, 1620);
  assert.equal(result.height, 1080);
  await assert.rejects(
    validateAndProcessImage(Buffer.alloc(5 * 1024 * 1024 + 1), TemporaryImageTarget.PROMOTION),
    InvalidImageError,
  );
});

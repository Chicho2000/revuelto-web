import { z } from "zod";
import { BRANCH_DAYS, BRANCH_DAY_LABELS, type BranchDay } from "@/lib/branches/schema";

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export const PROMOTION_DAY_LABELS = BRANCH_DAY_LABELS;
export const PROMOTION_DAYS = BRANCH_DAYS;

export const promotionFormSchema = z
  .object({
    title: z.string().trim().min(1, "El título es obligatorio.").max(160),
    body: z.string().trim().min(1, "El cuerpo es obligatorio.").max(3000),
    weeklyDays: z.array(z.enum(BRANCH_DAYS)).max(7),
    dailyStartTime: z.string(),
    dailyEndTime: z.string(),
    isActive: z.boolean(),
    temporaryImageId: z.string().uuid().nullable(),
    removeImage: z.boolean(),
  })
  .strict()
  .superRefine((promotion, context) => {
    if (promotion.temporaryImageId && promotion.removeImage) {
      context.addIssue({
        code: "custom",
        path: ["removeImage"],
        message: "La imagen nueva y la eliminación no pueden solicitarse juntas.",
      });
    }
    const hasStartTime = promotion.dailyStartTime !== "";
    const hasEndTime = promotion.dailyEndTime !== "";
    if (hasStartTime !== hasEndTime) {
      context.addIssue({
        code: "custom",
        path: [hasStartTime ? "dailyEndTime" : "dailyStartTime"],
        message: "Completá ambas horas o dejalas vacías.",
      });
    } else if (hasStartTime && hasEndTime) {
      if (!TIME_PATTERN.test(promotion.dailyStartTime)) {
        context.addIssue({ code: "custom", path: ["dailyStartTime"], message: "La hora inicial no es válida." });
      }
      if (!TIME_PATTERN.test(promotion.dailyEndTime)) {
        context.addIssue({ code: "custom", path: ["dailyEndTime"], message: "La hora final no es válida." });
      }
      if (
        TIME_PATTERN.test(promotion.dailyStartTime) &&
        TIME_PATTERN.test(promotion.dailyEndTime) &&
        promotion.dailyEndTime <= promotion.dailyStartTime
      ) {
        context.addIssue({
          code: "custom",
          path: ["dailyEndTime"],
          message: "La hora final debe ser posterior a la inicial.",
        });
      }
    }
    if (new Set(promotion.weeklyDays).size !== promotion.weeklyDays.length) {
      context.addIssue({ code: "custom", path: ["weeklyDays"], message: "No repitas días." });
    }
  });

export const promotionStatusSchema = z.object({ isActive: z.boolean() }).strict();
export type PromotionFormInput = z.infer<typeof promotionFormSchema>;
export type PromotionInput = PromotionFormInput;

export function promotionInputFromForm(input: PromotionFormInput): PromotionInput {
  return input;
}

export function formatPromotionWeeklySchedule(promotion: {
  weeklyDays?: readonly BranchDay[] | null;
  dailyStartTime?: string | null;
  dailyEndTime?: string | null;
}) {
  const weeklyDays = promotion.weeklyDays ?? [];
  const days = weeklyDays.length
    ? weeklyDays.map((day) => PROMOTION_DAY_LABELS[day]).join(", ")
    : "Todos los días";
  return promotion.dailyStartTime && promotion.dailyEndTime
    ? `${days}, ${promotion.dailyStartTime} a ${promotion.dailyEndTime}`
    : weeklyDays.length
      ? `${days}, todo el día`
      : "Sin restricción semanal";
}

export function formatPromotionPublicAvailability(promotion: {
  weeklyDays?: readonly BranchDay[] | null;
  dailyStartTime?: string | null;
  dailyEndTime?: string | null;
}) {
  const schedule = formatPromotionWeeklySchedule(promotion);
  return schedule === "Sin restricción semanal" ? "Todos los días" : schedule;
}

export function sortPublicPromotions<T extends { createdAt: Date }>(promotions: readonly T[]) {
  return [...promotions].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
}

export function getPromotionMutationError(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error && error.code === "P2025") {
    return { status: 404, message: "La promoción no existe." };
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.includes("Bucket not found")
  ) {
    return { status: 503, message: "Falta configurar bucket-media para guardar la imagen." };
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.includes("Unknown argument `weeklyDays`")
  ) {
    return {
      status: 503,
      message: "El servidor usa Prisma desactualizado. Detenelo, ejecutá prisma generate y volvé a iniciarlo.",
    };
  }
  if (typeof error === "object" && error !== null && "code" in error && error.code === "P2022") {
    return {
      status: 503,
      message: "Falta aplicar la migración de programación semanal en la base de datos.",
    };
  }
  return { status: 500, message: "No se pudo guardar la promoción." };
}

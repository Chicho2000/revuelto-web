import { z } from "zod";

export const BRANCH_DAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;

export type BranchDay = (typeof BRANCH_DAYS)[number];

export const BRANCH_DAY_LABELS: Record<BranchDay, string> = {
  MONDAY: "Lunes",
  TUESDAY: "Martes",
  WEDNESDAY: "Miércoles",
  THURSDAY: "Jueves",
  FRIDAY: "Viernes",
  SATURDAY: "Sábado",
  SUNDAY: "Domingo",
};

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

const branchScheduleSchema = z
  .object({
    dayOfWeek: z.enum(BRANCH_DAYS),
    isOpen: z.boolean(),
    openTime: z.string().optional(),
    closeTime: z.string().optional(),
  })
  .strict()
  .superRefine((schedule, context) => {
    if (!schedule.isOpen) return;

    if (!schedule.openTime || !TIME_PATTERN.test(schedule.openTime)) {
      context.addIssue({
        code: "custom",
        path: ["openTime"],
        message: "Ingresá una apertura válida en formato HH:mm.",
      });
    }

    if (!schedule.closeTime || !TIME_PATTERN.test(schedule.closeTime)) {
      context.addIssue({
        code: "custom",
        path: ["closeTime"],
        message: "Ingresá un cierre válido en formato HH:mm.",
      });
    }

    if (
      schedule.openTime &&
      schedule.closeTime &&
      TIME_PATTERN.test(schedule.openTime) &&
      TIME_PATTERN.test(schedule.closeTime) &&
      schedule.closeTime <= schedule.openTime
    ) {
      context.addIssue({
        code: "custom",
        path: ["closeTime"],
        message: "El cierre debe ser posterior a la apertura.",
      });
    }
  });

export const branchInputSchema = z
  .object({
    name: z.string().trim().min(1, "El nombre es obligatorio.").max(120),
    address: z.string().trim().min(1, "La dirección es obligatoria.").max(240),
    city: z.string().trim().min(1, "La ciudad es obligatoria.").max(120),
    phone: z.string().trim().max(40, "El teléfono es demasiado largo.").optional(),
    isActive: z.boolean(),
    schedules: z.array(branchScheduleSchema).length(7, "Deben informarse los siete días."),
  })
  .strict()
  .superRefine((branch, context) => {
    const seen = new Set<BranchDay>();

    branch.schedules.forEach((schedule, index) => {
      if (seen.has(schedule.dayOfWeek)) {
        context.addIssue({
          code: "custom",
          path: ["schedules", index, "dayOfWeek"],
          message: "No puede repetirse un día.",
        });
      }
      seen.add(schedule.dayOfWeek);
    });

    for (const day of BRANCH_DAYS) {
      if (!seen.has(day)) {
        context.addIssue({
          code: "custom",
          path: ["schedules"],
          message: `Falta ${BRANCH_DAY_LABELS[day]}.`,
        });
      }
    }
  });

export const branchStatusSchema = z.object({ isActive: z.boolean() }).strict();
export const branchDeleteSchema = z.object({ confirmation: z.string().min(1) }).strict();

export type BranchInput = z.infer<typeof branchInputSchema>;

export function createClosedBranchSchedules(): BranchInput["schedules"] {
  return BRANCH_DAYS.map((dayOfWeek) => ({
    dayOfWeek,
    isOpen: false,
    openTime: "",
    closeTime: "",
  }));
}

export function branchValues(input: BranchInput) {
  return {
    name: input.name,
    address: input.address,
    city: input.city,
    phone: input.phone?.trim() ?? "",
    isActive: input.isActive,
  };
}

export function scheduleValues(schedule: BranchInput["schedules"][number]) {
  return {
    dayOfWeek: schedule.dayOfWeek,
    isClosed: !schedule.isOpen,
    openingTime: schedule.isOpen ? schedule.openTime! : null,
    closingTime: schedule.isOpen ? schedule.closeTime! : null,
  };
}

export function isBranchPublic(branch: { isActive: boolean }) {
  return branch.isActive;
}

export function sortByBranchDay<T extends { dayOfWeek: string }>(records: T[]) {
  const indexes = new Map<string, number>(BRANCH_DAYS.map((day, index) => [day, index]));
  return [...records].sort(
    (left, right) =>
      (indexes.get(left.dayOfWeek) ?? Number.MAX_SAFE_INTEGER) -
      (indexes.get(right.dayOfWeek) ?? Number.MAX_SAFE_INTEGER),
  );
}

export function getBranchMutationError(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "CONFIRMATION_MISMATCH"
  ) {
    return { status: 400, message: "Escribí exactamente el nombre de la sucursal para confirmarla." };
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2025"
  ) {
    return { status: 404, message: "La sucursal no existe." };
  }

  return { status: 500, message: "No se pudo guardar la sucursal." };
}

import "server-only";
import { DayOfWeek } from "@/generated/prisma/client";
import type { BranchInput } from "@/lib/branches/schema";
import { branchValues, scheduleValues } from "@/lib/branches/schema";
import { getPrisma } from "@/lib/prisma";

function persistenceSchedule(schedule: BranchInput["schedules"][number]) {
  const values = scheduleValues(schedule);
  return {
    dayOfWeek: values.dayOfWeek as DayOfWeek,
    isClosed: values.isClosed,
    openingTime: values.openingTime,
    closingTime: values.closingTime,
  };
}

function persistenceBranch(input: BranchInput) {
  const values = branchValues(input);
  return {
    name: values.name,
    address: values.address,
    city: values.city,
    whatsappNumber: values.phone,
    isActive: values.isActive,
  };
}

export async function createBranch(input: BranchInput) {
  return getPrisma().branch.create({
    data: {
      ...persistenceBranch(input),
      // El esquema aplicado aún exige este campo legado. Las sucursales nuevas
      // lo inicializan vacío; las ediciones no alteran valores existentes.
      mapsUrl: "",
      // El nested write crea Branch y los siete BusinessHour en una única
      // transacción atómica de Prisma.
      businessHours: {
        create: input.schedules.map(persistenceSchedule),
      },
    },
    include: { businessHours: true },
  });
}

export async function updateBranch(branchId: string, input: BranchInput) {
  return getPrisma().branch.update({
    where: { id: branchId },
    data: {
      ...persistenceBranch(input),
      // Zod entrega los siete días sin repetir y el índice único de la base
      // impide duplicados incluso ante concurrencia.
      businessHours: {
        upsert: input.schedules.map((schedule) => {
          const values = persistenceSchedule(schedule);
          return {
            where: {
              branchId_dayOfWeek: {
                branchId,
                dayOfWeek: values.dayOfWeek,
              },
            },
            create: values,
            update: {
              isClosed: values.isClosed,
              openingTime: values.openingTime,
              closingTime: values.closingTime,
            },
          };
        }),
      },
    },
    include: { businessHours: true },
  });
}

export async function setBranchActive(branchId: string, isActive: boolean) {
  return getPrisma().branch.update({
    where: { id: branchId },
    data: { isActive },
  });
}

export async function deleteBranch(branchId: string, confirmation: string) {
  const prisma = getPrisma();
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { id: true, name: true },
  });

  if (!branch) throw Object.assign(new Error("Sucursal no encontrada."), { code: "P2025" });
  if (confirmation !== branch.name) {
    throw Object.assign(new Error("La confirmación no coincide."), { code: "CONFIRMATION_MISMATCH" });
  }

  await prisma.branch.delete({ where: { id: branch.id } });
}

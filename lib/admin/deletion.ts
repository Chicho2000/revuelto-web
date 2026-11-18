import { z } from "zod";

export type DeletionTarget = "BOWL" | "INGREDIENT" | "BRANCH" | "PROMOTION" | "GALLERY" | "MERCHANDISE";
export const deletionSchema = z.object({ confirmation: z.string().min(1).max(500) }).strict();

export function deletionError(code: string) {
  return Object.assign(new Error(code), { code });
}

export async function runConfirmedDeletion({ entity, confirmation, remove }: {
  entity: { name: string; active: boolean; inUse?: boolean; imagePath?: string | null } | null;
  confirmation: string;
  remove: () => Promise<{ count: number }>;
}) {
  if (!entity) throw deletionError("P2025");
  if (entity.active) throw deletionError("ENTITY_ACTIVE");
  if (confirmation !== entity.name) throw deletionError("CONFIRMATION_MISMATCH");
  if (entity.inUse) throw deletionError("ENTITY_IN_USE");
  if ((await remove()).count !== 1) throw deletionError("ENTITY_CHANGED");
  return entity.imagePath ?? null;
}

export function getDeletionError(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error ? error.code : null;
  switch (code) {
    case "P2025": return { status: 404, message: "El elemento ya no existe." };
    case "ENTITY_ACTIVE": return { status: 409, message: "Primero desactivá u ocultá el elemento para poder borrarlo." };
    case "CONFIRMATION_MISMATCH": return { status: 400, message: "Escribí exactamente el nombre indicado para confirmar el borrado." };
    case "ENTITY_IN_USE":
    case "P2003": return { status: 409, message: "El elemento está vinculado a recetas o pedidos. Quitá sus referencias cuando corresponda o mantenelo desactivado para conservar el historial." };
    case "ENTITY_CHANGED":
    case "P2034": return { status: 409, message: "El elemento cambió mientras lo confirmabas. Actualizá la página y revisalo antes de intentar otra vez." };
    case "P2021":
    case "P2022": return { status: 503, message: "Falta actualizar la base de datos del panel." };
    default: return { status: 500, message: "No se pudo borrar el elemento." };
  }
}

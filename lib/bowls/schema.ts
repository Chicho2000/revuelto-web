import { z } from "zod";

const priceSchema = z
  .number({ error: "Ingresá un precio válido." })
  .finite("Ingresá un precio válido.")
  .positive("El precio debe ser mayor que cero.");

const bowlSizeSchema = z.object({ price: priceSchema }).strict();

export const bowlInputSchema = z
  .object({
    name: z.string().trim().min(1, "El nombre es obligatorio.").max(120),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, "El slug es obligatorio.")
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Usá letras minúsculas, números y guiones."),
    description: z.string().trim().max(2000, "La descripción es demasiado larga."),
    isActive: z.boolean(),
    temporaryImageId: z.string().uuid().nullable(),
    sizes: z
      .object({
        SMALL: bowlSizeSchema,
        LARGE: bowlSizeSchema,
      })
      .strict(),
  })
  .strict();

export const bowlStatusSchema = z.object({ isActive: z.boolean() }).strict();
export const bowlDeleteSchema = z.object({ confirmation: z.string().min(1) }).strict();

export type BowlInput = z.infer<typeof bowlInputSchema>;

export function slugifyBowlName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getBowlMutationError(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "CONFIRMATION_MISMATCH"
  ) {
    return { status: 400, message: "Escribí exactamente el nombre del bowl para confirmarlo." };
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.includes("Bucket not found")
  ) {
    return {
      status: 503,
      message: "Falta configurar el bucket público bucket-media para guardar la imagen final.",
    };
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  ) {
    return { status: 409, message: "Ya existe un bowl con ese slug." };
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2025"
  ) {
    return { status: 404, message: "El bowl no existe." };
  }

  return { status: 500, message: "No se pudo guardar el bowl." };
}

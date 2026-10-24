import { z } from "zod";

export const ingredientCategories = [
  { value: "BASE", label: "Base" },
  { value: "PROTEIN", label: "Proteína" },
  { value: "VEGETABLE", label: "Vegetal" },
  { value: "SEED_NUT", label: "Semillas y frutos secos" },
  { value: "SAUCE", label: "Salsa" },
  { value: "OTHER", label: "Otro" },
] as const;

export const ingredientFormSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio.").max(160),
  category: z.enum(["BASE", "PROTEIN", "VEGETABLE", "SEED_NUT", "SAUCE", "OTHER"]),
  isActive: z.boolean(),
  temporaryImageId: z.string().uuid().nullable(),
  removeImage: z.boolean(),
}).strict().refine((value) => !value.removeImage || !value.temporaryImageId, {
  path: ["removeImage"],
  message: "No podés quitar y reemplazar la imagen a la vez.",
});

export const ingredientStatusSchema = z.object({ isActive: z.boolean() }).strict();

export type IngredientFormInput = z.input<typeof ingredientFormSchema>;
export type IngredientInput = z.output<typeof ingredientFormSchema>;

export function getIngredientMutationError(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    if (error.code === "P2025") return { status: 404, message: "El ingrediente no existe." };
    if (error.code === "P2021" || error.code === "P2022") {
      return { status: 503, message: "Falta aplicar la migración de ingredientes." };
    }
    if (error.code === "P2002") return { status: 409, message: "Ya existe un ingrediente con esos datos." };
  }
  return { status: 500, message: "No se pudo guardar el ingrediente." };
}

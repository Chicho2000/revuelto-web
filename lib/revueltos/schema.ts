import { z } from "zod";

const ingredientIdSchema = z.string().uuid();

const recipeIngredientSchema = z.object({
  ingredientId: ingredientIdSchema,
  sortOrder: z.number().int().min(0).max(100),
  isRemovable: z.boolean(),
}).strict();

const choiceOptionSchema = z.object({
  ingredientId: ingredientIdSchema,
  sortOrder: z.number().int().min(0).max(100),
}).strict();

const drinkOptionSchema = z.object({
  name: z.string().trim().min(1, "Escribí el nombre de la opción.").max(100),
  sortOrder: z.number().int().min(0).max(100),
}).strict();

const choiceGroupSchema = z.object({
  code: z.enum(["breakfast-protein", "protein", "vegetables", "seed-nut", "sauce", "drink-variant"]),
  label: z.string().trim().min(1).max(100),
  category: z.enum(["PROTEIN", "VEGETABLE", "SEED_NUT", "SAUCE", "OTHER"]),
  minSelections: z.number().int().min(0).max(4),
  maxSelections: z.number().int().min(1).max(4),
  sortOrder: z.number().int().min(0).max(10),
  options: z.array(choiceOptionSchema).min(1).max(20),
}).strict().refine((group) => group.maxSelections >= group.minSelections, {
  path: ["maxSelections"],
  message: "El máximo debe ser igual o mayor que el mínimo.",
});

export const revueltoFormSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio.").max(160),
  menuCategory: z.enum(["REVUELTO", "REVUELTITO", "SANGUCHITO", "BEBIDA"]),
  kind: z.enum(["FIXED", "CUSTOM"]),
  description: z.string().trim().max(2000),
  price: z.number().positive("El precio debe ser mayor que cero.").nullable(),
  comboPrice: z.number().positive("El precio del combo debe ser mayor que cero.").nullable(),
  displayOrder: z.number().int().min(0).max(1000),
  isVisibleInNewMenu: z.boolean(),
  recipeIngredients: z.array(recipeIngredientSchema).max(40)
    .superRefine((items, context) => {
      const ids = new Set<string>();
      for (const [index, item] of items.entries()) {
        if (ids.has(item.ingredientId)) {
          context.addIssue({ code: "custom", path: [index, "ingredientId"], message: "No repitas ingredientes." });
        }
        ids.add(item.ingredientId);
      }
    }),
  drinkOptions: z.array(drinkOptionSchema).max(20, "Cada bebida admite hasta 20 opciones.")
    .superRefine((options, context) => {
      const names = new Set<string>();
      for (const [index, option] of options.entries()) {
        const key = option.name.trim().toLocaleLowerCase("es-AR");
        if (names.has(key)) context.addIssue({ code: "custom", path: [index, "name"], message: "No repitas opciones en la misma bebida." });
        names.add(key);
      }
    }),
  choiceGroups: z.array(choiceGroupSchema).max(4)
    .superRefine((groups, context) => {
      const codes = new Set<string>();
      for (const [index, group] of groups.entries()) {
        if (codes.has(group.code)) {
          context.addIssue({ code: "custom", path: [index, "code"], message: "No repitas grupos de elección." });
        }
        codes.add(group.code);
      }
    }),
  temporaryImageId: z.string().uuid().nullable(),
  removeImage: z.boolean(),
}).strict().superRefine((value, context) => {
  if (value.menuCategory === "REVUELTO" && !value.description) context.addIssue({ code: "custom", path: ["description"], message: "La descripción es obligatoria." });
  if (value.menuCategory !== "BEBIDA" && value.recipeIngredients.length === 0) context.addIssue({ code: "custom", path: ["recipeIngredients"], message: "Elegí al menos un ingrediente." });
  if (value.menuCategory === "BEBIDA" && value.drinkOptions.length === 1) context.addIssue({ code: "custom", path: ["drinkOptions"], message: "Si hay una sola presentación, dejá la lista vacía; para elegir sabores agregá al menos dos opciones." });
  if (value.menuCategory !== "BEBIDA" && value.drinkOptions.length > 0) context.addIssue({ code: "custom", path: ["drinkOptions"], message: "Las opciones de bebida solo corresponden a Bebidas." });
  if (value.menuCategory === "BEBIDA" && value.choiceGroups.length > 0) context.addIssue({ code: "custom", path: ["choiceGroups"], message: "Configurá las variantes de bebida en su propia lista de opciones." });
  if (value.menuCategory !== "REVUELTO" && value.kind !== "FIXED") context.addIssue({ code: "custom", path: ["kind"], message: "Solo Tu Revuelto admite armado libre." });
  if (value.menuCategory !== "REVUELTITO" && value.comboPrice !== null) context.addIssue({ code: "custom", path: ["comboPrice"], message: "El combo solo corresponde a Revueltitos." });
  if (value.menuCategory === "REVUELTITO" && value.comboPrice !== null && value.price !== null && value.comboPrice <= value.price) context.addIssue({ code: "custom", path: ["comboPrice"], message: "El combo debe costar más que el Revueltito solo." });
}).refine((value) => !value.removeImage || !value.temporaryImageId, {
  path: ["removeImage"],
  message: "No podés quitar y reemplazar la imagen a la vez.",
});

export type RevueltoFormInput = z.input<typeof revueltoFormSchema>;
export type RevueltoInput = z.output<typeof revueltoFormSchema>;

export function getRevueltoMutationError(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    if (error.code === "P2025") return { status: 404, message: "El Revuelto no existe." };
    if (error.code === "P2021" || error.code === "P2022") {
      return { status: 503, message: "Falta aplicar la migración de Revueltos." };
    }
  }
  if (error instanceof Error && error.message.startsWith("RECIPE_")) {
    return { status: 400, message: error.message.slice("RECIPE_".length) };
  }
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string" && error.message.includes("Bucket not found")) {
    return { status: 503, message: "Falta configurar el bucket público bucket-media para guardar la imagen final." };
  }
  return { status: 500, message: "No se pudo guardar el Revuelto." };
}

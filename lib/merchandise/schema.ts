import { z } from "zod";

export const merchandiseItemFormSchema = z
  .object({
    name: z.string().trim().min(1, "El nombre es obligatorio.").max(160),
    description: z.string().trim().max(1000),
    price: z.number().finite().positive("El precio debe ser mayor que cero.").max(99_999_999),
    sortOrder: z.number().int().min(-100_000).max(100_000),
    isActive: z.boolean(),
    temporaryImageId: z.string().uuid().nullable(),
  })
  .strict();

export const merchandiseItemCreateSchema = merchandiseItemFormSchema.superRefine((item, context) => {
  if (!item.temporaryImageId) {
    context.addIssue({ code: "custom", path: ["temporaryImageId"], message: "La imagen es obligatoria." });
  }
});

export const merchandiseItemStatusSchema = z.object({ isActive: z.boolean() }).strict();

export type MerchandiseItemFormInput = z.input<typeof merchandiseItemFormSchema>;
export type MerchandiseItemInput = z.output<typeof merchandiseItemFormSchema>;

export function merchandiseItemInputFromForm(input: MerchandiseItemInput): MerchandiseItemInput {
  return { ...input, name: input.name.trim(), description: input.description.trim() };
}

export function isPublicMerchandiseItem(item: { isActive: boolean; imagePath: string | null | undefined }) {
  return item.isActive && Boolean(item.imagePath?.trim());
}

export function sortMerchandiseItems<T extends { sortOrder: number; createdAt: Date; id: string }>(items: readonly T[]) {
  return [...items].sort(
    (left, right) =>
      left.sortOrder - right.sortOrder ||
      left.createdAt.getTime() - right.createdAt.getTime() ||
      left.id.localeCompare(right.id),
  );
}

export function getMerchandiseMutationError(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error && error.code === "P2025") {
    return { status: 404, message: "El producto no existe." };
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "P2021" || error.code === "P2022")
  ) {
    return { status: 503, message: "Falta aplicar la migración de merchandising." };
  }
  return { status: 500, message: "No se pudo guardar el producto." };
}

import { z } from "zod";

// La nueva carta no puede reutilizar el carrito de BowlSize. Al cambiar la
// versión se descartan esos ítems locales que ya no tienen una equivalencia.
export const CART_STORAGE_KEY = "revuelto-cart-v2";
export const CART_STORAGE_VERSION = 2;
export const ORDER_MAX_QUANTITY_PER_LINE = 20;
export const ORDER_MAX_TOTAL_UNITS = 50;
export const ORDER_MAX_LINES = 50;

export const orderPaymentMethodSchema = z.enum(["CASH", "TRANSFER", "MERCADO_PAGO"]);

const quantitySchema = z
  .number()
  .int("La cantidad debe ser un número entero.")
  .min(1, "La cantidad mínima es 1.")
  .max(ORDER_MAX_QUANTITY_PER_LINE, `La cantidad máxima por producto es ${ORDER_MAX_QUANTITY_PER_LINE}.`);

export const bowlCartItemSchema = z
  .object({
    type: z.literal("BOWL"),
    productId: z.string().uuid(),
    size: z.enum(["SMALL", "LARGE"]),
    quantity: quantitySchema,
  })
  .strict();

const ingredientIdsSchema = z.array(z.string().uuid()).max(40).refine(
  (ids) => new Set(ids).size === ids.length,
  "Un ingrediente no puede repetirse.",
);

export const revueltoCartItemSchema = z
  .object({
    type: z.literal("REVUELTO"),
    productId: z.string().uuid(),
    excludedIngredientIds: ingredientIdsSchema,
    choices: z.array(z.object({
      groupId: z.string().uuid(),
      ingredientIds: ingredientIdsSchema,
    }).strict()).max(10).refine(
      (choices) => new Set(choices.map((choice) => choice.groupId)).size === choices.length,
      "Cada grupo se puede informar una sola vez.",
    ),
    quantity: quantitySchema,
  })
  .strict();

export const merchandiseCartItemSchema = z
  .object({
    type: z.literal("MERCHANDISE"),
    productId: z.string().uuid(),
    quantity: quantitySchema,
  })
  .strict();

export const cartItemSchema = z.discriminatedUnion("type", [
  bowlCartItemSchema,
  revueltoCartItemSchema,
  merchandiseCartItemSchema,
]);

function hasUniqueLines(items: Array<z.infer<typeof cartItemSchema>>) {
  const keys = items.map(getCartItemKey);
  return new Set(keys).size === keys.length;
}

function withinTotalUnitLimit(items: Array<z.infer<typeof cartItemSchema>>) {
  return items.reduce((total, item) => total + item.quantity, 0) <= ORDER_MAX_TOTAL_UNITS;
}

const cartItemsSchema = z
  .array(cartItemSchema)
  .max(ORDER_MAX_LINES, "El pedido tiene demasiados productos distintos.")
  .refine(hasUniqueLines, "El pedido contiene productos duplicados.")
  .refine(withinTotalUnitLimit, `El pedido admite hasta ${ORDER_MAX_TOTAL_UNITS} unidades.`);

export const cartStorageSchema = z
  .object({
    version: z.literal(CART_STORAGE_VERSION),
    items: cartItemsSchema,
  })
  .strict();

export const prepareOrderSchema = z
  .object({
    branchId: z.string().uuid(),
    paymentMethod: orderPaymentMethodSchema,
    items: cartItemsSchema.min(1, "Agregá al menos un producto."),
  })
  .strict();

export type CartItem = z.infer<typeof cartItemSchema>;
export type CartItemInput =
  | Omit<Extract<CartItem, { type: "BOWL" }>, "quantity">
  | Omit<Extract<CartItem, { type: "REVUELTO" }>, "quantity">
  | Omit<Extract<CartItem, { type: "MERCHANDISE" }>, "quantity">;
export type CartStorage = z.infer<typeof cartStorageSchema>;
export type PrepareOrderInput = z.infer<typeof prepareOrderSchema>;
export type OrderPaymentMethod = z.infer<typeof orderPaymentMethodSchema>;

export function getCartItemKey(item: CartItem | CartItemInput) {
  if (item.type === "BOWL") return `BOWL:${item.productId}:${item.size}`;
  if (item.type === "MERCHANDISE") return `MERCHANDISE:${item.productId}`;
  const excluded = [...item.excludedIngredientIds].sort().join(",");
  const choices = [...item.choices]
    .sort((left, right) => left.groupId.localeCompare(right.groupId))
    .map((choice) => `${choice.groupId}=${[...choice.ingredientIds].sort().join(",")}`)
    .join(";");
  return `REVUELTO:${item.productId}:excluded=${excluded}:choices=${choices}`;
}

export function getTotalCartUnits(items: readonly CartItem[]) {
  return items.reduce((total, item) => total + item.quantity, 0);
}

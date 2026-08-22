import { z } from "zod";

export const CART_STORAGE_KEY = "revuelto-cart-v1";
export const CART_STORAGE_VERSION = 1;
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

export const merchandiseCartItemSchema = z
  .object({
    type: z.literal("MERCHANDISE"),
    productId: z.string().uuid(),
    quantity: quantitySchema,
  })
  .strict();

export const cartItemSchema = z.discriminatedUnion("type", [
  bowlCartItemSchema,
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
  | Omit<Extract<CartItem, { type: "MERCHANDISE" }>, "quantity">;
export type CartStorage = z.infer<typeof cartStorageSchema>;
export type PrepareOrderInput = z.infer<typeof prepareOrderSchema>;
export type OrderPaymentMethod = z.infer<typeof orderPaymentMethodSchema>;

export function getCartItemKey(item: CartItem | CartItemInput) {
  return item.type === "BOWL" ? `BOWL:${item.productId}:${item.size}` : `MERCHANDISE:${item.productId}`;
}

export function getTotalCartUnits(items: readonly CartItem[]) {
  return items.reduce((total, item) => total + item.quantity, 0);
}

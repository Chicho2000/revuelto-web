import {
  CART_STORAGE_VERSION,
  ORDER_MAX_QUANTITY_PER_LINE,
  ORDER_MAX_TOTAL_UNITS,
  cartStorageSchema,
  getCartItemKey,
  getTotalCartUnits,
  type CartItem,
  type CartItemInput,
} from "@/lib/orders/schema";

export function parseStoredCart(value: string | null): CartItem[] {
  if (!value) return [];
  try {
    const parsed = cartStorageSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data.items : [];
  } catch {
    return [];
  }
}

export function serializeCart(items: readonly CartItem[]) {
  return JSON.stringify({ version: CART_STORAGE_VERSION, items });
}

export function addCartItem(items: readonly CartItem[], item: CartItemInput) {
  const key = getCartItemKey(item);
  const existing = items.find((candidate) => getCartItemKey(candidate) === key);
  if (getTotalCartUnits(items) >= ORDER_MAX_TOTAL_UNITS) return [...items];
  if (existing?.quantity === ORDER_MAX_QUANTITY_PER_LINE) return [...items];
  if (existing) {
    return items.map((candidate) => getCartItemKey(candidate) === key ? { ...candidate, quantity: candidate.quantity + 1 } : candidate);
  }
  return [...items, { ...item, quantity: 1 } as CartItem];
}

export function setCartItemQuantity(items: readonly CartItem[], key: string, quantity: number) {
  if (!Number.isInteger(quantity)) return [...items];
  if (quantity <= 0) return removeCartItem(items, key);
  const existing = items.find((candidate) => getCartItemKey(candidate) === key);
  if (!existing) return [...items];
  const nextQuantity = Math.min(quantity, ORDER_MAX_QUANTITY_PER_LINE);
  const otherUnits = getTotalCartUnits(items) - existing.quantity;
  if (otherUnits + nextQuantity > ORDER_MAX_TOTAL_UNITS) return [...items];
  return items.map((candidate) => getCartItemKey(candidate) === key ? { ...candidate, quantity: nextQuantity } : candidate);
}

export function removeCartItem(items: readonly CartItem[], key: string) {
  return items.filter((candidate) => getCartItemKey(candidate) !== key);
}

export function getCartLineQuantity(items: readonly CartItem[], key: string) {
  return items.find((item) => getCartItemKey(item) === key)?.quantity ?? 0;
}

export function getEstimatedCartTotalCents(items: readonly CartItem[], pricesByKey: ReadonlyMap<string, number>) {
  return items.reduce((total, item) => total + (pricesByKey.get(getCartItemKey(item)) ?? 0) * item.quantity, 0);
}

export function shouldShowCartBottomBar(items: readonly CartItem[]) {
  return getTotalCartUnits(items) > 0;
}

export function getCartPreview(items: readonly CartItem[], maximumVisible = 3) {
  return {
    visible: items.slice(0, maximumVisible),
    remainingLines: Math.max(0, items.length - maximumVisible),
  };
}

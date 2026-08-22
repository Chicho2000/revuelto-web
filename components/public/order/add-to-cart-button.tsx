"use client";

import type { CartItemInput } from "@/lib/orders/schema";
import { getCartItemKey } from "@/lib/orders/schema";
import { usePublicOrderCart } from "@/components/public/order/cart-provider";
import { CartItemQuantityControl } from "@/components/public/order/cart-item-quantity-control";

export function AddToCartButton({ item, name }: { item: CartItemInput; name: string }) {
  const cart = usePublicOrderCart();
  if (!cart.enabled) return null;
  const quantity = cart.quantityFor(item);
  if (quantity === 0) {
    return <button className="public-add-button" type="button" onClick={() => cart.add(item)}>Agregar</button>;
  }
  return (
    <CartItemQuantityControl
      name={name}
      quantity={quantity}
      onDecrease={() => cart.decrease(item)}
      onIncrease={() => cart.add(item)}
      compact
      highlighted={cart.recentlyChangedKey === getCartItemKey(item)}
    />
  );
}

"use client";

import type { MouseEvent } from "react";
import type { CartItem } from "@/lib/orders/schema";
import { CartProductThumbnails } from "@/components/public/order/cart-product-thumbnails";
import type { PublicOrderProduct } from "@/components/public/order/cart-provider";

const currencyFormatter = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function CartBottomBar({
  items,
  products,
  totalUnits,
  estimatedTotalCents,
  onOpen,
}: {
  items: CartItem[];
  products: ReadonlyMap<string, PublicOrderProduct>;
  totalUnits: number;
  estimatedTotalCents: number;
  onOpen: (opener: HTMLElement) => void;
}) {
  return (
    <aside className="public-cart-bottom-bar" aria-label="Resumen del pedido">
      <CartProductThumbnails items={items} products={products} />
      <div className="public-cart-bottom-summary">
        <span>{totalUnits} {totalUnits === 1 ? "producto" : "productos"}</span>
        <strong>{currencyFormatter.format(estimatedTotalCents / 100)}</strong>
      </div>
      <button type="button" onClick={(event: MouseEvent<HTMLButtonElement>) => onOpen(event.currentTarget)}>Ver pedido</button>
    </aside>
  );
}

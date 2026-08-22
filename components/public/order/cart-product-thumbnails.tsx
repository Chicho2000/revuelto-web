"use client";

import Image from "next/image";
import { getCartItemKey, type CartItem } from "@/lib/orders/schema";
import { getCartPreview } from "@/lib/orders/cart";
import type { PublicOrderProduct } from "@/components/public/order/cart-provider";

export function CartProductThumbnails({ items, products }: { items: CartItem[]; products: ReadonlyMap<string, PublicOrderProduct> }) {
  const preview = getCartPreview(items);
  return (
    <div className="public-cart-thumbnails" aria-hidden="true">
      {preview.visible.map((item) => {
        const key = getCartItemKey(item);
        const product = products.get(key);
        return (
          <span className="public-cart-thumbnail" key={key}>
            {product?.imageUrl ? <Image src={product.imageUrl} alt="" fill sizes="48px" /> : <span className="public-cart-thumbnail-placeholder">R</span>}
            <strong>{item.quantity}×</strong>
          </span>
        );
      })}
      {preview.remainingLines > 0 && <span className="public-cart-thumbnail-more">+{preview.remainingLines}</span>}
    </div>
  );
}

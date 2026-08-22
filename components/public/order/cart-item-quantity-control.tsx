"use client";

export function CartItemQuantityControl({
  name,
  quantity,
  onDecrease,
  onIncrease,
  compact = false,
  highlighted = false,
}: {
  name: string;
  quantity: number;
  onDecrease: () => void;
  onIncrease: () => void;
  compact?: boolean;
  highlighted?: boolean;
}) {
  return (
    <div className={`public-cart-quantity${compact ? " is-compact" : ""}${highlighted ? " is-updated" : ""}`} aria-label={`${quantity} unidades de ${name}`}>
      <button type="button" onClick={onDecrease} aria-label={`Quitar una unidad de ${name}`}>−</button>
      <span aria-hidden="true">{quantity}</span>
      <button type="button" onClick={onIncrease} aria-label={`Agregar una unidad de ${name}`}>+</button>
    </div>
  );
}

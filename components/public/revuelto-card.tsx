"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { usePublicOrderCart } from "@/components/public/order/cart-provider";
import type { CartItemInput } from "@/lib/orders/schema";

type Ingredient = { id: string; name: string };
type PublicRevuelto = {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  price: number | null;
  kind: "FIXED" | "CUSTOM";
  recipeIngredients: Array<{ ingredientId: string; isRemovable: boolean; ingredient: Ingredient }>;
  choiceGroups: Array<{ id: string; label: string; minSelections: number; maxSelections: number; options: Array<{ ingredientId: string; ingredient: Ingredient }> }>;
};

const currencyFormatter = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

function initialChoices(revuelto: PublicRevuelto) {
  return Object.fromEntries(revuelto.choiceGroups.map((group) => [group.id, []]));
}

export function RevueltoCard({ revuelto, index }: { revuelto: PublicRevuelto; index: number }) {
  const cart = usePublicOrderCart();
  const [open, setOpen] = useState(false);
  const [includedIngredients, setIncludedIngredients] = useState(() => new Set(revuelto.recipeIngredients.map((item) => item.ingredientId)));
  const [choices, setChoices] = useState<Record<string, string[]>>(() => initialChoices(revuelto));
  const [quantity, setQuantity] = useState(1);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  function resetSelection() {
    setIncludedIngredients(new Set(revuelto.recipeIngredients.map((item) => item.ingredientId)));
    setChoices(initialChoices(revuelto));
    setQuantity(1);
  }
  function closeDialog() { setOpen(false); }
  function openDialog() { resetSelection(); setOpen(true); }

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") closeDialog(); };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", onKeyDown); };
  }, [open]);

  function toggleRemovable(ingredientId: string, checked: boolean) {
    setIncludedIngredients((current) => {
      const next = new Set(current);
      if (checked) next.add(ingredientId); else next.delete(ingredientId);
      return next;
    });
  }
  function toggleChoice(group: PublicRevuelto["choiceGroups"][number], ingredientId: string, checked: boolean) {
    setChoices((current) => {
      const selected = current[group.id] ?? [];
      let next = selected;
      if (group.maxSelections === 1) next = checked ? [ingredientId] : selected;
      else if (checked && selected.length < group.maxSelections) next = [...selected, ingredientId];
      else if (!checked && selected.length > group.minSelections) next = selected.filter((id) => id !== ingredientId);
      return { ...current, [group.id]: next };
    });
  }

  const selectionComplete = revuelto.choiceGroups.every((group) => {
    const selected = choices[group.id] ?? [];
    return selected.length >= group.minSelections && selected.length <= group.maxSelections;
  });
  const canAdd = cart.enabled && revuelto.price !== null && selectionComplete;
  function addToCart() {
    if (!canAdd) return;
    const item: CartItemInput = {
      type: "REVUELTO",
      productId: revuelto.id,
      excludedIngredientIds: revuelto.recipeIngredients.filter((item) => item.isRemovable && !includedIngredients.has(item.ingredientId)).map((item) => item.ingredientId),
      choices: revuelto.choiceGroups.map((group) => ({ groupId: group.id, ingredientIds: choices[group.id] ?? [] })),
    };
    cart.addQuantity(item, quantity);
    closeDialog();
  }

  return (
    <article className="public-bowl-card public-revuelto-card" data-reveal>
      <span className="public-bowl-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
      <button type="button" className="public-revuelto-open" onClick={openDialog} aria-label={`Personalizar ${revuelto.name}`}>
        <div className="public-bowl-image">{revuelto.imageUrl ? <Image src={revuelto.imageUrl} alt={revuelto.name} fill sizes="(max-width: 719px) 100vw, (max-width: 1099px) 50vw, 33vw" /> : <p>Foto próximamente</p>}</div>
        <div className="public-bowl-body"><h3>{revuelto.name}</h3><p className="public-bowl-description">{revuelto.description}</p><strong className="public-revuelto-price">{revuelto.price === null ? "Precio próximamente" : currencyFormatter.format(revuelto.price)}</strong><span className="public-revuelto-open-label">{revuelto.kind === "CUSTOM" ? "Armá tu Revuelto" : "Elegir y personalizar"}</span></div>
      </button>
      {open && <div className="public-revuelto-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog(); }}>
        <section className="public-revuelto-modal" role="dialog" aria-modal="true" aria-labelledby={`revuelto-dialog-${revuelto.id}`}>
          <header><h2 id={`revuelto-dialog-${revuelto.id}`}>{revuelto.name}</h2><button ref={closeButtonRef} type="button" onClick={closeDialog} aria-label="Cerrar">×</button></header>
          <div className="public-revuelto-modal-content">
            <div className="public-revuelto-modal-image">{revuelto.imageUrl ? <Image src={revuelto.imageUrl} alt={revuelto.name} fill sizes="(max-width: 719px) 100vw, 50vw" /> : <span>Foto próximamente</span>}</div>
            <div className="public-revuelto-configurator">
              <p>{revuelto.description}</p><strong className="public-revuelto-modal-price">{revuelto.price === null ? "Precio próximamente" : currencyFormatter.format(revuelto.price)}</strong>
              {revuelto.recipeIngredients.length > 0 && <fieldset><legend>{revuelto.kind === "CUSTOM" ? "Base incluida" : "Personalizá tu Revuelto"}</legend><p className="public-revuelto-hint">{revuelto.kind === "CUSTOM" ? "Los huevos revueltos son la base del plato." : "Elegí los ingredientes que querés sacar."}</p>{revuelto.recipeIngredients.map((item) => <label className={`public-revuelto-option${!item.isRemovable ? " is-locked" : ""}`} key={item.ingredientId}><input type="checkbox" checked={includedIngredients.has(item.ingredientId)} disabled={!item.isRemovable} onChange={(event) => toggleRemovable(item.ingredientId, event.target.checked)} /><span>{item.ingredient.name}</span><small>{item.isRemovable ? (includedIngredients.has(item.ingredientId) ? "Incluido" : "Sin incluir") : "Incluido"}</small></label>)}</fieldset>}
              {revuelto.choiceGroups.map((group) => <fieldset key={group.id}><legend>{group.label}</legend><p className="public-revuelto-hint">Elegí {group.minSelections === group.maxSelections ? group.minSelections : `entre ${group.minSelections} y ${group.maxSelections}`}.</p>{group.options.map((option) => { const selected = (choices[group.id] ?? []).includes(option.ingredientId); const cannotAdd = !selected && (choices[group.id] ?? []).length >= group.maxSelections; return <label className="public-revuelto-option" key={option.ingredientId}><input type={group.maxSelections === 1 ? "radio" : "checkbox"} name={`choice-${revuelto.id}-${group.id}`} checked={selected} disabled={cannotAdd} onChange={(event) => toggleChoice(group, option.ingredientId, event.target.checked)} /><span>{option.ingredient.name}</span></label>; })}</fieldset>)}
            </div>
          </div>
          <footer><div className="public-revuelto-quantity" aria-label="Cantidad"><button type="button" onClick={() => setQuantity((current) => Math.max(1, current - 1))} disabled={quantity === 1} aria-label="Quitar una unidad">−</button><span>{quantity}</span><button type="button" onClick={() => setQuantity((current) => Math.min(20, current + 1))} aria-label="Agregar una unidad">+</button></div><button type="button" className="public-button public-button-dark" disabled={!canAdd} onClick={addToCart}>{cart.enabled ? (revuelto.price === null ? "Precio próximamente" : `Agregar${quantity > 1 ? ` × ${quantity}` : ""}`) : "Pedidos no disponibles"}</button></footer>
        </section>
      </div>}
    </article>
  );
}

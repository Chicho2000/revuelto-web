"use client";

import Image from "next/image";
import { useState } from "react";

type Ingredient = { id: string; name: string };

type PublicRevuelto = {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  price: number | null;
  kind: "FIXED" | "CUSTOM";
  recipeIngredients: Array<{ ingredientId: string; isRemovable: boolean; ingredient: Ingredient }>;
  choiceGroups: Array<{
    id: string;
    label: string;
    minSelections: number;
    maxSelections: number;
    options: Array<{ ingredientId: string; ingredient: Ingredient }>;
  }>;
};

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export function RevueltoCard({ revuelto, index }: { revuelto: PublicRevuelto; index: number }) {
  const [includedIngredients, setIncludedIngredients] = useState(() => new Set(revuelto.recipeIngredients.map((item) => item.ingredientId)));
  const [choices, setChoices] = useState<Record<string, string[]>>(() => Object.fromEntries(
    revuelto.choiceGroups.map((group) => [
      group.id,
      group.minSelections > 0 ? group.options.slice(0, group.minSelections).map((option) => option.ingredientId) : [],
    ]),
  ));

  function toggleRemovable(ingredientId: string, checked: boolean) {
    setIncludedIngredients((current) => {
      const next = new Set(current);
      if (checked) next.add(ingredientId);
      else next.delete(ingredientId);
      return next;
    });
  }

  function toggleChoice(group: PublicRevuelto["choiceGroups"][number], ingredientId: string, checked: boolean) {
    setChoices((current) => {
      const selected = current[group.id] ?? [];
      let next: string[];
      if (group.maxSelections === 1) next = checked ? [ingredientId] : selected;
      else if (checked) next = selected.length < group.maxSelections ? [...selected, ingredientId] : selected;
      else if (selected.length > group.minSelections) next = selected.filter((id) => id !== ingredientId);
      else next = selected;
      return { ...current, [group.id]: next };
    });
  }

  return (
    <article className="public-bowl-card public-revuelto-card" data-reveal>
      <span className="public-bowl-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
      <div className="public-bowl-image">
        {revuelto.imageUrl ? <Image src={revuelto.imageUrl} alt={revuelto.name} fill sizes="(max-width: 719px) 100vw, (max-width: 1099px) 50vw, 33vw" /> : <p>Foto próximamente</p>}
      </div>
      <div className="public-bowl-body">
        <h3>{revuelto.name}</h3>
        <p className="public-bowl-description">{revuelto.description}</p>
        <strong className="public-revuelto-price">{revuelto.price === null ? "Precio próximamente" : currencyFormatter.format(revuelto.price)}</strong>
        <details className="public-revuelto-details">
          <summary>{revuelto.kind === "CUSTOM" ? "Armá tu Revuelto" : "Personalizá tu Revuelto"}</summary>
          <div className="public-revuelto-selector">
            {revuelto.recipeIngredients.length > 0 && (
              <fieldset>
                <legend>{revuelto.kind === "CUSTOM" ? "Base incluida" : "Ingredientes"}</legend>
                {revuelto.recipeIngredients.map((item) => (
                  <label className={!item.isRemovable ? "is-locked" : ""} key={item.ingredientId}>
                    <input
                      type="checkbox"
                      checked={includedIngredients.has(item.ingredientId)}
                      disabled={!item.isRemovable}
                      onChange={(event) => toggleRemovable(item.ingredientId, event.target.checked)}
                    />
                    <span>{item.ingredient.name}</span>
                    <small>{item.isRemovable ? "Podés sacarlo" : "Incluido"}</small>
                  </label>
                ))}
              </fieldset>
            )}
            {revuelto.choiceGroups.map((group) => (
              <fieldset key={group.id}>
                <legend>{group.label}</legend>
                {group.options.map((option) => {
                  const selected = (choices[group.id] ?? []).includes(option.ingredientId);
                  const cannotAdd = !selected && (choices[group.id] ?? []).length >= group.maxSelections;
                  const inputType = group.maxSelections === 1 ? "radio" : "checkbox";
                  return (
                    <label key={option.ingredientId}>
                      <input
                        type={inputType}
                        name={`choice-${revuelto.id}-${group.id}`}
                        checked={selected}
                        disabled={cannotAdd}
                        onChange={(event) => toggleChoice(group, option.ingredientId, event.target.checked)}
                      />
                      <span>{option.ingredient.name}</span>
                    </label>
                  );
                })}
              </fieldset>
            ))}
          </div>
        </details>
      </div>
    </article>
  );
}

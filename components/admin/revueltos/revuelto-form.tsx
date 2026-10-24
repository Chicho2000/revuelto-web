"use client";

import { useCallback, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { TemporaryImageField, type TemporaryImageFieldHandle } from "@/components/admin/temporary-image-field";
import { ingredientCategories } from "@/lib/ingredients/schema";
import { revueltoFormSchema, type RevueltoFormInput } from "@/lib/revueltos/schema";

type CatalogIngredient = {
  id: string;
  name: string;
  category: "BASE" | "PROTEIN" | "VEGETABLE" | "SEED_NUT" | "SAUCE" | "OTHER";
  isActive: boolean;
};

const customGroupDefinitions = [
  { code: "protein", label: "Elegí 1 proteína", category: "PROTEIN", minSelections: 1, maxSelections: 1 },
  { code: "vegetables", label: "Elegí hasta 4 vegetales", category: "VEGETABLE", minSelections: 0, maxSelections: 4 },
  { code: "seed-nut", label: "Elegí 1 semilla o fruto seco", category: "SEED_NUT", minSelections: 1, maxSelections: 1 },
  { code: "sauce", label: "Elegí 1 salsa", category: "SAUCE", minSelections: 1, maxSelections: 1 },
] as const;

function customChoiceGroups(): RevueltoFormInput["choiceGroups"] {
  return customGroupDefinitions.map((group, index) => ({ ...group, sortOrder: index, options: [] }));
}

function breakfastChoiceGroup(): RevueltoFormInput["choiceGroups"] {
  return [{
    code: "breakfast-protein",
    label: "Elegí jamón o panceta",
    category: "PROTEIN",
    minSelections: 1,
    maxSelections: 1,
    sortOrder: 0,
    options: [],
  }];
}

const emptyValues: RevueltoFormInput = {
  name: "",
  kind: "FIXED",
  description: "",
  price: null,
  displayOrder: 0,
  isVisibleInNewMenu: false,
  recipeIngredients: [],
  choiceGroups: [],
  temporaryImageId: null,
  removeImage: false,
};

export function RevueltoForm({
  mode,
  revueltoId,
  ingredients,
  initialValues = emptyValues,
  initialImageUrl = null,
  hasExistingImage = false,
}: {
  mode: "create" | "edit";
  revueltoId?: string;
  ingredients: CatalogIngredient[];
  initialValues?: RevueltoFormInput;
  initialImageUrl?: string | null;
  hasExistingImage?: boolean;
}) {
  const router = useRouter();
  const imageFieldRef = useRef<TemporaryImageFieldHandle | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const { control, register, handleSubmit, getValues, setValue, formState: { errors, isSubmitting } } = useForm<RevueltoFormInput>({
    resolver: zodResolver(revueltoFormSchema),
    defaultValues: initialValues,
  });
  const kind = useWatch({ control, name: "kind" });
  const recipeIngredients = useWatch({ control, name: "recipeIngredients" });
  const choiceGroups = useWatch({ control, name: "choiceGroups" });
  const price = useWatch({ control, name: "price" });

  const handleImageIdChange = useCallback((imageId: string | null) => {
    setValue("temporaryImageId", imageId, { shouldValidate: true });
    if (imageId) setValue("removeImage", false, { shouldValidate: true });
  }, [setValue]);

  function toggleRecipeIngredient(ingredientId: string, checked: boolean) {
    const current = getValues("recipeIngredients");
    const next = checked
      ? [...current, { ingredientId, sortOrder: current.length, isRemovable: false }]
      : current.filter((item) => item.ingredientId !== ingredientId).map((item, index) => ({ ...item, sortOrder: index }));
    setValue("recipeIngredients", next, { shouldValidate: true });
  }

  function setRecipeRemovable(ingredientId: string, isRemovable: boolean) {
    const next = getValues("recipeIngredients").map((item) => item.ingredientId === ingredientId ? { ...item, isRemovable } : item);
    setValue("recipeIngredients", next, { shouldValidate: true });
  }

  function toggleChoiceOption(code: RevueltoFormInput["choiceGroups"][number]["code"], ingredientId: string, checked: boolean) {
    const next = getValues("choiceGroups").map((group) => {
      if (group.code !== code) return group;
      const options = checked
        ? [...group.options, { ingredientId, sortOrder: group.options.length }]
        : group.options.filter((option) => option.ingredientId !== ingredientId)
          .map((option, index) => ({ ...option, sortOrder: index }));
      return { ...group, options };
    });
    setValue("choiceGroups", next, { shouldValidate: true });
  }

  function configureKind(nextKind: "FIXED" | "CUSTOM") {
    setValue("kind", nextKind, { shouldValidate: true });
    setValue("choiceGroups", nextKind === "CUSTOM" ? customChoiceGroups() : [], { shouldValidate: true });
  }

  function enableBreakfastChoice(enabled: boolean) {
    setValue("choiceGroups", enabled ? breakfastChoiceGroup() : [], { shouldValidate: true });
  }

  async function save(values: RevueltoFormInput) {
    setFormMessage(null);
    try {
      const response = await fetch(
        mode === "create" ? "/admin/revueltos/manage" : `/admin/revueltos/manage/${revueltoId}`,
        {
          method: mode === "create" ? "POST" : "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(values),
        },
      );
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setFormMessage(result?.error ?? "No se pudo guardar el Revuelto.");
        return;
      }
      imageFieldRef.current?.commit();
      router.push(`/admin/revueltos?message=${mode === "create" ? "created" : "updated"}`);
      router.refresh();
    } catch {
      setFormMessage("No se pudo conectar con el servidor. Intentá nuevamente.");
    }
  }

  async function cancel() {
    await imageFieldRef.current?.discard();
    router.push("/admin/revueltos");
  }

  const disabled = isSubmitting || isUploading;
  const breakfastGroup = choiceGroups.find((group) => group.code === "breakfast-protein");

  return (
    <form className="admin-bowl-form admin-revuelto-form" onSubmit={(event) => void handleSubmit(save)(event)}>
      <div className="admin-form-grid">
        <label>
          Nombre
          <input {...register("name")} autoComplete="off" />
          {errors.name && <small>{errors.name.message}</small>}
        </label>
        <label>
          Tipo de Revuelto
          <select
            {...register("kind")}
            onChange={(event) => configureKind(event.target.value as "FIXED" | "CUSTOM")}
          >
            <option value="FIXED">Receta definida</option>
            <option value="CUSTOM">Tu Revuelto</option>
          </select>
        </label>
      </div>

      <label>
        Descripción
        <textarea {...register("description")} rows={4} />
        {errors.description && <small>{errors.description.message}</small>}
      </label>

      <div className="admin-form-grid">
        <label>
          Precio <span>(dejalo vacío hasta confirmarlo)</span>
          <input
            type="number"
            min="1"
            step="0.01"
            value={price ?? ""}
            onChange={(event) => setValue("price", event.target.value === "" ? null : Number(event.target.value), { shouldValidate: true })}
          />
          {errors.price && <small>{errors.price.message}</small>}
        </label>
        <label>
          Orden en la carta
          <input type="number" min="0" step="1" {...register("displayOrder", { valueAsNumber: true })} />
          {errors.displayOrder && <small>{errors.displayOrder.message}</small>}
        </label>
      </div>

      <TemporaryImageField
        ref={imageFieldRef}
        target="BOWL"
        label="Foto del Revuelto (opcional)"
        previewAlt="Previsualización del Revuelto"
        initialImageUrl={initialImageUrl}
        disabled={disabled}
        onImageIdChange={handleImageIdChange}
        onRemove={() => setValue("removeImage", hasExistingImage, { shouldValidate: true })}
        onBusyChange={setIsUploading}
        onError={setFormMessage}
      />

      <fieldset className="admin-recipe-fieldset">
        <legend>Ingredientes de la receta</legend>
        <p>Elegí los ingredientes que se muestran. Los de base quedan bloqueados y nunca se pueden quitar.</p>
        <div className="admin-ingredient-picker">
          {ingredientCategories.map((category) => {
            const categoryIngredients = ingredients.filter((ingredient) => ingredient.category === category.value);
            if (!categoryIngredients.length) return null;
            return (
              <section key={category.value} className="admin-ingredient-category">
                <h2>{category.label}</h2>
                {categoryIngredients.map((ingredient) => {
                  const selected = recipeIngredients.find((item) => item.ingredientId === ingredient.id);
                  const locked = ingredient.category === "BASE";
                  return (
                    <div className={`admin-recipe-ingredient${!ingredient.isActive ? " is-inactive" : ""}`} key={ingredient.id}>
                      <label className="admin-checkbox">
                        <input
                          type="checkbox"
                          checked={Boolean(selected)}
                          disabled={disabled || (!ingredient.isActive && !selected)}
                          onChange={(event) => toggleRecipeIngredient(ingredient.id, event.target.checked)}
                        />
                        {ingredient.name}{!ingredient.isActive ? " (inactivo)" : ""}
                      </label>
                      {selected && (
                        <label className="admin-checkbox admin-removable-toggle">
                          <input
                            type="checkbox"
                            checked={locked ? false : selected.isRemovable}
                            disabled={disabled || locked}
                            onChange={(event) => setRecipeRemovable(ingredient.id, event.target.checked)}
                          />
                          {locked ? "Bloqueado" : "El cliente puede quitarlo"}
                        </label>
                      )}
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>
        {errors.recipeIngredients && <small>{errors.recipeIngredients.message}</small>}
      </fieldset>

      {kind === "FIXED" ? (
        <fieldset className="admin-recipe-fieldset">
          <legend>Elección obligatoria (solo Buenos días, buenas tardes)</legend>
          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={Boolean(breakfastGroup)}
              disabled={disabled}
              onChange={(event) => enableBreakfastChoice(event.target.checked)}
            />
            El cliente tiene que elegir exactamente una opción entre jamón y panceta
          </label>
          {breakfastGroup && (
            <div className="admin-choice-options">
              {ingredients.filter((ingredient) => ingredient.category === "PROTEIN").map((ingredient) => (
                <label className="admin-checkbox" key={ingredient.id}>
                  <input
                    type="checkbox"
                    checked={breakfastGroup.options.some((option) => option.ingredientId === ingredient.id)}
                    disabled={disabled || (!ingredient.isActive && !breakfastGroup.options.some((option) => option.ingredientId === ingredient.id))}
                    onChange={(event) => toggleChoiceOption("breakfast-protein", ingredient.id, event.target.checked)}
                  />
                  {ingredient.name}{!ingredient.isActive ? " (inactivo)" : ""}
                </label>
              ))}
              <p>Seleccioná las dos alternativas del catálogo. El cliente elegirá una sola.</p>
            </div>
          )}
          {errors.choiceGroups && <small>{errors.choiceGroups.message}</small>}
        </fieldset>
      ) : (
        <fieldset className="admin-recipe-fieldset">
          <legend>Opciones de Tu Revuelto</legend>
          <p>Los límites de cada grupo están fijados por la carta. Elegí qué ingredientes activos estarán disponibles.</p>
          <div className="admin-choice-groups">
            {choiceGroups.map((group) => (
              <section className="admin-choice-group" key={group.code}>
                <h2>{group.label}</h2>
                {ingredients.filter((ingredient) => ingredient.category === group.category).map((ingredient) => (
                  <label className="admin-checkbox" key={ingredient.id}>
                    <input
                      type="checkbox"
                      checked={group.options.some((option) => option.ingredientId === ingredient.id)}
                      disabled={disabled || (!ingredient.isActive && !group.options.some((option) => option.ingredientId === ingredient.id))}
                      onChange={(event) => toggleChoiceOption(group.code, ingredient.id, event.target.checked)}
                    />
                    {ingredient.name}{!ingredient.isActive ? " (inactivo)" : ""}
                  </label>
                ))}
              </section>
            ))}
          </div>
          {errors.choiceGroups && <small>{errors.choiceGroups.message}</small>}
        </fieldset>
      )}

      <label className="admin-checkbox">
        <input type="checkbox" {...register("isVisibleInNewMenu")} />
        Visible en la nueva carta
      </label>
      <p className="admin-field-help">Esta visibilidad controla exclusivamente la carta pública nueva de Revueltos.</p>
      {formMessage && <p className="form-message" role="status">{formMessage}</p>}
      <div className="admin-form-actions">
        <button type="submit" disabled={disabled}>{isSubmitting ? "Guardando…" : "Guardar Revuelto"}</button>
        <button type="button" onClick={cancel} disabled={disabled}>Cancelar</button>
      </div>
    </form>
  );
}

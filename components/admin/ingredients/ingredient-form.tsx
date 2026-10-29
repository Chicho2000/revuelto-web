"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { ingredientCategories, ingredientFormSchema, type IngredientFormInput } from "@/lib/ingredients/schema";

const emptyValues: IngredientFormInput = {
  name: "",
  category: "OTHER",
  isActive: true,
};

export function IngredientForm({
  mode,
  ingredientId,
  initialValues = emptyValues,
}: {
  mode: "create" | "edit";
  ingredientId?: string;
  initialValues?: IngredientFormInput;
}) {
  const router = useRouter();
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<IngredientFormInput>({
    resolver: zodResolver(ingredientFormSchema),
    defaultValues: initialValues,
  });

  async function save(values: IngredientFormInput) {
    setFormMessage(null);
    try {
      const response = await fetch(
        mode === "create" ? "/admin/ingredients/manage" : `/admin/ingredients/manage/${ingredientId}`,
        {
          method: mode === "create" ? "POST" : "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(values),
        },
      );
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setFormMessage(result?.error ?? "No se pudo guardar el ingrediente.");
        return;
      }
      router.push(`/admin/ingredients?message=${mode === "create" ? "created" : "updated"}`);
      router.refresh();
    } catch {
      setFormMessage("No se pudo guardar el ingrediente. Intentá nuevamente.");
    }
  }

  function cancel() { router.push("/admin/ingredients"); }

  return (
    <form className="admin-bowl-form admin-merchandise-form" onSubmit={(event) => void handleSubmit(save)(event)}>
      <div className="admin-form-grid">
        <label>
          Nombre
          <input {...register("name")} autoComplete="off" />
          {errors.name && <small>{errors.name.message}</small>}
        </label>
        <label>
          Categoría
          <select {...register("category")}>
            {ingredientCategories.map((category) => (
              <option key={category.value} value={category.value}>{category.label}</option>
            ))}
          </select>
          {errors.category && <small>{errors.category.message}</small>}
        </label>
      </div>

      <label className="admin-checkbox">
        <input type="checkbox" {...register("isActive")} />
        Ingrediente activo
      </label>
      <p>Los cambios de nombre se reflejarán en todos los productos que usen este ingrediente.</p>
      {formMessage && <p className="form-message" role="status">{formMessage}</p>}
      <div className="admin-form-actions">
        <button type="submit" disabled={isSubmitting}>{isSubmitting ? "Guardando…" : "Guardar"}</button>
        <button type="button" onClick={cancel} disabled={isSubmitting}>Cancelar</button>
      </div>
    </form>
  );
}

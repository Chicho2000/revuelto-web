"use client";

import { useCallback, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { TemporaryImageField, type TemporaryImageFieldHandle } from "@/components/admin/temporary-image-field";
import { ingredientCategories, ingredientFormSchema, type IngredientFormInput } from "@/lib/ingredients/schema";

const emptyValues: IngredientFormInput = {
  name: "",
  category: "OTHER",
  isActive: true,
  temporaryImageId: null,
  removeImage: false,
};

export function IngredientForm({
  mode,
  ingredientId,
  initialValues = emptyValues,
  initialImageUrl = null,
  hasExistingImage = false,
}: {
  mode: "create" | "edit";
  ingredientId?: string;
  initialValues?: IngredientFormInput;
  initialImageUrl?: string | null;
  hasExistingImage?: boolean;
}) {
  const router = useRouter();
  const imageFieldRef = useRef<TemporaryImageFieldHandle | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<IngredientFormInput>({
    resolver: zodResolver(ingredientFormSchema),
    defaultValues: initialValues,
  });

  const handleImageIdChange = useCallback((imageId: string | null) => {
    setValue("temporaryImageId", imageId, { shouldValidate: true });
    if (imageId) setValue("removeImage", false, { shouldValidate: true });
  }, [setValue]);

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
      imageFieldRef.current?.commit();
      router.push(`/admin/ingredients?message=${mode === "create" ? "created" : "updated"}`);
      router.refresh();
    } catch {
      setFormMessage("No se pudo guardar el ingrediente. Intentá nuevamente.");
    }
  }

  async function cancel() {
    await imageFieldRef.current?.discard();
    router.push("/admin/ingredients");
  }

  const disabled = isSubmitting || isUploading;
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

      <TemporaryImageField
        ref={imageFieldRef}
        target="INGREDIENT"
        label="Imagen del ingrediente (opcional)"
        previewAlt="Previsualización del ingrediente"
        initialImageUrl={initialImageUrl}
        disabled={isSubmitting}
        onImageIdChange={handleImageIdChange}
        onRemove={() => setValue("removeImage", hasExistingImage, { shouldValidate: true })}
        onBusyChange={setIsUploading}
        onError={setFormMessage}
      />
      {errors.temporaryImageId && <small>{errors.temporaryImageId.message}</small>}
      {errors.removeImage && <small>{errors.removeImage.message}</small>}

      <label className="admin-checkbox">
        <input type="checkbox" {...register("isActive")} />
        Ingrediente activo
      </label>
      <p>Los cambios de nombre e imagen se reflejarán en todos los Revueltos que usen este ingrediente.</p>
      {formMessage && <p className="form-message" role="status">{formMessage}</p>}
      <div className="admin-form-actions">
        <button type="submit" disabled={disabled}>{isSubmitting ? "Guardando…" : "Guardar"}</button>
        <button type="button" onClick={cancel} disabled={disabled}>Cancelar</button>
      </div>
    </form>
  );
}

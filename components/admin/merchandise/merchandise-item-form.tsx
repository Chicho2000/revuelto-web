"use client";

import { useCallback, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import {
  TemporaryImageField,
  type TemporaryImageFieldHandle,
} from "@/components/admin/temporary-image-field";
import {
  merchandiseItemFormSchema,
  type MerchandiseItemFormInput,
} from "@/lib/merchandise/schema";

const emptyValues: MerchandiseItemFormInput = {
  name: "",
  description: "",
  price: 0,
  sortOrder: 0,
  isActive: true,
  temporaryImageId: null,
};

export function MerchandiseItemForm({
  mode,
  itemId,
  initialValues = emptyValues,
  initialImageUrl = null,
}: {
  mode: "create" | "edit";
  itemId?: string;
  initialValues?: MerchandiseItemFormInput;
  initialImageUrl?: string | null;
}) {
  const router = useRouter();
  const imageFieldRef = useRef<TemporaryImageFieldHandle | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<MerchandiseItemFormInput>({
    resolver: zodResolver(merchandiseItemFormSchema),
    defaultValues: initialValues,
  });

  const handleImageIdChange = useCallback((imageId: string | null) => {
    setValue("temporaryImageId", imageId, { shouldValidate: true });
  }, [setValue]);

  async function save(values: MerchandiseItemFormInput) {
    setFormMessage(null);
    if (mode === "create" && !values.temporaryImageId) {
      setError("temporaryImageId", { message: "La imagen es obligatoria." });
      return;
    }

    const response = await fetch(
      mode === "create" ? "/admin/merchandise/manage" : `/admin/merchandise/manage/${itemId}`,
      {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      },
    );
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setFormMessage(result?.error ?? "No se pudo guardar el producto.");
      return;
    }

    imageFieldRef.current?.commit();
    router.push(`/admin/merchandise?message=${mode === "create" ? "created" : "updated"}`);
    router.refresh();
  }

  async function cancel() {
    await imageFieldRef.current?.discard();
    router.push("/admin/merchandise");
  }

  const disabled = isSubmitting || isUploading;

  return (
    <form className="admin-bowl-form admin-merchandise-form" onSubmit={(event) => void handleSubmit(save)(event)}>
      <label>
        Nombre
        <input {...register("name")} autoComplete="off" />
        {errors.name && <small>{errors.name.message}</small>}
      </label>
      <label>
        Descripción <span>(opcional)</span>
        <textarea {...register("description")} rows={5} />
        {errors.description && <small>{errors.description.message}</small>}
      </label>
      <div className="admin-form-grid">
        <label>
          Precio
          <input type="number" min="0.01" step="0.01" {...register("price", { valueAsNumber: true })} />
          {errors.price && <small>{errors.price.message}</small>}
        </label>
        <label>
          Orden
          <input type="number" {...register("sortOrder", { valueAsNumber: true })} />
          <small>Los números menores aparecen primero.</small>
          {errors.sortOrder && <small>{errors.sortOrder.message}</small>}
        </label>
      </div>

      <TemporaryImageField
        ref={imageFieldRef}
        target="MERCHANDISE"
        label="Imagen del producto"
        previewAlt="Previsualización del producto"
        initialImageUrl={initialImageUrl}
        allowRemove={false}
        disabled={isSubmitting}
        onImageIdChange={handleImageIdChange}
        onRemove={() => undefined}
        onBusyChange={setIsUploading}
        onError={setFormMessage}
      />
      {errors.temporaryImageId && <small>{errors.temporaryImageId.message}</small>}

      <label className="admin-checkbox">
        <input type="checkbox" {...register("isActive")} />
        Producto activo
      </label>

      {formMessage && <p className="form-message" role="status">{formMessage}</p>}
      <div className="admin-form-actions">
        <button type="submit" disabled={disabled}>{isSubmitting ? "Guardando…" : "Guardar"}</button>
        <button type="button" onClick={cancel} disabled={disabled}>Cancelar</button>
      </div>
    </form>
  );
}

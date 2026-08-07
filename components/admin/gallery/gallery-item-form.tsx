"use client";

import { useCallback, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import {
  TemporaryImageField,
  type TemporaryImageFieldHandle,
} from "@/components/admin/temporary-image-field";
import {
  galleryItemFormSchema,
  type GalleryItemFormInput,
} from "@/lib/gallery/schema";

const emptyValues: GalleryItemFormInput = {
  type: "IMAGE",
  title: "",
  description: "",
  externalUrl: "",
  sortOrder: 0,
  isActive: true,
  temporaryImageId: null,
};

export function GalleryItemForm({
  mode,
  galleryItemId,
  initialValues = emptyValues,
  initialImageUrl = null,
}: {
  mode: "create" | "edit";
  galleryItemId?: string;
  initialValues?: GalleryItemFormInput;
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
    control,
    formState: { errors, isSubmitting },
  } = useForm<GalleryItemFormInput>({
    resolver: zodResolver(galleryItemFormSchema),
    defaultValues: initialValues,
  });
  const type = useWatch({ control, name: "type" });

  const handleImageIdChange = useCallback((imageId: string | null) => {
    setValue("temporaryImageId", imageId, { shouldValidate: true });
  }, [setValue]);

  async function save(values: GalleryItemFormInput) {
    setFormMessage(null);
    if (mode === "create" && !values.temporaryImageId) {
      setError("temporaryImageId", { message: "La imagen o miniatura es obligatoria." });
      return false;
    }

    const response = await fetch(
      mode === "create"
        ? "/admin/content/gallery/manage"
        : `/admin/content/gallery/manage/${galleryItemId}`,
      {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      },
    );
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setFormMessage(result?.error ?? "No se pudo guardar el elemento.");
      return false;
    }

    imageFieldRef.current?.commit();
    router.push(`/admin/content/gallery?message=${mode === "create" ? "created" : "updated"}`);
    router.refresh();
  }

  async function cancel() {
    await imageFieldRef.current?.discard();
    router.push("/admin/content/gallery");
  }

  const disabled = isSubmitting || isUploading;
  const isVideo = type === "INSTAGRAM_VIDEO";

  return (
    <form className="admin-bowl-form admin-gallery-form" onSubmit={(event) => void handleSubmit(save)(event)}>
      <label>
        Tipo
        <select {...register("type")}>
          <option value="IMAGE">Imagen</option>
          <option value="INSTAGRAM_VIDEO">Video de Instagram</option>
        </select>
        {errors.type && <small>{errors.type.message}</small>}
      </label>
      <label>
        Título <span>(opcional)</span>
        <input {...register("title")} autoComplete="off" />
        {errors.title && <small>{errors.title.message}</small>}
      </label>
      <label>
        Descripción <span>(opcional)</span>
        <textarea {...register("description")} rows={5} />
        {errors.description && <small>{errors.description.message}</small>}
      </label>

      <TemporaryImageField
        ref={imageFieldRef}
        target="GALLERY"
        label={isVideo ? "Miniatura del video" : "Imagen de la galería"}
        previewAlt="Previsualización del elemento"
        initialImageUrl={initialImageUrl}
        allowRemove={false}
        disabled={isSubmitting}
        onImageIdChange={handleImageIdChange}
        onRemove={() => undefined}
        onBusyChange={setIsUploading}
        onError={setFormMessage}
        showPlayIndicator={isVideo}
      />
      {isVideo && <p className="admin-field-help">Subí una miniatura. El video no se aloja ni se reproduce en Revuelto.</p>}
      {errors.temporaryImageId && <small>{errors.temporaryImageId.message}</small>}

      <label>
        {isVideo ? "URL de la publicación o Reel de Instagram" : "Enlace externo (opcional)"}
        <input type="url" {...register("externalUrl")} placeholder="https://…" autoComplete="url" />
        {errors.externalUrl && <small>{errors.externalUrl.message}</small>}
      </label>
      <label>
        Orden
        <input type="number" {...register("sortOrder", { valueAsNumber: true })} />
        <small>Los números menores aparecen primero.</small>
        {errors.sortOrder && <small>{errors.sortOrder.message}</small>}
      </label>
      <label className="admin-checkbox">
        <input type="checkbox" {...register("isActive")} />
        Elemento activo
      </label>

      {formMessage && <p className="form-message" role="status">{formMessage}</p>}
      <div className="admin-form-actions">
        <button type="submit" disabled={disabled}>{isSubmitting ? "Guardando…" : "Guardar"}</button>
        <button type="button" onClick={cancel} disabled={disabled}>Cancelar</button>
      </div>
    </form>
  );
}

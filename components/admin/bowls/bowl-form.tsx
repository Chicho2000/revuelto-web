"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  TemporaryImageField,
  type TemporaryImageFieldHandle,
} from "@/components/admin/temporary-image-field";
import { BowlInput, bowlInputSchema, slugifyBowlName } from "@/lib/bowls/schema";

const emptyValues: BowlInput = {
  name: "",
  slug: "",
  description: "",
  isActive: true,
  temporaryImageId: null,
  sizes: {
    SMALL: { price: 0 },
    LARGE: { price: 0 },
  },
};

export function BowlForm({
  mode,
  bowlId,
  initialValues = emptyValues,
  initialImageUrl = null,
}: {
  mode: "create" | "edit";
  bowlId?: string;
  initialValues?: BowlInput;
  initialImageUrl?: string | null;
}) {
  const router = useRouter();
  const imageFieldRef = useRef<TemporaryImageFieldHandle | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<BowlInput>({
    resolver: zodResolver(bowlInputSchema),
    defaultValues: initialValues,
  });

  const handleImageIdChange = useCallback((imageId: string | null) => {
    setValue("temporaryImageId", imageId, { shouldValidate: true });
  }, [setValue]);

  async function save(values: BowlInput) {
    setFormMessage(null);
    const url = mode === "create" ? "/admin/bowls/manage" : `/admin/bowls/manage/${bowlId}`;
    const response = await fetch(url, {
      method: mode === "create" ? "POST" : "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setFormMessage(result?.error ?? "No se pudo guardar el bowl.");
      return;
    }

    imageFieldRef.current?.commit();
    setValue("temporaryImageId", null);
    router.push(`/admin/bowls?message=${mode === "create" ? "created" : "updated"}`);
    router.refresh();
  }

  async function cancel() {
    await imageFieldRef.current?.discard();
    router.push("/admin/bowls");
  }

  const disabled = isSubmitting || isUploading;

  return (
    <form
      className="admin-bowl-form"
      onSubmit={(event) => {
        void handleSubmit(save)(event);
      }}
    >
      <div className="admin-form-grid">
        <label>
          Nombre
          <input {...register("name")} autoComplete="off" />
          {errors.name && <small>{errors.name.message}</small>}
        </label>
        <label>
          Slug
          <div className="slug-control">
            <input {...register("slug")} autoComplete="off" />
            <button
              type="button"
              onClick={() => setValue("slug", slugifyBowlName(getValues("name")), { shouldValidate: true })}
            >
              Generar
            </button>
          </div>
          {errors.slug && <small>{errors.slug.message}</small>}
        </label>
      </div>

      <label>
        Descripción <span>(opcional)</span>
        <textarea {...register("description")} rows={5} />
        {errors.description && <small>{errors.description.message}</small>}
      </label>

      <fieldset className="admin-size-fieldset">
        <legend>Precios por tamaño</legend>
        <div className="admin-size-grid">
          <label>
            <strong>SMALL</strong>
            <span>25 oz</span>
            Precio
            <input
              {...register("sizes.SMALL.price", { valueAsNumber: true })}
              type="number"
              min="0.01"
              step="0.01"
            />
            {errors.sizes?.SMALL?.price && <small>{errors.sizes.SMALL.price.message}</small>}
          </label>
          <label>
            <strong>LARGE</strong>
            <span>35 oz</span>
            Precio
            <input
              {...register("sizes.LARGE.price", { valueAsNumber: true })}
              type="number"
              min="0.01"
              step="0.01"
            />
            {errors.sizes?.LARGE?.price && <small>{errors.sizes.LARGE.price.message}</small>}
          </label>
        </div>
      </fieldset>

      <TemporaryImageField
        ref={imageFieldRef}
        target="BOWL"
        label="Imagen del bowl"
        previewAlt="Previsualización del bowl"
        initialImageUrl={initialImageUrl}
        allowRemove={false}
        disabled={isSubmitting}
        onImageIdChange={handleImageIdChange}
        onRemove={() => undefined}
        onBusyChange={setIsUploading}
        onError={setFormMessage}
      />

      <label className="admin-checkbox">
        <input type="checkbox" {...register("isActive")} />
        Bowl activo y visible en la carta
      </label>

      {formMessage && <p className="form-message">{formMessage}</p>}

      <div className="admin-form-actions">
        <button type="submit" disabled={disabled}>
          {isSubmitting ? "Guardando…" : "Guardar"}
        </button>
        <button type="button" onClick={cancel} disabled={disabled}>Cancelar</button>
      </div>
    </form>
  );
}

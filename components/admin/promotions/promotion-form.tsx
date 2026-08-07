"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  TemporaryImageField,
  type TemporaryImageFieldHandle,
} from "@/components/admin/temporary-image-field";
import {
  PROMOTION_DAY_LABELS,
  PROMOTION_DAYS,
  type PromotionFormInput,
  promotionFormSchema,
} from "@/lib/promotions/schema";

const emptyValues: PromotionFormInput = {
  title: "",
  body: "",
  weeklyDays: [],
  dailyStartTime: "",
  dailyEndTime: "",
  isActive: true,
  temporaryImageId: null,
  removeImage: false,
};

export function PromotionForm({
  mode,
  promotionId,
  initialValues = emptyValues,
  initialImageUrl = null,
}: {
  mode: "create" | "edit";
  promotionId?: string;
  initialValues?: PromotionFormInput;
  initialImageUrl?: string | null;
}) {
  const router = useRouter();
  const imageFieldRef = useRef<TemporaryImageFieldHandle | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PromotionFormInput>({
    resolver: zodResolver(promotionFormSchema),
    defaultValues: initialValues,
  });

  const handleImageIdChange = useCallback((imageId: string | null) => {
    setValue("temporaryImageId", imageId, { shouldValidate: true });
    if (imageId) setValue("removeImage", false, { shouldValidate: true });
  }, [setValue]);
  const handleRemoveImage = useCallback(() => {
    setValue("temporaryImageId", null, { shouldValidate: true });
    setValue("removeImage", true, { shouldValidate: true });
  }, [setValue]);

  async function save(values: PromotionFormInput) {
    setFormMessage(null);
    const url = mode === "create"
      ? "/admin/promotions/manage"
      : `/admin/promotions/manage/${promotionId}`;
    const response = await fetch(url, {
      method: mode === "create" ? "POST" : "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setFormMessage(result?.error ?? "No se pudo guardar la promoción.");
      return;
    }

    imageFieldRef.current?.commit();
    router.push(`/admin/promotions?message=${mode === "create" ? "created" : "updated"}`);
    router.refresh();
  }

  async function cancel() {
    await imageFieldRef.current?.discard();
    router.push("/admin/promotions");
  }

  const disabled = isSubmitting || isUploading;

  return (
    <form
      className="admin-bowl-form admin-promotion-form"
      onSubmit={(event) => {
        void handleSubmit(save)(event);
      }}
    >
      <label>
        Título
        <input {...register("title")} autoComplete="off" />
        {errors.title && <small>{errors.title.message}</small>}
      </label>

      <label>
        Cuerpo
        <textarea {...register("body")} rows={6} />
        {errors.body && <small>{errors.body.message}</small>}
      </label>

      <fieldset className="admin-schedule-fieldset">
        <legend>Programación semanal <span>(opcional)</span></legend>
        <p>Elegí días y, si querés, una franja horaria de Argentina. Sin días, la franja se aplica todos los días.</p>
        <div className="admin-promotion-days">
          {PROMOTION_DAYS.map((day) => (
            <label className="admin-checkbox" key={day}>
              <input type="checkbox" value={day} {...register("weeklyDays")} />
              {PROMOTION_DAY_LABELS[day]}
            </label>
          ))}
        </div>
        {errors.weeklyDays && <small>{errors.weeklyDays.message}</small>}
        <div className="admin-form-grid">
          <label>
            Desde
            <input type="time" {...register("dailyStartTime")} />
            {errors.dailyStartTime && <small>{errors.dailyStartTime.message}</small>}
          </label>
          <label>
            Hasta
            <input type="time" {...register("dailyEndTime")} />
            {errors.dailyEndTime && <small>{errors.dailyEndTime.message}</small>}
          </label>
        </div>
      </fieldset>

      <TemporaryImageField
        ref={imageFieldRef}
        target="PROMOTION"
        label="Imagen de la promoción"
        previewAlt="Previsualización de la promoción"
        initialImageUrl={initialImageUrl}
        disabled={isSubmitting}
        onImageIdChange={handleImageIdChange}
        onRemove={handleRemoveImage}
        onBusyChange={setIsUploading}
        onError={setFormMessage}
      />

      <label className="admin-checkbox">
        <input type="checkbox" {...register("isActive")} />
        Promoción activa
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

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import {
  BRANCH_DAY_LABELS,
  BranchInput,
  branchInputSchema,
  createClosedBranchSchedules,
} from "@/lib/branches/schema";

const emptyBranchValues: BranchInput = {
  name: "",
  address: "",
  city: "",
  phone: "",
  isActive: true,
  schedules: createClosedBranchSchedules(),
};

export function BranchForm({
  mode,
  branchId,
  initialValues = emptyBranchValues,
}: {
  mode: "create" | "edit";
  branchId?: string;
  initialValues?: BranchInput;
}) {
  const router = useRouter();
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<BranchInput>({
    resolver: zodResolver(branchInputSchema),
    defaultValues: initialValues,
  });
  const schedules = useWatch({ control, name: "schedules" });

  async function save(values: BranchInput) {
    setFormMessage(null);
    const url = mode === "create" ? "/admin/branches/manage" : `/admin/branches/manage/${branchId}`;
    const response = await fetch(url, {
      method: mode === "create" ? "POST" : "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setFormMessage(result?.error ?? "No se pudo guardar la sucursal.");
      return;
    }

    router.push(`/admin/branches?message=${mode === "create" ? "created" : "updated"}`);
    router.refresh();
  }

  return (
    <form className="admin-branch-form" onSubmit={handleSubmit(save)}>
      <div className="admin-form-grid">
        <label>
          Nombre
          <input {...register("name")} autoComplete="organization" />
          {errors.name && <small>{errors.name.message}</small>}
        </label>
        <label>
          Ciudad
          <input {...register("city")} autoComplete="address-level2" />
          {errors.city && <small>{errors.city.message}</small>}
        </label>
      </div>

      <label>
        Dirección
        <input {...register("address")} autoComplete="street-address" />
        {errors.address && <small>{errors.address.message}</small>}
      </label>

      <label>
        Teléfono <span>(opcional)</span>
        <input {...register("phone")} type="tel" autoComplete="tel" />
        {errors.phone && <small>{errors.phone.message}</small>}
      </label>

      <fieldset className="admin-schedule-fieldset">
        <legend>Horarios</legend>
        <div className="admin-schedule-list">
          {initialValues.schedules.map((schedule, index) => {
            const isOpen = Boolean(schedules?.[index]?.isOpen);
            const openRegistration = register(`schedules.${index}.isOpen`);
            return (
              <div className="admin-schedule-row" key={schedule.dayOfWeek}>
                <input type="hidden" {...register(`schedules.${index}.dayOfWeek`)} />
                <strong>{BRANCH_DAY_LABELS[schedule.dayOfWeek]}</strong>
                <label className="admin-checkbox admin-schedule-open">
                  <input
                    type="checkbox"
                    {...openRegistration}
                    onChange={(event) => {
                      void openRegistration.onChange(event);
                      if (!event.target.checked) {
                        setValue(`schedules.${index}.openTime`, "", { shouldValidate: true });
                        setValue(`schedules.${index}.closeTime`, "", { shouldValidate: true });
                      }
                    }}
                  />
                  Abierto
                </label>
                <label>
                  Apertura
                  <input
                    type="time"
                    {...register(`schedules.${index}.openTime`)}
                    disabled={!isOpen}
                  />
                  {errors.schedules?.[index]?.openTime && (
                    <small>{errors.schedules[index].openTime.message}</small>
                  )}
                </label>
                <label>
                  Cierre
                  <input
                    type="time"
                    {...register(`schedules.${index}.closeTime`)}
                    disabled={!isOpen}
                  />
                  {errors.schedules?.[index]?.closeTime && (
                    <small>{errors.schedules[index].closeTime.message}</small>
                  )}
                </label>
              </div>
            );
          })}
        </div>
      </fieldset>

      <label className="admin-checkbox">
        <input type="checkbox" {...register("isActive")} />
        Sucursal activa y visible en la web
      </label>

      {formMessage && <p className="form-message">{formMessage}</p>}

      <div className="admin-form-actions">
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Guardando…" : "Guardar"}
        </button>
        <button type="button" onClick={() => router.push("/admin/branches")} disabled={isSubmitting}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

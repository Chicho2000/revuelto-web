"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useState } from "react";
import {
  siteContentFormSchema,
  type SiteContentInput,
} from "@/lib/content/schema";
import { submitContentDraft } from "@/lib/content/workflow";

type TextFieldName = Exclude<
  keyof SiteContentInput,
  "whatsappEnabled" | "orderingEnabled" | "cashEnabled" | "transferEnabled" | "mercadoPagoEnabled"
>;

const sections: Array<{
  title: string;
  fields: Array<{ name: TextFieldName; label: string; multiline?: boolean }>;
}> = [
  { title: "Hero", fields: [
    { name: "heroTitle", label: "Título principal" },
    { name: "heroSubtitle", label: "Antetítulo" },
    { name: "heroDescription", label: "Descripción", multiline: true },
    { name: "heroButtonText", label: "Texto del botón" },
    { name: "heroButtonUrl", label: "Destino del botón" },
  ] },
  { title: "Marca", fields: [
    { name: "brandTitle", label: "Título" },
    { name: "brandDescription", label: "Descripción", multiline: true },
  ] },
  { title: "Carta", fields: [
    { name: "menuSectionTitle", label: "Título" },
    { name: "menuSectionDescription", label: "Descripción", multiline: true },
  ] },
  { title: "Promociones", fields: [
    { name: "promotionsSectionTitle", label: "Título" },
    { name: "promotionsSectionDescription", label: "Descripción", multiline: true },
  ] },
  { title: "Sucursales", fields: [
    { name: "branchesSectionTitle", label: "Título" },
    { name: "branchesSectionDescription", label: "Descripción", multiline: true },
  ] },
  { title: "Galería", fields: [
    { name: "gallerySectionTitle", label: "Título" },
    { name: "gallerySectionDescription", label: "Descripción", multiline: true },
  ] },
  { title: "WhatsApp", fields: [
    { name: "whatsappNumber", label: "Número" },
    { name: "whatsappButtonText", label: "Texto del botón" },
    { name: "whatsappDefaultMessage", label: "Mensaje predeterminado", multiline: true },
  ] },
  { title: "Redes sociales", fields: [
    { name: "instagramUrl", label: "URL de Instagram" },
    { name: "tiktokUrl", label: "URL de TikTok" },
  ] },
  { title: "Footer", fields: [
    { name: "footerText", label: "Texto" },
  ] },
  { title: "SEO", fields: [
    { name: "seoTitle", label: "Título SEO" },
    { name: "seoDescription", label: "Descripción SEO", multiline: true },
  ] },
];

export function SiteContentForm({ initialValues }: { initialValues: SiteContentInput }) {
  const router = useRouter();
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SiteContentInput>({
    resolver: zodResolver(siteContentFormSchema),
    defaultValues: initialValues,
  });
  async function save(values: SiteContentInput) {
    setFormMessage(null);
    const result = await submitContentDraft(values, async (draft) => {
      const response = await fetch("/admin/content/manage", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? "No se pudieron guardar los cambios.");
    });

    if (result.error) {
      setFormMessage(result.error);
      return;
    }
    router.push("/admin/content?message=updated");
    router.refresh();
  }

  return (
    <form className="admin-bowl-form admin-content-form" onSubmit={(event) => void handleSubmit(save)(event)}>
      {sections.map((section) => (
        <fieldset className="admin-content-section" key={section.title}>
          <legend>{section.title}</legend>
          <div className="admin-form-grid">
            {section.fields.map((field) => (
              <label key={field.name}>
                {field.label}
                {field.multiline
                  ? <textarea {...register(field.name)} rows={4} />
                  : <input {...register(field.name)} autoComplete="off" />}
                {errors[field.name] && <small>{errors[field.name]?.message}</small>}
              </label>
            ))}
          </div>
          {section.title === "WhatsApp" && (
            <label className="admin-checkbox admin-content-toggle">
              <input type="checkbox" {...register("whatsappEnabled")} />
              Mostrar botón de WhatsApp
            </label>
          )}
        </fieldset>
      ))}

      <fieldset className="admin-content-section">
        <legend>Pedidos web</legend>
        <div className="admin-form-grid">
          <label className="admin-checkbox admin-content-toggle">
            <input type="checkbox" {...register("orderingEnabled")} />
            Habilitar pedidos desde la web
          </label>
          <label className="admin-checkbox admin-content-toggle">
            <input type="checkbox" {...register("cashEnabled")} />
            Permitir efectivo
          </label>
          <label className="admin-checkbox admin-content-toggle">
            <input type="checkbox" {...register("transferEnabled")} />
            Permitir transferencia
          </label>
          <label className="admin-checkbox admin-content-toggle">
            <input type="checkbox" {...register("mercadoPagoEnabled")} />
            Solicitar Mercado Pago cuando la integración esté disponible
          </label>
        </div>
        <p className="admin-field-help">
          Mercado Pago todavía no está conectado. Aunque se marque, no aparecerá públicamente hasta completar credenciales, Checkout Pro y webhook.
        </p>
      </fieldset>

      {formMessage && <p className="form-message" role="status" aria-live="polite">{formMessage}</p>}
      <div className="admin-form-actions">
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}

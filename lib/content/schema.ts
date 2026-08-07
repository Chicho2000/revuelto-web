import { z } from "zod";

export const SITE_CONTENT_KEY = "site-config";

const optionalText = (maximum: number) => z.string().trim().max(maximum);

function isSafePageUrl(value: string) {
  if (!value) return true;
  if (value.startsWith("/")) {
    return !value.startsWith("//") && !value.includes("\\") && !/[\u0000-\u001F]/.test(value);
  }
  if (value.startsWith("#")) return /^#[A-Za-z][A-Za-z0-9_:-]*$/.test(value);
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isOfficialSocialUrl(value: string, service: "instagram" | "tiktok") {
  if (!value) return true;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
    const hostname = url.hostname.toLowerCase();
    return service === "instagram"
      ? ["instagram.com", "www.instagram.com"].includes(hostname)
      : ["tiktok.com", "www.tiktok.com"].includes(hostname);
  } catch {
    return false;
  }
}

export const siteContentFormSchema = z
  .object({
    heroTitle: z.string().trim().min(1, "El título principal es obligatorio.").max(160),
    heroSubtitle: optionalText(160),
    heroDescription: optionalText(1000),
    heroButtonText: optionalText(80),
    heroButtonUrl: optionalText(500).refine(isSafePageUrl, "Usá una ruta interna o una URL HTTPS válida."),
    brandTitle: optionalText(160),
    brandDescription: optionalText(1500),
    menuSectionTitle: optionalText(160),
    menuSectionDescription: optionalText(600),
    promotionsSectionTitle: optionalText(160),
    promotionsSectionDescription: optionalText(600),
    branchesSectionTitle: optionalText(160),
    branchesSectionDescription: optionalText(600),
    gallerySectionTitle: optionalText(160),
    gallerySectionDescription: optionalText(600),
    whatsappNumber: optionalText(40).refine(
      (value) => !value || /^\+?[0-9 ()-]+$/.test(value),
      "Ingresá un número de WhatsApp válido.",
    ),
    whatsappButtonText: optionalText(80),
    whatsappDefaultMessage: optionalText(500),
    whatsappEnabled: z.boolean(),
    instagramUrl: optionalText(500).refine(
      (value) => isOfficialSocialUrl(value, "instagram"),
      "Usá una URL HTTPS oficial de Instagram.",
    ),
    tiktokUrl: optionalText(500).refine(
      (value) => isOfficialSocialUrl(value, "tiktok"),
      "Usá una URL HTTPS oficial de TikTok.",
    ),
    footerText: optionalText(300),
    seoTitle: optionalText(70),
    seoDescription: optionalText(170),
  })
  .strict()
  .superRefine((content, context) => {
    if (content.whatsappEnabled && !content.whatsappNumber) {
      context.addIssue({
        code: "custom",
        path: ["whatsappNumber"],
        message: "Ingresá un número para habilitar WhatsApp.",
      });
    }
  });

export type SiteContentInput = z.infer<typeof siteContentFormSchema>;

export const DEFAULT_SITE_CONTENT: SiteContentInput = {
  heroTitle: "Fresco, nutritivo, resuelto.",
  heroSubtitle: "Bowls de huevos revueltos",
  heroDescription: "Recetas fijas, frescas y llenas de sabor.",
  heroButtonText: "",
  heroButtonUrl: "",
  brandTitle: "Hecho para resolver",
  brandDescription: "",
  menuSectionTitle: "Un tamaño para cada hambre.",
  menuSectionDescription: "",
  promotionsSectionTitle: "Un mimo para volver.",
  promotionsSectionDescription: "",
  branchesSectionTitle: "Pasá a buscar el tuyo.",
  branchesSectionDescription: "",
  gallerySectionTitle: "Momentos bien revueltos.",
  gallerySectionDescription: "",
  whatsappNumber: "",
  whatsappButtonText: "Escribinos por WhatsApp",
  whatsappDefaultMessage: "",
  whatsappEnabled: false,
  instagramUrl: "",
  tiktokUrl: "",
  footerText: "Fresco, nutritivo, resuelto.",
  seoTitle: "Revuelto | Fresco, nutritivo, resuelto",
  seoDescription: "Bowls de huevos revueltos hechos para resolver tu día.",
};

type StoredSiteContent = Partial<Record<keyof SiteContentInput, string | boolean | null>>;

export function siteContentInputFromStored(content: StoredSiteContent | null | undefined): SiteContentInput {
  if (!content) return { ...DEFAULT_SITE_CONTENT };
  return Object.fromEntries(
    Object.entries(DEFAULT_SITE_CONTENT).map(([key, fallback]) => {
      const stored = content[key as keyof SiteContentInput];
      return [key, stored === undefined ? fallback : stored === null ? (typeof fallback === "boolean" ? fallback : "") : stored];
    }),
  ) as SiteContentInput;
}

export function nullableContentValues(input: SiteContentInput) {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, typeof value === "string" && value === "" ? null : value]),
  ) as Record<keyof SiteContentInput, string | boolean | null>;
}

export function buildWhatsAppUrl(content: Pick<SiteContentInput, "whatsappEnabled" | "whatsappNumber" | "whatsappDefaultMessage">) {
  if (!content.whatsappEnabled) return null;
  const number = content.whatsappNumber.replace(/\D/g, "");
  if (!number) return null;
  const url = new URL(`https://wa.me/${number}`);
  if (content.whatsappDefaultMessage) url.searchParams.set("text", content.whatsappDefaultMessage);
  return url.toString();
}

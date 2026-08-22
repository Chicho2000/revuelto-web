import "server-only";
import { getPrisma } from "@/lib/prisma";
import {
  DEFAULT_SITE_CONTENT,
  SITE_CONTENT_KEY,
  siteContentInputFromStored,
  type SiteContentInput,
} from "@/lib/content/schema";

function isMissingSiteContentColumn(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2022";
}

async function getLegacySiteContent() {
  const rows = await getPrisma().siteContent.findMany({
    where: { key: { in: ["hero", "about"] } },
    select: { key: true, title: true, content: true },
  });
  const byKey = new Map(rows.map((row) => [row.key, row]));
  const hero = byKey.get("hero");
  const about = byKey.get("about");

  return {
    ...DEFAULT_SITE_CONTENT,
    heroTitle: hero?.title ?? DEFAULT_SITE_CONTENT.heroTitle,
    heroDescription: hero?.content ?? DEFAULT_SITE_CONTENT.heroDescription,
    brandTitle: about?.title ?? DEFAULT_SITE_CONTENT.brandTitle,
    brandDescription: about?.content ?? DEFAULT_SITE_CONTENT.brandDescription,
  };
}

function contentValues(input: SiteContentInput) {
  const optional = (value: string) => value || null;
  return {
    heroTitle: input.heroTitle,
    heroSubtitle: optional(input.heroSubtitle),
    heroDescription: optional(input.heroDescription),
    heroButtonText: optional(input.heroButtonText),
    heroButtonUrl: optional(input.heroButtonUrl),
    brandTitle: optional(input.brandTitle),
    brandDescription: optional(input.brandDescription),
    menuSectionTitle: optional(input.menuSectionTitle),
    menuSectionDescription: optional(input.menuSectionDescription),
    promotionsSectionTitle: optional(input.promotionsSectionTitle),
    promotionsSectionDescription: optional(input.promotionsSectionDescription),
    branchesSectionTitle: optional(input.branchesSectionTitle),
    branchesSectionDescription: optional(input.branchesSectionDescription),
    gallerySectionTitle: optional(input.gallerySectionTitle),
    gallerySectionDescription: optional(input.gallerySectionDescription),
    whatsappNumber: optional(input.whatsappNumber),
    whatsappButtonText: optional(input.whatsappButtonText),
    whatsappDefaultMessage: optional(input.whatsappDefaultMessage),
    whatsappEnabled: input.whatsappEnabled,
    orderingEnabled: input.orderingEnabled,
    cashEnabled: input.cashEnabled,
    transferEnabled: input.transferEnabled,
    mercadoPagoEnabled: input.mercadoPagoEnabled,
    instagramUrl: optional(input.instagramUrl),
    tiktokUrl: optional(input.tiktokUrl),
    footerText: optional(input.footerText),
    seoTitle: optional(input.seoTitle),
    seoDescription: optional(input.seoDescription),
  };
}

export async function getSiteContent() {
  try {
    const stored = await getPrisma().siteContent.findUnique({ where: { key: SITE_CONTENT_KEY } });
    return siteContentInputFromStored(stored);
  } catch (error) {
    if (isMissingSiteContentColumn(error)) return getLegacySiteContent();
    throw error;
  }
}

export async function updateSiteContent(input: SiteContentInput) {
  const data = contentValues(input);
  return getPrisma().siteContent.upsert({
    where: { key: SITE_CONTENT_KEY },
    create: { key: SITE_CONTENT_KEY, title: null, content: "", ...data },
    update: data,
  });
}

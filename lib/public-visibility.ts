import { isPublicGalleryItem } from "@/lib/gallery/schema";
import { isPublicMerchandiseItem } from "@/lib/merchandise/schema";

export const PUBLIC_SECTION_IDS = {
  revueltos: "carta",
  revueltitos: "revueltitos",
  sanguchitos: "sanguchitos",
  bebidas: "bebidas",
  promotions: "promociones",
  branches: "sucursales",
  gallery: "galeria",
  merchandise: "merchandising",
} as const;

type RevueltoVisibility = {
  isVisibleInNewMenu: boolean;
  isArchived: boolean;
};

type BranchVisibility = {
  isActive: boolean;
};

type PromotionVisibility = {
  isActive: boolean;
};

export function isPublicRevuelto(revuelto: RevueltoVisibility) {
  return revuelto.isVisibleInNewMenu && !revuelto.isArchived;
}

export function isPublicBranch(branch: BranchVisibility) {
  return branch.isActive;
}

export function isPublicPromotion(promotion: PromotionVisibility) {
  return promotion.isActive;
}

export function selectVisiblePublicContent<
  TRevuelto extends RevueltoVisibility,
  TBranch extends BranchVisibility,
  TPromotion extends PromotionVisibility,
  TGallery extends Parameters<typeof isPublicGalleryItem>[0],
  TMerchandise extends Parameters<typeof isPublicMerchandiseItem>[0],
>(
  data: {
    revueltos: readonly TRevuelto[];
    revueltitos?: readonly TRevuelto[];
    sanguchitos?: readonly TRevuelto[];
    bebidas?: readonly TRevuelto[];
    branches: readonly TBranch[];
    promotions: readonly TPromotion[];
    gallery?: readonly TGallery[];
    merchandise?: readonly TMerchandise[];
  },
) {
  return {
    visibleRevueltos: data.revueltos.filter(isPublicRevuelto),
    visibleRevueltitos: (data.revueltitos ?? []).filter(isPublicRevuelto),
    visibleSanguchitos: (data.sanguchitos ?? []).filter(isPublicRevuelto),
    visibleBebidas: (data.bebidas ?? []).filter(isPublicRevuelto),
    visibleBranches: data.branches.filter(isPublicBranch),
    visiblePromotions: data.promotions.filter(isPublicPromotion),
    visibleGallery: (data.gallery ?? []).filter(isPublicGalleryItem),
    visibleMerchandise: (data.merchandise ?? []).filter(isPublicMerchandiseItem),
  };
}

export function buildPublicNavigation(data: {
  visibleRevueltos: readonly unknown[];
  visibleRevueltitos?: readonly unknown[];
  visibleSanguchitos?: readonly unknown[];
  visibleBebidas?: readonly unknown[];
  visibleBranches: readonly unknown[];
  visiblePromotions: readonly unknown[];
  visibleGallery?: readonly unknown[];
  visibleMerchandise?: readonly unknown[];
}) {
  const hasRevueltos = data.visibleRevueltos.length > 0;
  const hasRevueltitos = (data.visibleRevueltitos?.length ?? 0) > 0;
  const hasSanguchitos = (data.visibleSanguchitos?.length ?? 0) > 0;
  const hasBebidas = (data.visibleBebidas?.length ?? 0) > 0;
  const hasBranches = data.visibleBranches.length > 0;
  const hasPromotions = data.visiblePromotions.length > 0;
  const hasGallery = (data.visibleGallery?.length ?? 0) > 0;
  const hasMerchandise = (data.visibleMerchandise?.length ?? 0) > 0;

  const visibleSections = [
    hasRevueltos
      ? { id: PUBLIC_SECTION_IDS.revueltos, href: `#${PUBLIC_SECTION_IDS.revueltos}`, label: "Revueltos" }
      : null,
    hasRevueltitos ? { id: PUBLIC_SECTION_IDS.revueltitos, href: `#${PUBLIC_SECTION_IDS.revueltitos}`, label: "Revueltitos" } : null,
    hasSanguchitos ? { id: PUBLIC_SECTION_IDS.sanguchitos, href: `#${PUBLIC_SECTION_IDS.sanguchitos}`, label: "Sanguchitos" } : null,
    hasBebidas ? { id: PUBLIC_SECTION_IDS.bebidas, href: `#${PUBLIC_SECTION_IDS.bebidas}`, label: "Bebidas" } : null,
    hasPromotions
      ? {
          id: PUBLIC_SECTION_IDS.promotions,
          href: `#${PUBLIC_SECTION_IDS.promotions}`,
          label: "Promociones",
        }
      : null,
    hasGallery
      ? {
          id: PUBLIC_SECTION_IDS.gallery,
          href: `#${PUBLIC_SECTION_IDS.gallery}`,
          label: "Galería",
        }
      : null,
    hasMerchandise
      ? {
          id: PUBLIC_SECTION_IDS.merchandise,
          href: `#${PUBLIC_SECTION_IDS.merchandise}`,
          label: "Merch",
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);
  const menuItems = visibleSections.map(({ id, href, label }) => ({ id, href, label }));
  const sectionIds = visibleSections.map(({ id }) => id);

  return { hasRevueltos, hasRevueltitos, hasSanguchitos, hasBebidas, hasBranches, hasPromotions, hasGallery, hasMerchandise, menuItems, sectionIds };
}

import { isPublicGalleryItem } from "@/lib/gallery/schema";
import { isPublicMerchandiseItem } from "@/lib/merchandise/schema";

export const PUBLIC_SECTION_IDS = {
  revueltos: "carta",
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
    branches: readonly TBranch[];
    promotions: readonly TPromotion[];
    gallery?: readonly TGallery[];
    merchandise?: readonly TMerchandise[];
  },
) {
  return {
    visibleRevueltos: data.revueltos.filter(isPublicRevuelto),
    visibleBranches: data.branches.filter(isPublicBranch),
    visiblePromotions: data.promotions.filter(isPublicPromotion),
    visibleGallery: (data.gallery ?? []).filter(isPublicGalleryItem),
    visibleMerchandise: (data.merchandise ?? []).filter(isPublicMerchandiseItem),
  };
}

export function buildPublicNavigation(data: {
  visibleRevueltos: readonly unknown[];
  visibleBranches: readonly unknown[];
  visiblePromotions: readonly unknown[];
  visibleGallery?: readonly unknown[];
  visibleMerchandise?: readonly unknown[];
}) {
  const hasRevueltos = data.visibleRevueltos.length > 0;
  const hasBranches = data.visibleBranches.length > 0;
  const hasPromotions = data.visiblePromotions.length > 0;
  const hasGallery = (data.visibleGallery?.length ?? 0) > 0;
  const hasMerchandise = (data.visibleMerchandise?.length ?? 0) > 0;

  const visibleSections = [
    hasRevueltos
      ? { id: PUBLIC_SECTION_IDS.revueltos, href: `#${PUBLIC_SECTION_IDS.revueltos}`, label: "Carta" }
      : null,
    hasPromotions
      ? {
          id: PUBLIC_SECTION_IDS.promotions,
          href: `#${PUBLIC_SECTION_IDS.promotions}`,
          label: "Promociones",
        }
      : null,
    hasBranches
      ? {
          id: PUBLIC_SECTION_IDS.branches,
          href: `#${PUBLIC_SECTION_IDS.branches}`,
          label: "Sucursales",
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
          label: "Merchandising",
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);
  const menuItems = visibleSections.map(({ id, href, label }) => ({ id, href, label }));
  const sectionIds = visibleSections.map(({ id }) => id);

  return { hasRevueltos, hasBranches, hasPromotions, hasGallery, hasMerchandise, menuItems, sectionIds };
}

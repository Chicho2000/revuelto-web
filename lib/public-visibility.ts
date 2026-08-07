import { isPublicGalleryItem } from "@/lib/gallery/schema";

export const PUBLIC_SECTION_IDS = {
  bowls: "carta",
  promotions: "promociones",
  branches: "sucursales",
  gallery: "galeria",
} as const;

type BowlVisibility = {
  isAvailable: boolean;
  isArchived: boolean;
};

type BranchVisibility = {
  isActive: boolean;
};

type PromotionVisibility = {
  isActive: boolean;
};

export function isPublicBowl(bowl: BowlVisibility) {
  return bowl.isAvailable && !bowl.isArchived;
}

export function isPublicBranch(branch: BranchVisibility) {
  return branch.isActive;
}

export function isPublicPromotion(promotion: PromotionVisibility) {
  return promotion.isActive;
}

export function selectVisiblePublicContent<
  TBowl extends BowlVisibility,
  TBranch extends BranchVisibility,
  TPromotion extends PromotionVisibility,
  TGallery extends Parameters<typeof isPublicGalleryItem>[0],
>(
  data: {
    bowls: readonly TBowl[];
    branches: readonly TBranch[];
    promotions: readonly TPromotion[];
    gallery?: readonly TGallery[];
  },
) {
  return {
    visibleBowls: data.bowls.filter(isPublicBowl),
    visibleBranches: data.branches.filter(isPublicBranch),
    visiblePromotions: data.promotions.filter(isPublicPromotion),
    visibleGallery: (data.gallery ?? []).filter(isPublicGalleryItem),
  };
}

export function buildPublicNavigation(data: {
  visibleBowls: readonly unknown[];
  visibleBranches: readonly unknown[];
  visiblePromotions: readonly unknown[];
  visibleGallery?: readonly unknown[];
}) {
  const hasBowls = data.visibleBowls.length > 0;
  const hasBranches = data.visibleBranches.length > 0;
  const hasPromotions = data.visiblePromotions.length > 0;
  const hasGallery = (data.visibleGallery?.length ?? 0) > 0;

  const visibleSections = [
    hasBowls
      ? { id: PUBLIC_SECTION_IDS.bowls, href: `#${PUBLIC_SECTION_IDS.bowls}`, label: "Carta" }
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
  ].filter((item): item is NonNullable<typeof item> => item !== null);
  const menuItems = visibleSections.map(({ id, href, label }) => ({ id, href, label }));
  const sectionIds = visibleSections.map(({ id }) => id);

  return { hasBowls, hasBranches, hasPromotions, hasGallery, menuItems, sectionIds };
}

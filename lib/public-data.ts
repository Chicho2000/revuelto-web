import "server-only";
import { cache } from "react";
import { DayOfWeek } from "@/generated/prisma/client";
import { BRANCH_DAYS } from "@/lib/branches/schema";
import { hasDatabaseRuntimeConfiguration } from "@/lib/env";
import { getPrisma } from "@/lib/prisma";
import { buildPublicNavigation, selectVisiblePublicContent } from "@/lib/public-visibility";
import { sortPublicPromotions } from "@/lib/promotions/schema";
import { getSiteContent } from "@/lib/content/service";
import type { SiteContentInput } from "@/lib/content/schema";
import { getPublicGalleryImageUrl } from "@/lib/gallery/public-image";
import { getPublicMerchandiseImageUrl } from "@/lib/merchandise/public-image";
import { reportUnexpectedServerError } from "@/lib/observability/server-errors";

export type PublicSiteData =
  | { status: "configuration" }
  | { status: "error" }
  | {
      status: "ready";
      content: SiteContentInput;
      visibleBowls: Awaited<ReturnType<typeof getBowls>>;
      visiblePromotions: Awaited<ReturnType<typeof getPromotions>>;
      visibleBranches: Awaited<ReturnType<typeof getBranches>>;
      visibleGallery: Awaited<ReturnType<typeof getGallery>>;
      visibleMerchandise: Awaited<ReturnType<typeof getMerchandise>>;
      navigation: ReturnType<typeof buildPublicNavigation>;
    };

async function getBowls() {
  return getPrisma().bowl.findMany({
    where: { isAvailable: true, isArchived: false },
    include: { sizes: { where: { isAvailable: true }, orderBy: { size: "asc" } } },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
  });
}

async function getPromotions() {
  const promotions = await getPrisma().promotion.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });
  return sortPublicPromotions(promotions);
}

async function getBranches() {
  const branches = await getPrisma().branch.findMany({
    where: { isActive: true },
    include: { businessHours: true },
    orderBy: { name: "asc" },
  });

  return branches.map((branch) => ({
    ...branch,
    businessHours: BRANCH_DAYS.map((dayOfWeek) =>
      branch.businessHours.find((hour) => hour.dayOfWeek === dayOfWeek) ?? {
        id: `closed:${branch.id}:${dayOfWeek}`,
        branchId: branch.id,
        dayOfWeek: dayOfWeek as DayOfWeek,
        openingTime: null,
        closingTime: null,
        isClosed: true,
      },
    ),
  }));
}

async function getGallery() {
  try {
    const items = await getPrisma().galleryItem.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    });
    return items.map((item) => ({ ...item, imageUrl: getPublicGalleryImageUrl(item.imagePath) }));
  } catch (error) {
    const tableMissing = typeof error === "object" && error !== null && "code" in error && error.code === "P2021";
    if (tableMissing) return [];
    throw error;
  }
}

async function getMerchandise() {
  try {
    const items = await getPrisma().merchandiseItem.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    });
    return items.map((item) => ({ ...item, imageUrl: getPublicMerchandiseImageUrl(item.imagePath) }));
  } catch (error) {
    const tableMissing = typeof error === "object" && error !== null && "code" in error && error.code === "P2021";
    if (tableMissing) return [];
    throw error;
  }
}

async function loadPublicSiteData(): Promise<PublicSiteData> {
  if (!hasDatabaseRuntimeConfiguration()) return { status: "configuration" };

  try {
    const [content, bowls, promotions, branches, gallery, merchandise] = await Promise.all([
      getSiteContent(),
      getBowls(),
      getPromotions(),
      getBranches(),
      getGallery(),
      getMerchandise(),
    ]);

    const visibleContent = selectVisiblePublicContent(
      { bowls, promotions, branches, gallery, merchandise },
    );
    const navigation = buildPublicNavigation(visibleContent);

    return { status: "ready", content, ...visibleContent, navigation };
  } catch (error) {
    reportUnexpectedServerError("public-data.load", error);
    return { status: "error" };
  }
}

export const getPublicSiteData = cache(loadPublicSiteData);

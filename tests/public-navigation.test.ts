import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPublicNavigation,
  PUBLIC_SECTION_IDS,
  selectVisiblePublicContent,
} from "../lib/public-visibility";

const activeBowl = {
  id: "bowl-1",
  name: "Revuelto verde",
  shortDescription: "Huevos y vegetales.",
  imageUrl: null,
  isAvailable: true,
  isArchived: false,
  sizes: [],
};

const activeBranch = {
  id: "branch-1",
  name: "Revuelto Centro",
  address: "Calle 123",
  city: "Buenos Aires",
  whatsappNumber: "",
  isActive: true,
  businessHours: [],
};

type TestPromotion = {
  id: string;
  title: string;
  description: string;
  isActive: boolean;
  weeklyDays?: string[];
  dailyStartTime?: string | null;
  dailyEndTime?: string | null;
};

const currentPromotion: TestPromotion = {
  id: "promotion-1",
  title: "Promo vigente",
  description: "Descripción",
  isActive: true,
};

type PublicSource = {
  bowls?: Array<typeof activeBowl>;
  branches?: Array<typeof activeBranch>;
  promotions?: TestPromotion[];
  gallery?: Array<{
    id: string;
    type: "IMAGE" | "INSTAGRAM_VIDEO";
    imagePath: string;
    externalUrl: string | null;
    isActive: boolean;
  }>;
};

function renderedState(source: PublicSource = {}) {
  const visibleContent = selectVisiblePublicContent(
    {
      bowls: source.bowls ?? [],
      branches: source.branches ?? [],
      promotions: source.promotions ?? [],
      gallery: source.gallery ?? [],
    },
  );
  const navigation = buildPublicNavigation(visibleContent);
  return {
    links: navigation.menuItems.map((item) => item.href),
    sectionIds: navigation.sectionIds,
  };
}

test("sin promociones vigentes no existe enlace ni sección de promociones", () => {
  const state = renderedState({ bowls: [activeBowl] });
  assert.equal(state.links.includes(`#${PUBLIC_SECTION_IDS.promotions}`), false);
  assert.equal(state.sectionIds.includes(PUBLIC_SECTION_IDS.promotions), false);
});

test("una promoción vigente habilita el enlace y la sección", () => {
  const state = renderedState({ promotions: [currentPromotion] });
  assert.equal(state.links.includes(`#${PUBLIC_SECTION_IDS.promotions}`), true);
  assert.equal(state.sectionIds.includes(PUBLIC_SECTION_IDS.promotions), true);
});

test("promociones activas con horario habilitan la sección; las inactivas no", () => {
  const state = renderedState({
    promotions: [
      { ...currentPromotion, id: "scheduled", weeklyDays: ["MONDAY"] },
      {
        ...currentPromotion,
        id: "another-scheduled",
        dailyStartTime: "13:00",
        dailyEndTime: "15:00",
      },
      { ...currentPromotion, id: "inactive", isActive: false, weeklyDays: ["TUESDAY"] },
    ],
  });
  assert.equal(state.links.includes(`#${PUBLIC_SECTION_IDS.promotions}`), true);
  assert.equal(state.sectionIds.includes(PUBLIC_SECTION_IDS.promotions), true);
});

test("sin bowls activos no existe enlace ni sección de carta", () => {
  const state = renderedState({
    bowls: [
      { ...activeBowl, id: "inactive", isAvailable: false },
      { ...activeBowl, id: "archived", isArchived: true },
    ],
  });
  assert.equal(state.links.includes(`#${PUBLIC_SECTION_IDS.bowls}`), false);
  assert.equal(state.sectionIds.includes(PUBLIC_SECTION_IDS.bowls), false);
});

test("un bowl activo habilita el enlace y la sección de carta", () => {
  const state = renderedState({ bowls: [activeBowl] });
  assert.equal(state.links.includes(`#${PUBLIC_SECTION_IDS.bowls}`), true);
  assert.equal(state.sectionIds.includes(PUBLIC_SECTION_IDS.bowls), true);
});

test("sin sucursales activas no existe enlace ni sección de sucursales", () => {
  const state = renderedState({ branches: [{ ...activeBranch, isActive: false }] });
  assert.equal(state.links.includes(`#${PUBLIC_SECTION_IDS.branches}`), false);
  assert.equal(state.sectionIds.includes(PUBLIC_SECTION_IDS.branches), false);
});

test("una sucursal activa habilita el enlace y la sección de sucursales", () => {
  const state = renderedState({ branches: [activeBranch] });
  assert.equal(state.links.includes(`#${PUBLIC_SECTION_IDS.branches}`), true);
  assert.equal(state.sectionIds.includes(PUBLIC_SECTION_IDS.branches), true);
});

test("sin multimedia activa no existe enlace ni sección de galería", () => {
  const state = renderedState({ gallery: [{ id: "inactive", type: "IMAGE", imagePath: "gallery/a.webp", externalUrl: null, isActive: false }] });
  assert.equal(state.links.includes(`#${PUBLIC_SECTION_IDS.gallery}`), false);
  assert.equal(state.sectionIds.includes(PUBLIC_SECTION_IDS.gallery), false);
});

test("con multimedia activa aparecen enlace y sección de galería", () => {
  const state = renderedState({ gallery: [{ id: "active", type: "IMAGE", imagePath: "gallery/a.webp", externalUrl: null, isActive: true }] });
  assert.equal(state.links.includes(`#${PUBLIC_SECTION_IDS.gallery}`), true);
  assert.equal(state.sectionIds.includes(PUBLIC_SECTION_IDS.gallery), true);
});

test("cada enlace interno visible apunta a un id realmente renderizado", () => {
  const state = renderedState({
    bowls: [activeBowl],
    promotions: [currentPromotion],
    branches: [activeBranch],
    gallery: [{ id: "active", type: "IMAGE", imagePath: "gallery/a.webp", externalUrl: null, isActive: true }],
  });
  const sectionIds = new Set<string>(state.sectionIds);

  for (const href of state.links) {
    assert.equal(sectionIds.has(href.slice(1)), true, `Falta la sección de ${href}`);
  }
});

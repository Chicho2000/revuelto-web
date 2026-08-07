import { z } from "zod";

export const GALLERY_ITEM_TYPES = ["IMAGE", "INSTAGRAM_VIDEO"] as const;
export type GalleryItemTypeValue = (typeof GALLERY_ITEM_TYPES)[number];

const INSTAGRAM_HOSTS = new Set(["instagram.com", "www.instagram.com", "m.instagram.com"]);
const INSTAGRAM_POST_PATH = /^\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)\/?$/;

export function normalizeInstagramUrl(value: string) {
  try {
    const url = new URL(value.trim());
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !INSTAGRAM_HOSTS.has(url.hostname.toLowerCase())
    ) return null;
    const match = url.pathname.match(INSTAGRAM_POST_PATH);
    if (!match) return null;
    return `https://www.instagram.com/${match[1]}/${match[2]}/`;
  } catch {
    return null;
  }
}

export function normalizeHttpsExternalUrl(value: string) {
  if (!value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export const galleryItemFormSchema = z
  .object({
    type: z.enum(GALLERY_ITEM_TYPES),
    title: z.string().trim().max(160),
    description: z.string().trim().max(1000),
    externalUrl: z.string().trim().max(500),
    sortOrder: z.number().int().min(-100_000).max(100_000),
    isActive: z.boolean(),
    temporaryImageId: z.string().uuid().nullable(),
  })
  .strict()
  .superRefine((item, context) => {
    if (item.type === "INSTAGRAM_VIDEO") {
      if (!item.externalUrl) {
        context.addIssue({ code: "custom", path: ["externalUrl"], message: "La URL de Instagram es obligatoria." });
      } else if (!normalizeInstagramUrl(item.externalUrl)) {
        context.addIssue({
          code: "custom",
          path: ["externalUrl"],
          message: "Usá una URL HTTPS oficial de una publicación o Reel de Instagram.",
        });
      }
    } else if (item.externalUrl && !normalizeHttpsExternalUrl(item.externalUrl)) {
      context.addIssue({ code: "custom", path: ["externalUrl"], message: "Usá una URL HTTPS válida." });
    }
  });

export const galleryItemCreateSchema = galleryItemFormSchema.superRefine((item, context) => {
  if (!item.temporaryImageId) {
    context.addIssue({ code: "custom", path: ["temporaryImageId"], message: "La imagen o miniatura es obligatoria." });
  }
});

export const galleryItemStatusSchema = z.object({ isActive: z.boolean() }).strict();

export type GalleryItemFormInput = z.input<typeof galleryItemFormSchema>;
export type GalleryItemInput = z.output<typeof galleryItemFormSchema>;

export function galleryItemInputFromForm(input: GalleryItemInput): GalleryItemInput {
  return {
    ...input,
    title: input.title.trim(),
    description: input.description.trim(),
    externalUrl:
      input.type === "INSTAGRAM_VIDEO"
        ? normalizeInstagramUrl(input.externalUrl) ?? ""
        : normalizeHttpsExternalUrl(input.externalUrl) ?? "",
  };
}

export function isPublicGalleryItem(item: {
  type: string;
  imagePath: string | null | undefined;
  externalUrl: string | null | undefined;
  isActive: boolean;
}) {
  if (!item.isActive || !item.imagePath?.trim()) return false;
  return item.type !== "INSTAGRAM_VIDEO" || Boolean(item.externalUrl && normalizeInstagramUrl(item.externalUrl));
}

export function getSafeGalleryLinkProps(item: { type: string; externalUrl: string | null | undefined }) {
  if (!item.externalUrl) return null;
  const href = item.type === "INSTAGRAM_VIDEO"
    ? normalizeInstagramUrl(item.externalUrl)
    : normalizeHttpsExternalUrl(item.externalUrl);
  return href ? { href, target: "_blank" as const, rel: "noopener noreferrer" } : null;
}

export function sortGalleryItems<T extends { sortOrder: number; createdAt: Date; id: string }>(items: readonly T[]) {
  return [...items].sort(
    (left, right) =>
      left.sortOrder - right.sortOrder ||
      left.createdAt.getTime() - right.createdAt.getTime() ||
      left.id.localeCompare(right.id),
  );
}

export function getGalleryMutationError(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error && error.code === "P2025") {
    return { status: 404, message: "El elemento no existe." };
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "P2021" || error.code === "P2022")
  ) {
    return { status: 503, message: "Falta aplicar la migración de contenido y galería." };
  }
  return { status: 500, message: "No se pudo guardar el elemento de galería." };
}

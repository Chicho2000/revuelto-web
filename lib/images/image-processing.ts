import "server-only";
import sharp from "sharp";
import { TemporaryImageTarget } from "@/generated/prisma/client";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 100_000_000;

const outputProfiles = {
  [TemporaryImageTarget.BOWL]: {
    width: 1600,
    height: 1600,
    maxBytes: 5 * 1024 * 1024,
    maxSourceWidth: 6000,
    maxSourceHeight: 6000,
    maxPixels: 24_000_000,
  },
  [TemporaryImageTarget.PROMOTION]: {
    width: 1920,
    height: 1080,
    maxBytes: 5 * 1024 * 1024,
    maxSourceWidth: 6000,
    maxSourceHeight: 6000,
    maxPixels: 24_000_000,
  },
  [TemporaryImageTarget.BRANCH]: {
    width: 1920,
    height: 1440,
    maxBytes: MAX_IMAGE_BYTES,
    maxSourceWidth: 10_000,
    maxSourceHeight: 10_000,
    maxPixels: MAX_IMAGE_PIXELS,
  },
  [TemporaryImageTarget.GALLERY]: {
    width: 1600,
    height: 1200,
    maxBytes: 5 * 1024 * 1024,
    maxSourceWidth: 6000,
    maxSourceHeight: 6000,
    maxPixels: 24_000_000,
  },
} as const;

export class InvalidImageError extends Error {}

export async function validateAndProcessImage(source: Buffer, target: TemporaryImageTarget) {
  const profile = outputProfiles[target];
  if (source.byteLength === 0 || source.byteLength > profile.maxBytes) {
    throw new InvalidImageError("El archivo supera el límite permitido.");
  }

  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(source, { limitInputPixels: MAX_IMAGE_PIXELS, pages: 1 }).metadata();
  } catch {
    throw new InvalidImageError("No se pudo decodificar la imagen.");
  }

  if (
    !metadata.format ||
    !["jpeg", "png", "webp"].includes(metadata.format) ||
    !metadata.width ||
    !metadata.height ||
    metadata.width > profile.maxSourceWidth ||
    metadata.height > profile.maxSourceHeight ||
    metadata.width * metadata.height > profile.maxPixels ||
    (metadata.pages !== undefined && metadata.pages !== 1)
  ) {
    throw new InvalidImageError("El formato o las dimensiones no están permitidos.");
  }

  try {
    const output = await sharp(source, { limitInputPixels: MAX_IMAGE_PIXELS, pages: 1 })
      .rotate()
      .resize(profile.width, profile.height, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });

    return {
      buffer: output.data,
      sourceBytes: source.byteLength,
      width: output.info.width,
      height: output.info.height,
    };
  } catch {
    throw new InvalidImageError("No se pudo procesar la imagen.");
  }
}

import "server-only";
import sharp from "sharp";
import type { TemporaryImageTarget } from "@/generated/prisma/client";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_WIDTH = 6000;
export const MAX_IMAGE_HEIGHT = 6000;
export const MAX_IMAGE_PIXELS = 24_000_000;

const allowedFormats = {
  jpeg: { extension: "jpg", contentType: "image/jpeg" },
  png: { extension: "png", contentType: "image/png" },
  webp: { extension: "webp", contentType: "image/webp" },
} as const;

type AllowedImageFormat = keyof typeof allowedFormats;

export class InvalidImageError extends Error {}
export class ImageTooLargeError extends InvalidImageError {}

function isAllowedImageFormat(format: string): format is AllowedImageFormat {
  return format in allowedFormats;
}

// The target remains part of the contract so every current and future image
// flow passes through the same server-side validation. It intentionally does
// not select an output profile: accepted files are never transformed.
export async function validateAndProcessImage(
  source: Buffer,
  target: TemporaryImageTarget,
) {
  void target;
  if (source.byteLength === 0) {
    throw new InvalidImageError("El archivo está vacío.");
  }
  if (source.byteLength > MAX_IMAGE_BYTES) {
    throw new ImageTooLargeError("El archivo supera el límite permitido.");
  }

  let metadata: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    // animated:true makes Sharp inspect every page/frame instead of silently
    // accepting only the first one. limitInputPixels protects the decoder.
    metadata = await sharp(source, {
      animated: true,
      failOn: "error",
      limitInputPixels: MAX_IMAGE_PIXELS,
    }).metadata();
  } catch {
    throw new InvalidImageError("No se pudo decodificar la imagen.");
  }

  if (
    !metadata.format ||
    !isAllowedImageFormat(metadata.format) ||
    !metadata.width ||
    !metadata.height ||
    metadata.width > MAX_IMAGE_WIDTH ||
    metadata.height > MAX_IMAGE_HEIGHT ||
    metadata.width * metadata.height > MAX_IMAGE_PIXELS ||
    (metadata.pages ?? 1) !== 1
  ) {
    throw new InvalidImageError("El formato o las dimensiones no están permitidos.");
  }

  const detected = allowedFormats[metadata.format];
  return {
    // Keep the exact bytes. No rotate, resize, metadata stripping, quality
    // change, compression or format conversion is performed.
    buffer: source,
    sourceBytes: source.byteLength,
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
    extension: detected.extension,
    contentType: detected.contentType,
  };
}

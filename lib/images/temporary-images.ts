import "server-only";
import { randomUUID } from "node:crypto";
import { TemporaryImageStatus, TemporaryImageTarget } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import {
  ImageTooLargeError,
  InvalidImageError,
  MAX_IMAGE_BYTES,
  validateAndProcessImage,
} from "@/lib/images/image-processing";
import { reportUnexpectedServerError } from "@/lib/observability/server-errors";
import { getStorageAdminClient, MEDIA_STORAGE_BUCKET, TEMP_STORAGE_BUCKET } from "@/lib/supabase/storage-admin";

const UPLOAD_AUTHORIZATION_MS = 10 * 60 * 1000;
const TEMPORARY_IMAGE_MS = 24 * 60 * 60 * 1000;
export const UPLOAD_INTENT_WINDOW_MS = 10 * 60 * 1000;
export const MAX_UPLOAD_INTENTS_PER_WINDOW = 8;

export class UploadRateLimitError extends Error {}

export function isUploadIntentRateLimited(intentsInWindow: number) {
  return intentsInWindow >= MAX_UPLOAD_INTENTS_PER_WINDOW;
}

function targetSegment(target: TemporaryImageTarget) {
  switch (target) {
    case TemporaryImageTarget.BOWL:
      return "bowls";
    case TemporaryImageTarget.PROMOTION:
      return "promotions";
    case TemporaryImageTarget.BRANCH:
      return "branches";
    case TemporaryImageTarget.GALLERY:
      return "gallery";
    case TemporaryImageTarget.MERCHANDISE:
      return "merchandise";
  }
}

export function isSafeTemporaryStoragePath(ownerId: string, path: string) {
  const allowedPrefixes = [`staging/${ownerId}/`, `temp/${ownerId}/`];
  return (
    allowedPrefixes.some((prefix) => path.startsWith(prefix) && path.length > prefix.length) &&
    !path.includes("\\") &&
    !path.split("/").some((segment) => segment === "." || segment === ".." || segment === "")
  );
}

async function removePaths(ownerId: string, paths: Array<string | null | undefined>) {
  const storage = getStorageAdminClient();
  const definedPaths = paths.filter((path): path is string => Boolean(path));
  if (!definedPaths.length) return true;
  if (!definedPaths.every((path) => isSafeTemporaryStoragePath(ownerId, path))) return false;
  const { error } = await storage.storage.from(TEMP_STORAGE_BUCKET).remove(definedPaths);
  return !error;
}

async function markCleanup(imageId: string, message: string, paths: Array<string | null | undefined>) {
  const image = await getPrisma().temporaryImage.findUnique({
    where: { id: imageId },
    select: { ownerId: true, finalPath: true, status: true },
  });
  if (!image || image.status === TemporaryImageStatus.CONFIRMED) return;

  const removed = await removePaths(image.ownerId, paths).catch(() => false);
  await getPrisma().temporaryImage.updateMany({
    where: { id: imageId, status: { not: TemporaryImageStatus.CONFIRMED } },
    data: {
      status: removed
        ? image?.finalPath
          ? TemporaryImageStatus.CONFIRMED
          : TemporaryImageStatus.DISCARDED
        : TemporaryImageStatus.CLEANUP_PENDING,
      lastError: removed ? null : message.slice(0, 500),
    },
  });
}

export async function createTemporaryImageUpload(ownerId: string, target: TemporaryImageTarget) {
  const now = new Date();
  const intentsInWindow = await getPrisma().temporaryImage.count({
    where: {
      ownerId,
      createdAt: { gte: new Date(now.getTime() - UPLOAD_INTENT_WINDOW_MS) },
    },
  });
  if (isUploadIntentRateLimited(intentsInWindow)) {
    throw new UploadRateLimitError("Se alcanzó el límite temporal de preparaciones de imagen.");
  }

  const id = randomUUID();
  const stagingPath = `staging/${ownerId}/${id}`;
  const uploadAuthorizationExpiresAt = new Date(now.getTime() + UPLOAD_AUTHORIZATION_MS);
  const expiresAt = new Date(now.getTime() + TEMPORARY_IMAGE_MS);

  await getPrisma().temporaryImage.create({
    data: { id, ownerId, target, stagingPath, uploadAuthorizationExpiresAt, expiresAt },
  });

  try {
    const storage = getStorageAdminClient();
    const { data, error } = await storage.storage
      .from(TEMP_STORAGE_BUCKET)
      .createSignedUploadUrl(stagingPath, { upsert: false });
    if (error || !data?.signedUrl) throw error ?? new Error("No se creó la autorización de subida.");

    return { id, signedUrl: data.signedUrl, expiresAt: uploadAuthorizationExpiresAt };
  } catch (error) {
    await getPrisma().temporaryImage.update({
      where: { id },
      data: { status: TemporaryImageStatus.CLEANUP_PENDING, lastError: "No se creó la autorización de subida." },
    });
    throw error;
  }
}

export async function completeTemporaryImage(ownerId: string, imageId: string) {
  const now = new Date();
  const claimed = await getPrisma().temporaryImage.updateMany({
    where: {
      id: imageId,
      ownerId,
      status: TemporaryImageStatus.STAGING,
      uploadAuthorizationExpiresAt: { gt: now },
      expiresAt: { gt: now },
    },
    data: { status: TemporaryImageStatus.PROCESSING },
  });
  if (!claimed.count) throw new InvalidImageError("La autorización de imagen no está disponible.");

  const image = await getPrisma().temporaryImage.findUniqueOrThrow({ where: { id: imageId } });
  const storage = getStorageAdminClient();
  let uploadedTempPath: string | null = null;

  try {
    const objectInfo = await storage.storage.from(TEMP_STORAGE_BUCKET).info(image.stagingPath);
    if (objectInfo.error || !objectInfo.data) {
      throw new InvalidImageError("No se recibió una imagen válida.");
    }
    if (typeof objectInfo.data.size !== "number") {
      throw new InvalidImageError("No se pudo verificar el tamaño de la imagen.");
    }
    if (objectInfo.data.size > MAX_IMAGE_BYTES) {
      throw new ImageTooLargeError("El archivo supera el límite permitido.");
    }

    const { data, error } = await storage.storage.from(TEMP_STORAGE_BUCKET).download(image.stagingPath);
    if (error || !data) throw new InvalidImageError("No se recibió una imagen válida.");

    const source = Buffer.from(await data.arrayBuffer());
    const validated = await validateAndProcessImage(source, image.target);
    const tempPath = `temp/${ownerId}/${randomUUID()}.${validated.extension}`;
    uploadedTempPath = tempPath;
    const upload = await storage.storage.from(TEMP_STORAGE_BUCKET).upload(tempPath, validated.buffer, {
      contentType: validated.contentType,
      upsert: false,
      cacheControl: "31536000",
    });
    if (upload.error) throw upload.error;

    const stagingRemoved = await removePaths(ownerId, [image.stagingPath]);
    await getPrisma().temporaryImage.update({
      where: { id: image.id },
      data: {
        status: TemporaryImageStatus.READY,
        tempPath,
        sourceBytes: validated.sourceBytes,
        width: validated.width,
        height: validated.height,
        lastError: stagingRemoved ? null : "No se pudo borrar el objeto de staging.",
      },
    });

    return { id: image.id, status: "ready" };
  } catch (error) {
    await markCleanup(
      image.id,
      error instanceof Error ? error.message : "Falló la validación de imagen.",
      [image.stagingPath, uploadedTempPath ?? image.tempPath],
    ).catch((cleanupError) => {
      reportUnexpectedServerError("images.complete.cleanup", cleanupError);
    });
    throw error;
  }
}

export async function prepareTemporaryImageFinalization(
  ownerId: string,
  imageId: string,
  entityId: string,
  expectedTarget: TemporaryImageTarget,
) {
  const image = await getPrisma().temporaryImage.findFirst({
    where: {
      id: imageId,
      ownerId,
      target: expectedTarget,
      status: TemporaryImageStatus.READY,
      expiresAt: { gt: new Date() },
    },
  });
  if (!image?.tempPath) throw new InvalidImageError("La imagen temporal no está lista.");

  const storage = getStorageAdminClient();
  const { data, error } = await storage.storage.from(TEMP_STORAGE_BUCKET).download(image.tempPath);
  if (error || !data) throw new Error("No se pudo recuperar la imagen temporal.");

  // Revalidate the exact bytes immediately before the server-controlled final
  // write. This also derives extension and Content-Type from the real format.
  const validated = await validateAndProcessImage(
    Buffer.from(await data.arrayBuffer()),
    image.target,
  );
  const finalPath = `${targetSegment(image.target)}/${entityId}/${randomUUID()}.${validated.extension}`;

  const uploaded = await storage.storage
    .from(MEDIA_STORAGE_BUCKET)
    .upload(finalPath, validated.buffer, {
      contentType: validated.contentType,
      upsert: false,
      cacheControl: "31536000",
    });
  if (uploaded.error) throw uploaded.error;

  const publicUrl = storage.storage.from(MEDIA_STORAGE_BUCKET).getPublicUrl(finalPath).data.publicUrl;
  return { imageId: image.id, tempPath: image.tempPath, finalPath, publicUrl };
}

export async function confirmTemporaryImageFinalization(
  ownerId: string,
  prepared: { imageId: string; tempPath: string; finalPath: string },
) {
  const image = await getPrisma().temporaryImage.findFirst({
    where: {
      id: prepared.imageId,
      ownerId,
      tempPath: prepared.tempPath,
      status: TemporaryImageStatus.READY,
    },
  });
  if (!image) throw new InvalidImageError("La imagen temporal no está lista.");

  // Store the final association before deleting the temporary object. If that
  // deletion fails, the daily cleanup can retry without ever touching finalPath.
  const claimed = await getPrisma().temporaryImage.updateMany({
    where: { id: image.id, status: TemporaryImageStatus.READY },
    data: {
      status: TemporaryImageStatus.CLEANUP_PENDING,
      finalPath: prepared.finalPath,
      lastError: "No se pudo borrar el temporal confirmado.",
    },
  });
  if (!claimed.count) throw new InvalidImageError("La imagen temporal no está lista.");

  const removed = await removePaths(ownerId, [prepared.tempPath]);
  await getPrisma().temporaryImage.updateMany({
    where: { id: image.id, status: { not: TemporaryImageStatus.CONFIRMED } },
    data: {
      status: removed ? TemporaryImageStatus.CONFIRMED : TemporaryImageStatus.CLEANUP_PENDING,
      lastError: removed ? null : "No se pudo borrar el temporal confirmado.",
    },
  });
}

export async function rollbackPreparedFinalImage(finalPath: string) {
  const storage = getStorageAdminClient();
  const { error } = await storage.storage.from(MEDIA_STORAGE_BUCKET).remove([finalPath]);
  if (error) throw error;
}

export async function deleteFinalImage(finalPath: string) {
  await rollbackPreparedFinalImage(finalPath);
}

export async function finalizeTemporaryImage(ownerId: string, imageId: string, entityId: string) {
  const prepared = await prepareTemporaryImageFinalization(
    ownerId,
    imageId,
    entityId,
    TemporaryImageTarget.BOWL,
  );
  await confirmTemporaryImageFinalization(ownerId, prepared);
  return { finalPath: prepared.finalPath, publicUrl: prepared.publicUrl };
}

export async function discardTemporaryImage(ownerId: string, imageId: string) {
  const image = await getPrisma().temporaryImage.findFirst({ where: { id: imageId, ownerId } });
  if (!image) return;
  await markCleanup(image.id, "El propietario descartó la imagen.", [image.stagingPath, image.tempPath]);
}

export function isTemporaryImageCleanupEligible(
  image: { status: TemporaryImageStatus; expiresAt: Date },
  now: Date,
) {
  return image.status !== TemporaryImageStatus.CONFIRMED && image.expiresAt <= now;
}

export function getTemporaryImageCleanupDisposition(
  image: {
    ownerId: string;
    status: TemporaryImageStatus;
    expiresAt: Date;
    stagingPath: string;
    tempPath: string | null;
    finalPath: string | null;
  },
  now: Date,
) {
  if (!isTemporaryImageCleanupEligible(image, now)) return "skip" as const;
  const paths = [image.stagingPath, image.tempPath].filter(
    (path): path is string => Boolean(path),
  );
  if (!paths.every((path) => isSafeTemporaryStoragePath(image.ownerId, path))) {
    return "unsafe" as const;
  }
  return image.finalPath ? ("confirm" as const) : ("delete" as const);
}

export async function cleanupExpiredTemporaryImages() {
  const now = new Date();
  const expired = await getPrisma().temporaryImage.findMany({
    where: {
      expiresAt: { lte: now },
      status: { not: TemporaryImageStatus.CONFIRMED },
    },
    select: {
      id: true,
      ownerId: true,
      status: true,
      stagingPath: true,
      tempPath: true,
      finalPath: true,
      expiresAt: true,
    },
    orderBy: { expiresAt: "asc" },
    take: 500,
  });

  const result = { examined: expired.length, deleted: 0, confirmed: 0, failed: 0 };
  for (const image of expired) {
    const disposition = getTemporaryImageCleanupDisposition(image, now);
    if (disposition === "skip") continue;
    const paths = [image.stagingPath, image.tempPath].filter(
      (path): path is string => Boolean(path),
    );
    if (disposition === "unsafe") {
      result.failed += 1;
      await getPrisma().temporaryImage.updateMany({
        where: { id: image.id, status: { not: TemporaryImageStatus.CONFIRMED } },
        data: {
          status: TemporaryImageStatus.CLEANUP_PENDING,
          lastError: "Ruta temporal no asociable de forma segura.",
        },
      });
      continue;
    }

    const removed = await removePaths(image.ownerId, paths).catch(() => false);
    if (!removed) {
      result.failed += 1;
      await getPrisma().temporaryImage.updateMany({
        where: { id: image.id, status: { not: TemporaryImageStatus.CONFIRMED } },
        data: {
          status: TemporaryImageStatus.CLEANUP_PENDING,
          lastError: "La limpieza automática de Storage quedó pendiente.",
        },
      });
      continue;
    }

    if (disposition === "confirm" && image.finalPath) {
      const updated = await getPrisma().temporaryImage.updateMany({
        where: {
          id: image.id,
          finalPath: image.finalPath,
          status: { not: TemporaryImageStatus.CONFIRMED },
        },
        data: { status: TemporaryImageStatus.CONFIRMED, lastError: null },
      });
      result.confirmed += updated.count;
      continue;
    }

    const deleted = await getPrisma().temporaryImage.deleteMany({
      where: {
        id: image.id,
        finalPath: null,
        expiresAt: { lte: now },
        status: { not: TemporaryImageStatus.CONFIRMED },
      },
    });
    result.deleted += deleted.count;
  }

  return result;
}

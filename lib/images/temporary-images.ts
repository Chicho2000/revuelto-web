import "server-only";
import { randomUUID } from "node:crypto";
import { TemporaryImageStatus, TemporaryImageTarget } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { InvalidImageError, validateAndProcessImage } from "@/lib/images/image-processing";
import { getStorageAdminClient, MEDIA_STORAGE_BUCKET, TEMP_STORAGE_BUCKET } from "@/lib/supabase/storage-admin";

const UPLOAD_AUTHORIZATION_MS = 10 * 60 * 1000;
const TEMPORARY_IMAGE_MS = 24 * 60 * 60 * 1000;

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
  }
}

async function removePaths(paths: Array<string | null | undefined>) {
  const storage = getStorageAdminClient();
  const definedPaths = paths.filter((path): path is string => Boolean(path));
  if (!definedPaths.length) return true;
  const { error } = await storage.storage.from(TEMP_STORAGE_BUCKET).remove(definedPaths);
  return !error;
}

async function markCleanup(imageId: string, message: string, paths: Array<string | null | undefined>) {
  const removed = await removePaths(paths).catch(() => false);
  const image = await getPrisma().temporaryImage.findUnique({
    where: { id: imageId },
    select: { finalPath: true },
  });
  await getPrisma().temporaryImage.update({
    where: { id: imageId },
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

  try {
    const { data, error } = await storage.storage.from(TEMP_STORAGE_BUCKET).download(image.stagingPath);
    if (error || !data) throw new InvalidImageError("No se recibió una imagen válida.");

    const source = Buffer.from(await data.arrayBuffer());
    const processed = await validateAndProcessImage(source, image.target);
    const tempPath = `temp/${ownerId}/${randomUUID()}.webp`;
    const upload = await storage.storage.from(TEMP_STORAGE_BUCKET).upload(tempPath, processed.buffer, {
      contentType: "image/webp",
      upsert: false,
      cacheControl: "31536000",
    });
    if (upload.error) throw upload.error;

    const stagingRemoved = await removePaths([image.stagingPath]);
    await getPrisma().temporaryImage.update({
      where: { id: image.id },
      data: {
        status: stagingRemoved ? TemporaryImageStatus.READY : TemporaryImageStatus.CLEANUP_PENDING,
        tempPath,
        sourceBytes: processed.sourceBytes,
        width: processed.width,
        height: processed.height,
        lastError: stagingRemoved ? null : "No se pudo borrar el objeto de staging.",
      },
    });

    return { id: image.id, status: stagingRemoved ? "ready" : "cleanup-pending" };
  } catch (error) {
    await markCleanup(
      image.id,
      error instanceof Error ? error.message : "Falló el procesamiento de imagen.",
      [image.stagingPath, image.tempPath],
    );
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

  const finalPath = `${targetSegment(image.target)}/${entityId}/${randomUUID()}.webp`;
  const storage = getStorageAdminClient();
  const { data, error } = await storage.storage.from(TEMP_STORAGE_BUCKET).download(image.tempPath);
  if (error || !data) throw new Error("No se pudo recuperar la imagen temporal.");

  const uploaded = await storage.storage
    .from(MEDIA_STORAGE_BUCKET)
    .upload(finalPath, Buffer.from(await data.arrayBuffer()), { contentType: "image/webp", upsert: false, cacheControl: "31536000" });
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

  const removed = await removePaths([prepared.tempPath]);
  await getPrisma().temporaryImage.update({
    where: { id: image.id },
    data: {
      status: removed ? TemporaryImageStatus.CONFIRMED : TemporaryImageStatus.CLEANUP_PENDING,
      finalPath: prepared.finalPath,
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

export async function cleanupExpiredTemporaryImages() {
  const expired = await getPrisma().temporaryImage.findMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { status: TemporaryImageStatus.CLEANUP_PENDING },
      ],
      status: { not: TemporaryImageStatus.CONFIRMED },
    },
    select: { id: true, stagingPath: true, tempPath: true },
    take: 100,
  });

  for (const image of expired) {
    await markCleanup(image.id, "Limpieza automática pendiente.", [image.stagingPath, image.tempPath]);
  }

  return expired.length;
}

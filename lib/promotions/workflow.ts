export async function cancelPromotionImage(
  imageId: string | null,
  discard: (imageId: string) => Promise<void>,
) {
  if (imageId) await discard(imageId);
}

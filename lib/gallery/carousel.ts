export const GALLERY_CAROUSEL_MIN_ITEMS = 4;

export function shouldUseGalleryCarousel(itemCount: number) {
  return itemCount >= GALLERY_CAROUSEL_MIN_ITEMS;
}

export function getNextGallerySlide(currentIndex: number, itemCount: number) {
  if (itemCount <= 0) return 0;
  return (currentIndex + 1) % itemCount;
}

export function getPreviousGallerySlide(currentIndex: number, itemCount: number) {
  if (itemCount <= 0) return 0;
  return (currentIndex - 1 + itemCount) % itemCount;
}

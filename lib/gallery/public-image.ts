import "server-only";
import { getSupabaseEnvironment } from "@/lib/env";
import { MEDIA_STORAGE_BUCKET } from "@/lib/supabase/storage-admin";

export function getPublicGalleryImageUrl(imagePath: string) {
  const environment = getSupabaseEnvironment();
  if (!environment) return null;
  const encodedPath = imagePath.split("/").map(encodeURIComponent).join("/");
  return `${environment.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${MEDIA_STORAGE_BUCKET}/${encodedPath}`;
}

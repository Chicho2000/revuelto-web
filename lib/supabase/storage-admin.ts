import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getStorageAdminEnvironment, getSupabaseEnvironment } from "@/lib/env";

export const TEMP_STORAGE_BUCKET = "revuelto-temp";
export const MEDIA_STORAGE_BUCKET = "bucket-media";

// This is deliberately the only module allowed to read SUPABASE_SERVICE_ROLE_KEY.
// It is never used for Auth, cookies, Prisma, or authorization.
export function getStorageAdminClient() {
  const supabase = getSupabaseEnvironment();
  const storage = getStorageAdminEnvironment();
  if (!supabase || !storage) {
    throw new Error("Falta la configuración privada de Supabase Storage.");
  }

  return createClient(supabase.NEXT_PUBLIC_SUPABASE_URL, storage.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

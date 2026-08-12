import { z } from "zod";

const supabaseEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

const serverSecurityEnvironmentSchema = z.object({
  SECURITY_HMAC_SECRET: z.string().min(32),
});

const storageAdminEnvironmentSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

const turnstileEnvironmentSchema = z.object({
  TURNSTILE_SITE_KEY: z.string().min(1),
  TURNSTILE_SECRET_KEY: z.string().min(1),
  TURNSTILE_EXPECTED_HOSTNAME: z.string().min(1),
});

const cronEnvironmentSchema = z.object({
  CRON_SECRET: z.string().min(16),
});

export type SupabaseEnvironment = z.infer<typeof supabaseEnvironmentSchema>;

export function getSupabaseEnvironment(): SupabaseEnvironment | null {
  const result = supabaseEnvironmentSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });

  return result.success ? result.data : null;
}

export function hasDatabaseRuntimeConfiguration() {
  return Boolean(process.env.DATABASE_URL);
}

export function hasDatabaseCliConfiguration() {
  return Boolean(process.env.DIRECT_URL);
}

export function getServerSecurityEnvironment() {
  const result = serverSecurityEnvironmentSchema.safeParse({
    SECURITY_HMAC_SECRET: process.env.SECURITY_HMAC_SECRET,
  });

  return result.success ? result.data : null;
}

export function getStorageAdminEnvironment() {
  const result = storageAdminEnvironmentSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  return result.success ? result.data : null;
}

export function getTurnstileEnvironment() {
  const result = turnstileEnvironmentSchema.safeParse({
    TURNSTILE_SITE_KEY: process.env.TURNSTILE_SITE_KEY,
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
    TURNSTILE_EXPECTED_HOSTNAME: process.env.TURNSTILE_EXPECTED_HOSTNAME,
  });

  return result.success ? result.data : null;
}

export function getCronEnvironment() {
  const result = cronEnvironmentSchema.safeParse({
    CRON_SECRET: process.env.CRON_SECRET,
  });

  return result.success ? result.data : null;
}

export function getConfigurationIssues() {
  const issues: string[] = [];

  if (!hasDatabaseRuntimeConfiguration()) issues.push("DATABASE_URL");
  if (!hasDatabaseCliConfiguration()) issues.push("DIRECT_URL");
  if (!getSupabaseEnvironment()) {
    issues.push(
      "NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  }
  if (!getServerSecurityEnvironment()) issues.push("SECURITY_HMAC_SECRET");

  return issues;
}

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

const mercadoPagoEnvironmentSchema = z.object({
  MERCADO_PAGO_ACCESS_TOKEN: z.string().min(20).startsWith("TEST-"),
  MERCADO_PAGO_WEBHOOK_SECRET: z.string().min(16),
  MERCADO_PAGO_MODE: z.literal("TEST"),
  APP_BASE_URL: z.url(),
}).transform((environment, context) => {
  const baseUrl = new URL(environment.APP_BASE_URL);
  const localHostname = baseUrl.hostname === "localhost" || baseUrl.hostname === "127.0.0.1" || baseUrl.hostname === "::1" || baseUrl.hostname === "[::1]";
  if (baseUrl.protocol !== "https:" || localHostname || baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash) {
    context.addIssue({ code: "custom", message: "APP_BASE_URL debe ser una URL HTTPS pública sin credenciales, query ni hash." });
    return z.NEVER;
  }
  return { ...environment, APP_BASE_URL: baseUrl.toString().replace(/\/$/, "") };
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

export function getMercadoPagoEnvironment() {
  return parseMercadoPagoEnvironment({
    MERCADO_PAGO_ACCESS_TOKEN: process.env.MERCADO_PAGO_ACCESS_TOKEN,
    MERCADO_PAGO_WEBHOOK_SECRET: process.env.MERCADO_PAGO_WEBHOOK_SECRET,
    MERCADO_PAGO_MODE: process.env.MERCADO_PAGO_MODE,
    APP_BASE_URL: process.env.APP_BASE_URL,
  });
}

export function parseMercadoPagoEnvironment(environment: Record<string, unknown>) {
  const result = mercadoPagoEnvironmentSchema.safeParse(environment);
  return result.success ? result.data : null;
}

export function hasMercadoPagoConfiguration() {
  return getMercadoPagoEnvironment() !== null;
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

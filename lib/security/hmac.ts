import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { getServerSecurityEnvironment } from "@/lib/env";

export function hashSecurityValue(namespace: string, value: string) {
  const environment = getServerSecurityEnvironment();
  if (!environment) throw new Error("SECURITY_HMAC_SECRET no está configurada.");

  return createHmac("sha256", environment.SECURITY_HMAC_SECRET)
    .update(`${namespace}:${value}`, "utf8")
    .digest("base64url");
}

export function createOpaqueSecret() {
  return randomBytes(32).toString("base64url");
}

export function normalizeLoginEmail(email: string) {
  return email.trim().toLowerCase();
}

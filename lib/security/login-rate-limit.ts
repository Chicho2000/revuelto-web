import "server-only";
import { getPrisma } from "@/lib/prisma";
import { hashSecurityValue, normalizeLoginEmail } from "@/lib/security/hmac";

export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_BLOCK_MS = 15 * 60 * 1000;

type LoginIdentity = { ipHash: string; emailHash: string };
type LoginThrottleRecord = {
  failedAttempts: number;
  windowStartedAt: Date;
  blockedUntil: Date | null;
};

export function getLoginIdentity(ipAddress: string, email: string): LoginIdentity {
  return {
    ipHash: hashSecurityValue("login-ip", ipAddress),
    emailHash: hashSecurityValue("login-email", normalizeLoginEmail(email)),
  };
}

export async function getLoginThrottle(identity: LoginIdentity) {
  const record = await getPrisma().loginAttempt.findUnique({
    where: { ipHash_emailHash: identity },
    select: { failedAttempts: true, windowStartedAt: true, blockedUntil: true },
  });
  return evaluateLoginThrottle(record, new Date());
}

export function evaluateLoginThrottle(record: LoginThrottleRecord | null, now: Date) {
  if (!record || record.windowStartedAt.getTime() + LOGIN_WINDOW_MS <= now.getTime()) {
    return { blocked: false };
  }

  return {
    blocked: Boolean(record.blockedUntil && record.blockedUntil > now),
  };
}

export async function registerInvalidLogin(identity: LoginIdentity) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LOGIN_WINDOW_MS);

  return getPrisma().$transaction(async (tx) => {
    const existing = await tx.loginAttempt.findUnique({
      where: { ipHash_emailHash: identity },
    });
    const existingInWindow =
      existing && existing.windowStartedAt.getTime() + LOGIN_WINDOW_MS > now.getTime()
        ? existing
        : null;
    const failedAttempts = existingInWindow ? existingInWindow.failedAttempts + 1 : 1;
    const blockedUntil =
      failedAttempts >= LOGIN_MAX_FAILURES
        ? new Date(now.getTime() + LOGIN_BLOCK_MS)
        : null;

    return tx.loginAttempt.upsert({
      where: { ipHash_emailHash: identity },
      create: {
        ...identity,
        failedAttempts,
        windowStartedAt: now,
        lastFailedAt: now,
        blockedUntil,
        expiresAt,
      },
      update: {
        failedAttempts,
        windowStartedAt: existingInWindow ? existingInWindow.windowStartedAt : now,
        lastFailedAt: now,
        blockedUntil,
        expiresAt,
      },
    });
  });
}

export async function clearLoginThrottle(identity: LoginIdentity) {
  await getPrisma().loginAttempt.deleteMany({ where: identity });
}

export async function cleanupExpiredLoginAttempts() {
  return getPrisma().loginAttempt.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}

import "server-only";
import { getPrisma } from "@/lib/prisma";
import { hashSecurityValue } from "@/lib/security/hmac";

export const ORDER_RATE_LIMIT_MAX_REQUESTS = 20;
export const ORDER_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

export function getPublicOrderClientAddress(headers: Headers) {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim() || "unknown";
}

export function isPublicOrderRateLimited(requestCount: number) {
  return requestCount >= ORDER_RATE_LIMIT_MAX_REQUESTS;
}

export async function consumePublicOrderRateLimit(ipAddress: string) {
  const prisma = getPrisma();
  const ipHash = hashSecurityValue("public-order-ip", ipAddress);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ORDER_RATE_LIMIT_WINDOW_MS);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.publicOrderRateLimit.findUnique({ where: { ipHash } });
    const inWindow = existing && existing.windowStartedAt.getTime() + ORDER_RATE_LIMIT_WINDOW_MS > now.getTime();
    if (inWindow && isPublicOrderRateLimited(existing.requestCount)) return { limited: true };

    const requestCount = inWindow ? existing.requestCount + 1 : 1;
    await tx.publicOrderRateLimit.upsert({
      where: { ipHash },
      create: { ipHash, requestCount, windowStartedAt: now, expiresAt },
      update: { requestCount, windowStartedAt: inWindow ? existing.windowStartedAt : now, expiresAt },
    });
    return { limited: false };
  });
}

ALTER TABLE "SiteContent"
ADD COLUMN "orderingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "cashEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "transferEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "mercadoPagoEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "PublicOrderRateLimit" (
    "id" UUID NOT NULL,
    "ipHash" TEXT NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "windowStartedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PublicOrderRateLimit_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PublicOrderRateLimit_requestCount_check" CHECK ("requestCount" >= 0)
);

CREATE UNIQUE INDEX "PublicOrderRateLimit_ipHash_key" ON "PublicOrderRateLimit"("ipHash");
CREATE INDEX "PublicOrderRateLimit_expiresAt_idx" ON "PublicOrderRateLimit"("expiresAt");

ALTER TABLE "PublicOrderRateLimit" ENABLE ROW LEVEL SECURITY;

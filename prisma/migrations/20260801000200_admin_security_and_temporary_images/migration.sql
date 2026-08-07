-- New additive migration. It preserves all existing data and does not alter
-- either migration that has already been applied.

CREATE TYPE "TemporaryImageTarget" AS ENUM ('BOWL', 'PROMOTION', 'BRANCH');
CREATE TYPE "TemporaryImageStatus" AS ENUM ('STAGING', 'PROCESSING', 'READY', 'CLEANUP_PENDING', 'DISCARDED', 'CONFIRMED');

CREATE TABLE "LoginAttempt" (
    "id" UUID NOT NULL,
    "ipHash" TEXT NOT NULL,
    "emailHash" TEXT NOT NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "windowStartedAt" TIMESTAMP(3) NOT NULL,
    "lastFailedAt" TIMESTAMP(3) NOT NULL,
    "blockedUntil" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdminSessionActivity" (
    "id" UUID NOT NULL,
    "adminUserId" UUID NOT NULL,
    "sessionHash" TEXT NOT NULL,
    "lastActivityAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdminSessionActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TemporaryImage" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "target" "TemporaryImageTarget" NOT NULL,
    "status" "TemporaryImageStatus" NOT NULL DEFAULT 'STAGING',
    "stagingPath" TEXT NOT NULL,
    "tempPath" TEXT,
    "finalPath" TEXT,
    "sourceBytes" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "uploadAuthorizationExpiresAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TemporaryImage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LoginAttempt_ipHash_emailHash_key" ON "LoginAttempt"("ipHash", "emailHash");
CREATE INDEX "LoginAttempt_blockedUntil_idx" ON "LoginAttempt"("blockedUntil");
CREATE INDEX "LoginAttempt_expiresAt_idx" ON "LoginAttempt"("expiresAt");
CREATE UNIQUE INDEX "AdminSessionActivity_sessionHash_key" ON "AdminSessionActivity"("sessionHash");
CREATE INDEX "AdminSessionActivity_adminUserId_idx" ON "AdminSessionActivity"("adminUserId");
CREATE INDEX "AdminSessionActivity_expiresAt_idx" ON "AdminSessionActivity"("expiresAt");
CREATE UNIQUE INDEX "TemporaryImage_stagingPath_key" ON "TemporaryImage"("stagingPath");
CREATE UNIQUE INDEX "TemporaryImage_tempPath_key" ON "TemporaryImage"("tempPath");
CREATE UNIQUE INDEX "TemporaryImage_finalPath_key" ON "TemporaryImage"("finalPath");
CREATE INDEX "TemporaryImage_ownerId_status_idx" ON "TemporaryImage"("ownerId", "status");
CREATE INDEX "TemporaryImage_expiresAt_idx" ON "TemporaryImage"("expiresAt");

ALTER TABLE "AdminSessionActivity"
  ADD CONSTRAINT "AdminSessionActivity_adminUserId_fkey"
  FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TemporaryImage"
  ADD CONSTRAINT "TemporaryImage_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LoginAttempt"
  ADD CONSTRAINT "LoginAttempt_failedAttempts_check"
  CHECK ("failedAttempts" >= 0);

ALTER TABLE "TemporaryImage"
  ADD CONSTRAINT "TemporaryImage_sourceBytes_check"
  CHECK ("sourceBytes" IS NULL OR "sourceBytes" >= 0);

ALTER TABLE "TemporaryImage"
  ADD CONSTRAINT "TemporaryImage_width_check"
  CHECK ("width" IS NULL OR "width" > 0);

ALTER TABLE "TemporaryImage"
  ADD CONSTRAINT "TemporaryImage_height_check"
  CHECK ("height" IS NULL OR "height" > 0);

-- These security records are never exposed through Supabase Data API. Prisma
-- connects as the server database role; anon/authenticated receive no policy.
ALTER TABLE "LoginAttempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdminSessionActivity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TemporaryImage" ENABLE ROW LEVEL SECURITY;

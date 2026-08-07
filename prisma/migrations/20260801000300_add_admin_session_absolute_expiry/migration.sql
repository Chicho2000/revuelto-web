-- Add the one-hour absolute expiry without changing any existing session data.
-- Existing sessions retain a maximum lifetime measured from their creation.

ALTER TABLE "AdminSessionActivity"
  ADD COLUMN "absoluteExpiresAt" TIMESTAMP(3);

UPDATE "AdminSessionActivity"
  SET "absoluteExpiresAt" = "createdAt" + INTERVAL '1 hour'
  WHERE "absoluteExpiresAt" IS NULL;

ALTER TABLE "AdminSessionActivity"
  ALTER COLUMN "absoluteExpiresAt" SET NOT NULL;

CREATE INDEX "AdminSessionActivity_absoluteExpiresAt_idx"
  ON "AdminSessionActivity"("absoluteExpiresAt");

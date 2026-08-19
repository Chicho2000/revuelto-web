-- Add the merchandising catalog and its secure temporary-image target.

ALTER TYPE "TemporaryImageTarget" ADD VALUE IF NOT EXISTS 'MERCHANDISE';

CREATE TABLE "MerchandiseItem" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "price" DECIMAL(10, 2) NOT NULL,
  "imagePath" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MerchandiseItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MerchandiseItem_price_check" CHECK ("price" > 0)
);

CREATE INDEX "MerchandiseItem_isActive_sortOrder_createdAt_idx"
  ON "MerchandiseItem"("isActive", "sortOrder", "createdAt");

ALTER TABLE "MerchandiseItem" ENABLE ROW LEVEL SECURITY;

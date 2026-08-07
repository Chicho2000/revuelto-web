-- Regenerated offline with:
-- npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script
-- This file has not been applied to any database.

CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "AdminRole" AS ENUM ('OWNER');
CREATE TYPE "BowlSizeType" AS ENUM ('SMALL', 'LARGE');
CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

CREATE TABLE "AdminUser" (
    "id" UUID NOT NULL,
    "authUserId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'OWNER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Bowl" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT,
    "imagePath" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Bowl_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BowlSize" (
    "id" UUID NOT NULL,
    "bowlId" UUID NOT NULL,
    "size" "BowlSizeType" NOT NULL,
    "ounces" INTEGER NOT NULL,
    "eggQuantity" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "quantityNotes" TEXT,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BowlSize_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BowlSize_ounces_positive_check" CHECK ("ounces" > 0),
    CONSTRAINT "BowlSize_egg_quantity_positive_check" CHECK ("eggQuantity" > 0),
    CONSTRAINT "BowlSize_price_non_negative_check" CHECK ("price" >= 0),
    CONSTRAINT "BowlSize_size_ounces_check" CHECK (
      ("size" = 'SMALL' AND "ounces" = 25) OR
      ("size" = 'LARGE' AND "ounces" = 35)
    )
);

CREATE TABLE "Branch" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "mapsUrl" TEXT NOT NULL,
    "whatsappNumber" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessHour" (
    "id" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "openingTime" TEXT,
    "closingTime" TEXT,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "BusinessHour_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Promotion" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT,
    "imagePath" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Promotion_date_range_check" CHECK (
      "startDate" IS NULL OR "endDate" IS NULL OR "endDate" >= "startDate"
    )
);

CREATE TABLE "SiteContent" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SiteContent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminUser_authUserId_key" ON "AdminUser"("authUserId");
CREATE UNIQUE INDEX "Bowl_slug_key" ON "Bowl"("slug");
CREATE INDEX "Bowl_displayOrder_idx" ON "Bowl"("displayOrder");
CREATE INDEX "Bowl_isAvailable_isArchived_idx" ON "Bowl"("isAvailable", "isArchived");
CREATE UNIQUE INDEX "BowlSize_bowlId_size_key" ON "BowlSize"("bowlId", "size");
CREATE UNIQUE INDEX "BusinessHour_branchId_dayOfWeek_key" ON "BusinessHour"("branchId", "dayOfWeek");
CREATE INDEX "Promotion_isActive_startDate_endDate_idx" ON "Promotion"("isActive", "startDate", "endDate");
CREATE UNIQUE INDEX "SiteContent_key_key" ON "SiteContent"("key");

ALTER TABLE "BowlSize" ADD CONSTRAINT "BowlSize_bowlId_fkey"
  FOREIGN KEY ("bowlId") REFERENCES "Bowl"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessHour" ADD CONSTRAINT "BusinessHour_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

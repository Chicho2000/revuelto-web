-- Add the structured site singleton and gallery without removing legacy content rows.

ALTER TYPE "TemporaryImageTarget" ADD VALUE IF NOT EXISTS 'GALLERY';

CREATE TYPE "GalleryItemType" AS ENUM ('IMAGE', 'INSTAGRAM_VIDEO');

ALTER TABLE "SiteContent"
  ADD COLUMN "heroTitle" TEXT NOT NULL DEFAULT 'Fresco, nutritivo, resuelto.',
  ADD COLUMN "heroSubtitle" TEXT,
  ADD COLUMN "heroDescription" TEXT,
  ADD COLUMN "heroButtonText" TEXT,
  ADD COLUMN "heroButtonUrl" TEXT,
  ADD COLUMN "brandTitle" TEXT,
  ADD COLUMN "brandDescription" TEXT,
  ADD COLUMN "menuSectionTitle" TEXT,
  ADD COLUMN "menuSectionDescription" TEXT,
  ADD COLUMN "promotionsSectionTitle" TEXT,
  ADD COLUMN "promotionsSectionDescription" TEXT,
  ADD COLUMN "branchesSectionTitle" TEXT,
  ADD COLUMN "branchesSectionDescription" TEXT,
  ADD COLUMN "gallerySectionTitle" TEXT,
  ADD COLUMN "gallerySectionDescription" TEXT,
  ADD COLUMN "whatsappNumber" TEXT,
  ADD COLUMN "whatsappButtonText" TEXT,
  ADD COLUMN "whatsappDefaultMessage" TEXT,
  ADD COLUMN "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "instagramUrl" TEXT,
  ADD COLUMN "tiktokUrl" TEXT,
  ADD COLUMN "footerText" TEXT,
  ADD COLUMN "seoTitle" TEXT,
  ADD COLUMN "seoDescription" TEXT;

INSERT INTO "SiteContent" (
  "id", "key", "title", "content", "heroTitle", "heroDescription",
  "brandTitle", "brandDescription", "updatedAt"
)
VALUES (
  '00000000-0000-4000-8000-000000000005',
  'site-config',
  NULL,
  '',
  COALESCE((SELECT "title" FROM "SiteContent" WHERE "key" = 'hero'), 'Fresco, nutritivo, resuelto.'),
  (SELECT "content" FROM "SiteContent" WHERE "key" = 'hero'),
  (SELECT "title" FROM "SiteContent" WHERE "key" = 'about'),
  (SELECT "content" FROM "SiteContent" WHERE "key" = 'about'),
  CURRENT_TIMESTAMP
)
ON CONFLICT DO NOTHING;

CREATE TABLE "GalleryItem" (
  "id" UUID NOT NULL,
  "type" "GalleryItemType" NOT NULL,
  "title" TEXT,
  "description" TEXT,
  "imagePath" TEXT NOT NULL,
  "externalUrl" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GalleryItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GalleryItem_isActive_sortOrder_createdAt_idx"
  ON "GalleryItem"("isActive", "sortOrder", "createdAt");

ALTER TABLE "GalleryItem" ENABLE ROW LEVEL SECURITY;

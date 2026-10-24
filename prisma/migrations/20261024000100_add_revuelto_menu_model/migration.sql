-- CreateEnum
CREATE TYPE "BowlKind" AS ENUM ('FIXED', 'CUSTOM');

-- CreateEnum
CREATE TYPE "IngredientCategory" AS ENUM ('BASE', 'PROTEIN', 'VEGETABLE', 'SEED_NUT', 'SAUCE', 'OTHER');

-- AlterTable
ALTER TABLE "Bowl" ADD COLUMN     "kind" "BowlKind" NOT NULL DEFAULT 'FIXED',
ADD COLUMN     "price" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "Ingredient" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "IngredientCategory" NOT NULL,
    "imagePath" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BowlRecipeIngredient" (
    "bowlId" UUID NOT NULL,
    "ingredientId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isRemovable" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BowlRecipeIngredient_pkey" PRIMARY KEY ("bowlId","ingredientId")
);

-- CreateTable
CREATE TABLE "BowlChoiceGroup" (
    "id" UUID NOT NULL,
    "bowlId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" "IngredientCategory" NOT NULL,
    "minSelections" INTEGER NOT NULL,
    "maxSelections" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BowlChoiceGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BowlChoiceOption" (
    "groupId" UUID NOT NULL,
    "ingredientId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BowlChoiceOption_pkey" PRIMARY KEY ("groupId","ingredientId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ingredient_slug_key" ON "Ingredient"("slug");

-- CreateIndex
CREATE INDEX "Ingredient_category_isActive_name_idx" ON "Ingredient"("category", "isActive", "name");

-- CreateIndex
CREATE INDEX "BowlRecipeIngredient_ingredientId_idx" ON "BowlRecipeIngredient"("ingredientId");

-- CreateIndex
CREATE INDEX "BowlRecipeIngredient_bowlId_sortOrder_idx" ON "BowlRecipeIngredient"("bowlId", "sortOrder");

-- CreateIndex
CREATE INDEX "BowlChoiceGroup_bowlId_sortOrder_idx" ON "BowlChoiceGroup"("bowlId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "BowlChoiceGroup_bowlId_code_key" ON "BowlChoiceGroup"("bowlId", "code");

-- CreateIndex
CREATE INDEX "BowlChoiceOption_ingredientId_idx" ON "BowlChoiceOption"("ingredientId");

-- CreateIndex
CREATE INDEX "BowlChoiceOption_groupId_sortOrder_idx" ON "BowlChoiceOption"("groupId", "sortOrder");

-- AddForeignKey
ALTER TABLE "BowlRecipeIngredient" ADD CONSTRAINT "BowlRecipeIngredient_bowlId_fkey" FOREIGN KEY ("bowlId") REFERENCES "Bowl"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BowlRecipeIngredient" ADD CONSTRAINT "BowlRecipeIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BowlChoiceGroup" ADD CONSTRAINT "BowlChoiceGroup_bowlId_fkey" FOREIGN KEY ("bowlId") REFERENCES "Bowl"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BowlChoiceOption" ADD CONSTRAINT "BowlChoiceOption_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "BowlChoiceGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BowlChoiceOption" ADD CONSTRAINT "BowlChoiceOption_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Draft Revueltos may have no confirmed price, but a published price must be positive.
ALTER TABLE "Bowl" ADD CONSTRAINT "Bowl_price_check" CHECK ("price" IS NULL OR "price" > 0);

-- The recipe editor and order endpoint will enforce the product-specific rules.
ALTER TABLE "BowlChoiceGroup" ADD CONSTRAINT "BowlChoiceGroup_selection_limits_check"
CHECK ("minSelections" >= 0 AND "maxSelections" > 0 AND "maxSelections" >= "minSelections");

-- These tables contain admin-managed catalog data; no anon/authenticated policies are granted.
ALTER TABLE "Ingredient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BowlRecipeIngredient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BowlChoiceGroup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BowlChoiceOption" ENABLE ROW LEVEL SECURITY;

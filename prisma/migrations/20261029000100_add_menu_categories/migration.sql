CREATE TYPE "MenuCategory" AS ENUM ('REVUELTO', 'REVUELTITO', 'SANGUCHITO', 'BEBIDA');

ALTER TABLE "Bowl"
  ADD COLUMN "menuCategory" "MenuCategory" NOT NULL DEFAULT 'REVUELTO',
  ADD COLUMN "comboPrice" DECIMAL(10,2);

CREATE INDEX "Bowl_menuCategory_isVisibleInNewMenu_isArchived_displayOrder_idx"
  ON "Bowl"("menuCategory", "isVisibleInNewMenu", "isArchived", "displayOrder");

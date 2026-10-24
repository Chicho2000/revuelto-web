-- The legacy public menu still reads Bowl.isAvailable. Keep its visibility
-- independent while the new 20 oz menu is configured and rolled out.
ALTER TABLE "Bowl" ADD COLUMN "isVisibleInNewMenu" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Bowl_isVisibleInNewMenu_isArchived_displayOrder_idx"
ON "Bowl"("isVisibleInNewMenu", "isArchived", "displayOrder");

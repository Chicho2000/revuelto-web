CREATE TABLE "BowlDrinkOption" (
  "id" UUID NOT NULL,
  "bowlId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "BowlDrinkOption_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BowlDrinkOption_bowlId_sortOrder_idx" ON "BowlDrinkOption"("bowlId", "sortOrder");

ALTER TABLE "BowlDrinkOption"
  ADD CONSTRAINT "BowlDrinkOption_bowlId_fkey"
  FOREIGN KEY ("bowlId") REFERENCES "Bowl"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "BowlDrinkOption" ("id", "bowlId", "name", "sortOrder")
SELECT gen_random_uuid(), "BowlChoiceGroup"."bowlId", "Ingredient"."name", "BowlChoiceOption"."sortOrder"
FROM "BowlChoiceGroup"
JOIN "Bowl" ON "Bowl"."id" = "BowlChoiceGroup"."bowlId"
JOIN "BowlChoiceOption" ON "BowlChoiceOption"."groupId" = "BowlChoiceGroup"."id"
JOIN "Ingredient" ON "Ingredient"."id" = "BowlChoiceOption"."ingredientId"
WHERE "Bowl"."menuCategory" = 'BEBIDA' AND "BowlChoiceGroup"."code" = 'drink-variant';

-- Prisma accede en servidor; no se conceden políticas a anon/authenticated.
ALTER TABLE "BowlDrinkOption" ENABLE ROW LEVEL SECURITY;

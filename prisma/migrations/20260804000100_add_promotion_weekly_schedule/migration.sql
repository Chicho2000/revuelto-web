ALTER TABLE "Promotion"
ADD COLUMN "weeklyDays" "DayOfWeek"[] NOT NULL DEFAULT '{}'::"DayOfWeek"[],
ADD COLUMN "dailyStartTime" TEXT,
ADD COLUMN "dailyEndTime" TEXT;

ALTER TABLE "Promotion"
ADD CONSTRAINT "Promotion_daily_times_pair_check"
CHECK (
  ("dailyStartTime" IS NULL AND "dailyEndTime" IS NULL)
  OR
  ("dailyStartTime" IS NOT NULL AND "dailyEndTime" IS NOT NULL)
);

ALTER TABLE "Promotion"
ADD CONSTRAINT "Promotion_daily_start_time_format_check"
CHECK (
  "dailyStartTime" IS NULL
  OR "dailyStartTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
);

ALTER TABLE "Promotion"
ADD CONSTRAINT "Promotion_daily_end_time_format_check"
CHECK (
  "dailyEndTime" IS NULL
  OR "dailyEndTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
);

ALTER TABLE "Promotion"
ADD CONSTRAINT "Promotion_daily_time_range_check"
CHECK (
  "dailyStartTime" IS NULL
  OR "dailyEndTime" > "dailyStartTime"
);

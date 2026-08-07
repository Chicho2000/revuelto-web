-- Enable Row Level Security without policies. Prisma remains the only data
-- access path; Supabase Data API roles cannot read or write these tables.

ALTER TABLE "AdminUser" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Bowl" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BowlSize" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Branch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BusinessHour" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Promotion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SiteContent" ENABLE ROW LEVEL SECURITY;

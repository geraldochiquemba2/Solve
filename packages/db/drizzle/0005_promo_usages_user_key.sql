ALTER TABLE "promo_usages" ADD COLUMN IF NOT EXISTS "user_key" varchar(255);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_promo_usages_user_key" ON "promo_usages" ("promo_id","user_key");

ALTER TABLE "users" ADD COLUMN "login_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "users" SET "login_count" = 0 WHERE "login_count" IS NULL;--> statement-breakpoint

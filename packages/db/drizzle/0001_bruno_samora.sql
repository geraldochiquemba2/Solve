ALTER TABLE "leads" ADD COLUMN "external_id" varchar(100);--> statement-breakpoint
CREATE UNIQUE INDEX "leads_external_id_idx" ON "leads" USING btree ("external_id") WHERE "external_id" IS NOT NULL;
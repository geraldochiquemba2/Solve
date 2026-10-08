CREATE TYPE "public"."promo_type" AS ENUM('percent', 'fixed');--> statement-breakpoint
CREATE TABLE "promo_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" varchar(50) NOT NULL,
  "type" "promo_type" DEFAULT 'percent' NOT NULL,
  "value" integer NOT NULL,
  "min_amount" integer,
  "max_discount" integer,
  "applies_to" varchar(20) DEFAULT 'all' NOT NULL,
  "plan_ids" jsonb,
  "usage_limit" integer,
  "used_count" integer DEFAULT 0 NOT NULL,
  "per_user" boolean DEFAULT true NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "starts_at" timestamp,
  "expires_at" timestamp,
  "created_by" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "promo_codes_code_unique" UNIQUE("code"),
  CONSTRAINT "promo_codes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action
);--> statement-breakpoint
CREATE TABLE "promo_usages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "promo_id" uuid NOT NULL,
  "user_id" uuid,
  "customer_id" uuid,
  "email" varchar(255),
  "phone" varchar(50),
  "payment_code" varchar(50),
  "amount_before" integer,
  "amount_after" integer,
  "discount_applied" integer,
  "used_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "promo_usages_promo_id_promo_codes_id_fk" FOREIGN KEY ("promo_id") REFERENCES "promo_codes"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "promo_usages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action,
  CONSTRAINT "promo_usages_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE no action ON UPDATE no action
);--> statement-breakpoint
CREATE INDEX "idx_promo_usages_promo_id" ON "promo_usages" USING btree ("promo_id");--> statement-breakpoint
CREATE INDEX "idx_promo_usages_email_phone" ON "promo_usages" USING btree ("email","phone");

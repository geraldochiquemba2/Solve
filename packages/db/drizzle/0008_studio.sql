-- SamoraFit Studio (ginásio): espelho de clientes, planos, subscrições,
-- pagamentos, faturas, reembolsos e alocações recebidos pela API de ingestão.

CREATE TABLE IF NOT EXISTS "studio_customers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "external_id" varchar(100) NOT NULL UNIQUE,
  "customer_number" varchar(20),
  "legacy_id" varchar(50),
  "card_number" varchar(50),
  "full_name" varchar(200) NOT NULL,
  "photo_url" text,
  "birth_date" date,
  "gender" varchar(10),
  "nif" varchar(30),
  "phone" varchar(30),
  "email" varchar(255),
  "status" varchar(20) DEFAULT 'ACTIVE' NOT NULL,
  "notes" text,
  "enrollment_paid_at" date,
  "crm_customer_id" uuid REFERENCES "customers"("id") ON DELETE SET NULL,
  "source_created_at" timestamp,
  "source_updated_at" timestamp,
  "raw" jsonb,
  "synced_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "studio_customers_name_idx" ON "studio_customers" ("full_name");
CREATE INDEX IF NOT EXISTS "studio_customers_phone_idx" ON "studio_customers" ("phone");
CREATE INDEX IF NOT EXISTS "studio_customers_nif_idx" ON "studio_customers" ("nif");
CREATE INDEX IF NOT EXISTS "studio_customers_status_idx" ON "studio_customers" ("status");

CREATE TABLE IF NOT EXISTS "studio_plans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "external_id" varchar(100) NOT NULL UNIQUE,
  "name" varchar(100) NOT NULL,
  "price" numeric(12,2) DEFAULT '0' NOT NULL,
  "enrollment_fee" numeric(12,2) DEFAULT '0' NOT NULL,
  "renewal_fee" numeric(12,2) DEFAULT '0' NOT NULL,
  "plan_type" varchar(20),
  "classes_quantity" integer,
  "calculation_mode" varchar(20),
  "validity_days" integer,
  "validity_months" integer DEFAULT 1 NOT NULL,
  "rules" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "crm_plan_id" uuid REFERENCES "plans"("id") ON DELETE SET NULL,
  "raw" jsonb,
  "synced_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "studio_plans_active_idx" ON "studio_plans" ("is_active");

CREATE TABLE IF NOT EXISTS "studio_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "external_id" varchar(100) NOT NULL UNIQUE,
  "customer_external_id" varchar(100) NOT NULL,
  "plan_external_id" varchar(100) NOT NULL,
  "start_date" date NOT NULL,
  "end_date" date,
  "price" numeric(12,2) DEFAULT '0' NOT NULL,
  "classes_quantity" integer,
  "status" varchar(20) DEFAULT 'ACTIVE' NOT NULL,
  "source_created_at" timestamp,
  "source_updated_at" timestamp,
  "raw" jsonb,
  "synced_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "studio_subscriptions_customer_idx" ON "studio_subscriptions" ("customer_external_id");
CREATE INDEX IF NOT EXISTS "studio_subscriptions_status_idx" ON "studio_subscriptions" ("status");

CREATE TABLE IF NOT EXISTS "studio_payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "external_id" varchar(100) NOT NULL UNIQUE,
  "customer_external_id" varchar(100),
  "amount" numeric(12,2) DEFAULT '0' NOT NULL,
  "kind" varchar(20),
  "payment_date" date,
  "payment_method" varchar(20),
  "status" varchar(20) DEFAULT 'PENDING' NOT NULL,
  "reference" varchar(100),
  "notes" text,
  "unallocated_amount" numeric(12,2) DEFAULT '0' NOT NULL,
  "enrollment_amount" numeric(12,2) DEFAULT '0' NOT NULL,
  "reactivation_amount" numeric(12,2) DEFAULT '0' NOT NULL,
  "discount_percent" numeric(5,2) DEFAULT '0' NOT NULL,
  "discount_amount" numeric(12,2) DEFAULT '0' NOT NULL,
  "registered_by_external_id" varchar(100),
  "raw" jsonb,
  "source_created_at" timestamp,
  "source_updated_at" timestamp,
  "synced_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "studio_payments_customer_idx" ON "studio_payments" ("customer_external_id");
CREATE INDEX IF NOT EXISTS "studio_payments_status_idx" ON "studio_payments" ("status");
CREATE INDEX IF NOT EXISTS "studio_payments_date_idx" ON "studio_payments" ("payment_date");

CREATE TABLE IF NOT EXISTS "studio_invoices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "external_id" varchar(100) NOT NULL UNIQUE,
  "customer_external_id" varchar(100) NOT NULL,
  "subscription_external_id" varchar(100),
  "year" integer,
  "month" integer,
  "period_start" date,
  "period_end" date,
  "amount_due" numeric(12,2) DEFAULT '0' NOT NULL,
  "amount_paid" numeric(12,2) DEFAULT '0' NOT NULL,
  "amount_released" numeric(12,2) DEFAULT '0' NOT NULL,
  "amount_remaining" numeric(12,2) DEFAULT '0' NOT NULL,
  "status" varchar(20) DEFAULT 'PENDING' NOT NULL,
  "due_date" date,
  "paid_at" timestamp,
  "is_partial" boolean DEFAULT false NOT NULL,
  "notes" text,
  "raw" jsonb,
  "synced_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "studio_invoices_customer_idx" ON "studio_invoices" ("customer_external_id");
CREATE INDEX IF NOT EXISTS "studio_invoices_status_idx" ON "studio_invoices" ("status");
CREATE INDEX IF NOT EXISTS "studio_invoices_period_idx" ON "studio_invoices" ("period_start");

CREATE TABLE IF NOT EXISTS "studio_refunds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "external_id" varchar(100) NOT NULL UNIQUE,
  "payment_external_id" varchar(100),
  "customer_external_id" varchar(100),
  "amount" numeric(12,2) DEFAULT '0' NOT NULL,
  "reason" text,
  "status" varchar(20) DEFAULT 'CONFIRMED' NOT NULL,
  "refunded_at" timestamp,
  "raw" jsonb,
  "synced_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "studio_refunds_payment_idx" ON "studio_refunds" ("payment_external_id");

CREATE TABLE IF NOT EXISTS "studio_payment_allocations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "external_id" varchar(100) NOT NULL UNIQUE,
  "payment_external_id" varchar(100) NOT NULL,
  "invoice_external_id" varchar(100) NOT NULL,
  "amount" numeric(12,2) DEFAULT '0' NOT NULL,
  "raw" jsonb,
  "synced_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "studio_allocations_payment_idx" ON "studio_payment_allocations" ("payment_external_id");

CREATE TABLE IF NOT EXISTS "studio_api_keys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(255) NOT NULL,
  "key_hash" varchar(128) NOT NULL UNIQUE,
  "key_prefix" varchar(16) NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "last_used_at" timestamp,
  "expires_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "studio_sync_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event" varchar(50) NOT NULL,
  "entity" varchar(50),
  "received_count" integer DEFAULT 0 NOT NULL,
  "upserted_count" integer DEFAULT 0 NOT NULL,
  "error_count" integer DEFAULT 0 NOT NULL,
  "status" varchar(20) DEFAULT 'ok' NOT NULL,
  "message" text,
  "started_at" timestamp DEFAULT now() NOT NULL,
  "finished_at" timestamp
);

CREATE INDEX IF NOT EXISTS "studio_sync_log_started_idx" ON "studio_sync_log" ("started_at");

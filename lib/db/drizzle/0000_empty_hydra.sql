CREATE TYPE "public"."automation_status" AS ENUM('activo', 'inactivo');--> statement-breakpoint
CREATE TYPE "public"."customer_state" AS ENUM('activo', 'inactivo', 'em_atraso', 'suspenso');--> statement-breakpoint
CREATE TYPE "public"."integration_status" AS ENUM('operacional', 'atencao', 'erro', 'inativo');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('novo_lead', 'contacto', 'qualificado', 'proposta', 'negociacao', 'convertido', 'perdido');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pendente', 'confirmado', 'rejeitado', 'reembolsado', 'em_atraso');--> statement-breakpoint
CREATE TYPE "public"."plan_periodicity" AS ENUM('mensal', 'trimestral', 'semestral', 'anual');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('administrador', 'gestor', 'comercial', 'financeiro', 'operacional');--> statement-breakpoint
CREATE TYPE "public"."webhook_status" AS ENUM('pendente', 'entregue', 'falha', 'reprocessado');--> statement-breakpoint
CREATE TABLE "access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"platform" varchar(50) NOT NULL,
	"status" varchar(50) NOT NULL,
	"ovg_access_id" varchar(100),
	"cademi_access_id" varchar(100),
	"activated_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor" varchar(255) NOT NULL,
	"actor_id" uuid,
	"action" varchar(255) NOT NULL,
	"entity" varchar(100),
	"entity_id" uuid,
	"details" jsonb,
	"ip_address" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"trigger" varchar(100) NOT NULL,
	"action" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"run_count" integer DEFAULT 0 NOT NULL,
	"last_run_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"location" varchar(255),
	"ovg_checkin_id" varchar(100),
	"checked_in_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"cademi_course_id" varchar(100),
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"enrolled_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255),
	"phone" varchar(50),
	"company" varchar(255),
	"nif" varchar(50),
	"birth_date" timestamp,
	"state" "customer_state" DEFAULT 'activo' NOT NULL,
	"ovg_id" varchar(100),
	"cademi_id" varchar(100),
	"whatsapp_phone" varchar(50),
	"lead_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customers_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"status" "integration_status" DEFAULT 'inativo' NOT NULL,
	"config" jsonb,
	"last_sync_at" timestamp,
	"error_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "integrations_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255),
	"phone" varchar(50),
	"company" varchar(255),
	"source" varchar(100),
	"status" "lead_status" DEFAULT 'novo_lead' NOT NULL,
	"owner_id" uuid,
	"estimated_value" integer,
	"notes" text,
	"ovg_id" varchar(100),
	"converted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "leads_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"customer_id" uuid NOT NULL,
	"subscription_id" uuid,
	"amount" integer NOT NULL,
	"method" varchar(50),
	"status" "payment_status" DEFAULT 'pendente' NOT NULL,
	"reference_code" varchar(100),
	"ekwanza_code" varchar(100),
	"ekwanza_operation_code" varchar(100),
	"paid_at" timestamp,
	"reconciled_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payments_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"price" integer NOT NULL,
	"periodicity" "plan_periodicity" DEFAULT 'mensal' NOT NULL,
	"duration" integer,
	"active" boolean DEFAULT true NOT NULL,
	"ovg_plan_id" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(255) NOT NULL,
	"value" jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"active" boolean DEFAULT true NOT NULL,
	"ovg_synced" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'comercial' NOT NULL,
	"avatar" varchar(255),
	"phone" varchar(50),
	"active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_id" uuid NOT NULL,
	"event" varchar(100) NOT NULL,
	"payload" jsonb,
	"status" "webhook_status" DEFAULT 'pendente' NOT NULL,
	"response_code" integer,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_retry_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" varchar(500) NOT NULL,
	"event" varchar(100) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"secret" varchar(255),
	"last_triggered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "access" ADD CONSTRAINT "access_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_courses" ADD CONSTRAINT "customer_courses_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_courses" ADD CONSTRAINT "customer_courses_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhooks"("id") ON DELETE no action ON UPDATE no action;
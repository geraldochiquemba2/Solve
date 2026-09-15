// Migração delta — aproxima a BD do schema atual (src/schema/index.ts).
// A snapshot 0000_empty_hydra.sql está desatualizada: falta 'expirado' no enum,
// colunas entity/expires_at em payments, e as tabelas api_keys/portal_otps/solve_access_logs.
// Idempotente (IF NOT EXISTS). Uso: DATABASE_URL="<url>" node packages/db/migrate-delta.cjs
const pg = require('pg');

const statements = [
  // 1. Enum payment_status: valor 'expirado' (usado pelo job EXPIRY)
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='payment_status' AND e.enumlabel='expirado') THEN
       ALTER TYPE "public"."payment_status" ADD VALUE 'expirado';
     END IF;
   END $$`,
  // 2. Colunas em falta em payments
  `ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "entity" varchar(50)`,
  `ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "expires_at" timestamp`,
  // 2b. Colunas em falta em customers (snapshot sem joined_at/gender)
  `ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "joined_at" timestamp`,
  `ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "gender" varchar(20)`,
  // 2c. Aulas em falta por subscription (sync Cademi preenche; lista Clientes lê daqui)
  `ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "lessons_total" integer`,
  `ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "lessons_done" integer DEFAULT 0`,
  // 3. Tabelas criadas depois da snapshot
  `CREATE TABLE IF NOT EXISTS "api_keys" (
     "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
     "name" varchar(255) NOT NULL,
     "key" varchar(255) NOT NULL,
     "user_id" uuid REFERENCES "users"("id"),
     "active" boolean DEFAULT true NOT NULL,
     "last_used_at" timestamp,
     "expires_at" timestamp,
     "created_at" timestamp DEFAULT now() NOT NULL,
     "updated_at" timestamp DEFAULT now() NOT NULL,
     CONSTRAINT "api_keys_key_unique" UNIQUE("key")
   )`,
  `CREATE TABLE IF NOT EXISTS "portal_otps" (
     "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
     "phone" varchar(50) NOT NULL,
     "code_hash" text NOT NULL,
     "expires_at" timestamp NOT NULL,
     "attempts" integer DEFAULT 0 NOT NULL,
     "consumed" boolean DEFAULT false NOT NULL,
     "created_at" timestamp DEFAULT now() NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS "solve_access_logs" (
     "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
     "remote_id" integer NOT NULL,
     "customer_id" integer NOT NULL,
     "customer_name" varchar(255),
     "access_date" varchar(10) NOT NULL,
     "access_time" varchar(20) NOT NULL,
     "access_type" varchar(20) NOT NULL,
     "result" varchar(20) NOT NULL,
     "reason" text,
     "synced_at" timestamp DEFAULT now() NOT NULL,
     CONSTRAINT "solve_access_logs_remote_id_unique" UNIQUE("remote_id")
   )`,
  // 4. Índices que falharam antes por colunas/tabelas em falta
  `CREATE INDEX IF NOT EXISTS idx_payments_status_expires ON payments(status, expires_at)`,
  `CREATE INDEX IF NOT EXISTS idx_portal_otps_phone ON portal_otps(phone)`,
];

async function run() {
  // Fase 2 BDs: opera sobre a BD do CRM (CRM_DATABASE_URL, nova).
  process.env.DATABASE_URL = process.env.CRM_DATABASE_URL || process.env.DATABASE_URL;
  if (!process.env.DATABASE_URL) {
    console.error('FATAL: define CRM_DATABASE_URL. Ex: CRM_DATABASE_URL="..." node packages/db/migrate-delta.cjs');
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  for (const s of statements) {
    try { await client.query(s); console.log('OK:', s.replace(/\s+/g, ' ').slice(0, 80)); }
    catch (e) { console.error('FALHOU:', s.replace(/\s+/g, ' ').slice(0, 80), '-', e.message); process.exitCode = 1; }
  }
  await client.end();
  console.log('Delta aplicado.');
}
run();

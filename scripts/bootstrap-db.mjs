#!/usr/bin/env node
// Bootstrap da BD: aplica o schema completo (migrations em packages/db/drizzle).
// Funciona com qualquer Postgres (Supabase pooler, local, etc.). Idempotente.
//
// Uso:
//   DATABASE_URL="postgresql://postgres.<ref>:<pass>@aws-0-<reg>.pooler.supabase.com:6543/postgres" \
//     node scripts/bootstrap-db.mjs
//
// Tolerante a reexecucao: erros "ja existe" (tabela/tipo/coluna) sao ignorados.
import pg from "pg";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRIZZLE = resolve(__dirname, "../packages/db/drizzle");

const DB_URL = process.env.CRM_DATABASE_URL || process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("FATAL: define CRM_DATABASE_URL ou DATABASE_URL.");
  process.exit(1);
}

const clean = (u) =>
  u.replace(/[?&]sslmode=[^&]*/g, "")
    .replace("&channel_binding=require", "")
    .replace("channel_binding=require&", "");

const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED === "false" ? false : true;
const pool = new pg.Pool({
  connectionString: clean(DB_URL),
  ssl: rejectUnauthorized === false ? false : { rejectUnauthorized: true },
  connectionTimeoutMillis: 30000,
});
const client = await pool.connect();

const TOLERATE = new Set(["42P07", "42710", "42P16", "42701"]);
async function exec(stmt) {
  try {
    await client.query(stmt);
  } catch (e) {
    if (TOLERATE.has(e.code)) return;
    throw new Error(`${e.message}\n--- SQL:\n${stmt.slice(0, 300)}`);
  }
}

console.log("==> A aplicar schema (migrations)...");
const files = readdirSync(DRIZZLE).filter((f) => f.endsWith(".sql")).sort();
for (const f of files) {
  const sql = readFileSync(resolve(DRIZZLE, f), "utf8");
  const stmts = sql.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);
  console.log(`  - ${f} (${stmts.length} statements)`);
  for (const s of stmts) await exec(s);
}

console.log("==> A garantir tabelas auxiliares (standalone-server)...");
for (const stmt of [
  `CREATE TABLE IF NOT EXISTS sync_log (id SERIAL PRIMARY KEY, synced_at TIMESTAMPTZ DEFAULT NOW(), records_synced INT DEFAULT 0, source TEXT DEFAULT 'sync_crm')`,
  `CREATE TABLE IF NOT EXISTS ovg_members (customer_number TEXT PRIMARY KEY, name TEXT, sex TEXT, nif TEXT, mobile_number TEXT, email TEXT, status TEXT, club TEXT, last_entry TEXT, entry_date TEXT, synced_at TIMESTAMPTZ DEFAULT NOW())`,
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS cademi_id TEXT`,
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS joined_at TIMESTAMP`,
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS gender VARCHAR(20)`,
  `ALTER TABLE payments ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP`,
  `ALTER TABLE payments ADD COLUMN IF NOT EXISTS entity VARCHAR(50)`,
  `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS lessons_total INTEGER`,
  `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS lessons_done INTEGER DEFAULT 0`,
  `ALTER TABLE payments ALTER COLUMN customer_id DROP NOT NULL`,
  `ALTER TABLE leads ADD COLUMN IF NOT EXISTS external_id varchar(100)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS leads_external_id_idx ON leads (external_id) WHERE external_id IS NOT NULL`,
]) await exec(stmt);

const t = await client.query(
  "SELECT count(*)::int n FROM information_schema.tables WHERE table_schema='public'",
);
console.log(`\n==> Schema aplicado. Tabelas em public: ${t.rows[0].n}`);
console.log("    Segue com o seed: node packages/db/seed-cademi-db.cjs");

client.release();
await pool.end();
console.log("OK.");

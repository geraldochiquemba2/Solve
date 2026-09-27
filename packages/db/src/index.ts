import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// Fase 2 BDs: o CRM (Cademi) usa CRM_DATABASE_URL (BD nova).
// DATABASE_URL mantém a do ginásio (projeto antigo) — intocada.
const CRM_URL = process.env.CRM_DATABASE_URL || process.env.DATABASE_URL;

if (!CRM_URL) {
  throw new Error(
    "CRM_DATABASE_URL (ou DATABASE_URL) must be set. Did you forget to provision a database?",
  );
}

const connectionString = CRM_URL
  .replace("&channel_binding=require", "")
  .replace("channel_binding=require&", "");

export const pool = new Pool({
  connectionString,
  // Verifica o certificado do servidor por omissão. Só desligar com
  // DB_SSL_REJECT_UNAUTHORIZED=false (BD local com certificado self-signed):
  // sem isso a ligação fica vulnerável a MITM.
  ssl: { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false" },
  connectionTimeoutMillis: 15000,
  max: 5,
});
export const db = drizzle(pool, { schema });

export * from "./schema";

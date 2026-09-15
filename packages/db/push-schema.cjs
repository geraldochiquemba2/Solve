// Push do schema Drizzle para a BD apontada por DATABASE_URL (parametrizado — sem segredos hardcoded).
// Uso:  DATABASE_URL="<url>" node packages/db/push-schema.cjs
const { readFileSync } = require('fs');
const { join } = require('path');
const pg = require('pg');

async function run() {
  // Fase 2 BDs: opera sobre a BD do CRM (CRM_DATABASE_URL, nova).
  process.env.DATABASE_URL = process.env.CRM_DATABASE_URL || process.env.DATABASE_URL;
  if (!process.env.DATABASE_URL) {
    console.error('FATAL: define CRM_DATABASE_URL. Ex: CRM_DATABASE_URL="..." node packages/db/push-schema.cjs');
    process.exit(1);
  }
  const sql = readFileSync(join(__dirname, 'drizzle', '0000_empty_hydra.sql'), 'utf-8');
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const statements = sql.split('--> statement-breakpoint').map(s => s.trim()).filter(s => s.length > 0);
  const client = await pool.connect();
  try {
    for (const stmt of statements) {
      console.log(`Running: ${stmt.substring(0, 80)}...`);
      await client.query(stmt);
    }
    console.log('\nSchema criada com sucesso!');
  } catch (err) {
    console.error('Erro:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}
run();

import pg from 'pg';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const sql = readFileSync(resolve('..', 'lib', 'db', 'drizzle', '0000_empty_hydra.sql'), 'utf-8');

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const statements = sql
  .split('--> statement-breakpoint')
  .map(s => s.trim())
  .filter(s => s.length > 0);

const client = await pool.connect();
try {
  for (const stmt of statements) {
    console.log(`Running: ${stmt.substring(0, 80)}...`);
    await client.query(stmt);
  }
  console.log('\nSchema criada com sucesso!');
} catch (err) {
  console.error('Erro:', err.message);
} finally {
  client.release();
  await pool.end();
}

// SEGURANÇA Set/2026: segredo via env, nunca hardcoded.
// DEPRECATED one-shot. NAO usar sem definir as variáveis de ambiente.
const { Client } = require('C:/Users/Geraldo/Downloads/Solve-Corporate-CRM/Solve-Corporate-CRM/packages/db/node_modules/pg');
const bcrypt = require('C:/Users/Geraldo/Downloads/Solve-Corporate-CRM/Solve-Corporate-CRM/apps/api/node_modules/bcryptjs');

const DB_URL = (process.env.CRM_DATABASE_URL || process.env.DATABASE_URL || "");
if (!DB_URL) { console.error('FATAL: define CRM_DATABASE_URL ou DATABASE_URL no ambiente.'); process.exit(1); }
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
if (!ADMIN_PASSWORD) { console.error('FATAL: define ADMIN_PASSWORD no ambiente.'); process.exit(1); }
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@solvecorporate.ao';

const client = new Client({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
});

async function run() {
  await client.connect();
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await client.query("UPDATE users SET password_hash = $1 WHERE email = $2", [hash, ADMIN_EMAIL]);
  console.log('Password updated with bcrypt hash');
  const r = await client.query("SELECT email, left(password_hash, 20) as pw_prefix FROM users");
  console.log(r.rows);
  await client.end();
}

run().catch(e => { console.error(e.message); process.exit(1); });

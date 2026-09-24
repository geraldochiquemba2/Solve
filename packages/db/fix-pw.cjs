// SEGURANÇA Set/2026: segredo via env, nunca hardcoded.
const { Client } = require('./node_modules/pg');
const bcrypt = require('bcryptjs');
const DB_URL = (process.env.CRM_DATABASE_URL || process.env.DATABASE_URL || "");
if (!DB_URL) { console.error('FATAL: define CRM_DATABASE_URL ou DATABASE_URL no ambiente.'); process.exit(1); }
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
if (!ADMIN_PASSWORD) { console.error('FATAL: define ADMIN_PASSWORD no ambiente.'); process.exit(1); }
const client = new Client({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false }
});
async function run() {
  await client.connect();
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await client.query("UPDATE users SET password_hash = $1 WHERE email = 'admin@solvecorporate.ao'", [hash]);
  console.log('Password updated');
  const r = await client.query("SELECT email, password_hash FROM users");
  console.log(r.rows);
  await client.end();
}
run().catch(e => { console.error(e.message); process.exit(1); });

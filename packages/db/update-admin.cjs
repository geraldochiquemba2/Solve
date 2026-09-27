const { Client } = require('pg');
const crypto = require('crypto');
const bcrypt = require('./node_modules/bcryptjs');

// SEGURANÇA Set/2026: segredo via env, nunca hardcoded.
const DB_URL = (process.env.CRM_DATABASE_URL || process.env.DATABASE_URL || "");
if (!DB_URL) { console.error('FATAL: define CRM_DATABASE_URL ou DATABASE_URL no ambiente.'); process.exit(1); }
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
if (!ADMIN_PASSWORD) { console.error('FATAL: define ADMIN_PASSWORD no ambiente.'); process.exit(1); }
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@solvecorporate.ao';
const ADMIN_PHONE = process.env.ADMIN_PHONE || "";
if (!ADMIN_PHONE) { console.error('FATAL: define ADMIN_PHONE no ambiente.'); process.exit(1); }

const client = new Client({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
});

async function run() {
  await client.connect();
  console.log('A actualizar admin...');

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  await client.query(
    `UPDATE users SET phone = $2, password_hash = $1 WHERE email = $3`,
    [passwordHash, ADMIN_PHONE, ADMIN_EMAIL]
  );

  console.log('✓ Admin actualizado');
  console.log(`  Telefone: ${ADMIN_PHONE}`);

  await client.end();
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });

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

function uuid() { return crypto.randomUUID(); }
function now() { return new Date().toISOString(); }

async function run() {
  await client.connect();
  console.log('A criar admin e integrações...');

  // 1. Admin user com password hasheada
  const userId = uuid();
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  await client.query(
    `INSERT INTO users (id, name, email, password_hash, role, phone, active) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [userId, 'Bruno Samora', ADMIN_EMAIL, passwordHash, 'administrador', ADMIN_PHONE, true]
  );
  console.log(`✓ Admin criado: ${ADMIN_EMAIL}`);

  // 2. Integrações
  const integrations = [
    { name: 'ovg', status: 'operacional' },
    { name: 'pay4all', status: 'operacional' },
    { name: 'cademi', status: 'operacional' },
    { name: 'whatsapp', status: 'inativo' },
    { name: 'website', status: 'operacional' },
  ];

  for (const ig of integrations) {
    await client.query(
      `INSERT INTO integrations (id, name, status, error_count, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)`,
      [uuid(), ig.name, ig.status, 0, now(), now()]
    );
  }
  console.log('✓ 5 integrações registadas');

  console.log('\nPronto! Podes fazer login com:');
  console.log(`  Email: ${ADMIN_EMAIL}`);

  await client.end();
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });

const { Client } = require('pg');
const crypto = require('crypto');
const bcrypt = require('./node_modules/bcryptjs');

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_bXxHCos9Z3Nl@ep-rapid-heart-a5mtx2z6-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

function uuid() { return crypto.randomUUID(); }
function now() { return new Date().toISOString(); }

async function run() {
  await client.connect();
  console.log('A criar admin e integrações...');

  // 1. Admin user com password hasheada
  const userId = uuid();
  const password = 'SolveCorporate2026!';
  const passwordHash = await bcrypt.hash(password, 10);

  await client.query(
    `INSERT INTO users (id, name, email, password_hash, role, phone, active) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [userId, 'Bruno Samora', 'admin@solvecorporate.ao', passwordHash, 'administrador', '+244923456789', true]
  );
  console.log(`✓ Admin criado: admin@solvecorporate.ao / ${password}`);

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
  console.log('  Email: admin@solvecorporate.ao');
  console.log('  Password: SolveCorporate2026!');

  await client.end();
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });

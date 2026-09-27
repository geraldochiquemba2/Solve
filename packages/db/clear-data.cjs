const { Client } = require('pg');

// SEGURANÇA Set/2026: segredo via env, nunca hardcoded.
const DB_URL = (process.env.CRM_DATABASE_URL || process.env.DATABASE_URL || "");
if (!DB_URL) { console.error('FATAL: define CRM_DATABASE_URL ou DATABASE_URL no ambiente.'); process.exit(1); }

const client = new Client({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
});

async function run() {
  await client.connect();
  console.log('Limpando dados fictícios...');

  // Ordem de eliminação (respeitar foreign keys)
  const tables = [
    'audit_logs',
    'webhook_deliveries',
    'webhooks',
    'automations',
    'checkins',
    'customer_courses',
    'courses',
    'access',
    'payments',
    'subscriptions',
    'customers',
    'leads',
    'plans',
    'integrations',
    'settings',
    'api_keys',
    'users'
  ];

  for (const table of tables) {
    try {
      await client.query(`DELETE FROM ${table}`);
      console.log(`  ✓ ${table} limpo`);
    } catch (e) {
      console.log(`  ⚠ ${table}: ${e.message}`);
    }
  }

  // Reset sequences
  console.log('\nA reiniciar sequences...');
  await client.query("ALTER SEQUENCE IF EXISTS users_id_seq RESTART WITH 1");
  await client.query("ALTER SEQUENCE IF EXISTS leads_id_seq RESTART WITH 1");
  await client.query("ALTER SEQUENCE IF EXISTS customers_id_seq RESTART WITH 1");

  console.log('\nBase de dados limpa! Pronta para dados reais.');
  await client.end();
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });

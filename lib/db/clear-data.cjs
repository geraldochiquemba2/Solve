const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_bXxHCos9Z3Nl@ep-rapid-heart-a5mtx2z6-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
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

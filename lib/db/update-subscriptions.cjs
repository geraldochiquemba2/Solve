const { Client } = require('pg');
const crypto = require('crypto');

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_bXxHCos9Z3Nl@ep-rapid-heart-a5mtx2z6-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

const CADEMI_API = 'https://brunosamora.cademi.com.br/api/v1';
const CADEMI_KEY = '3f4de508-842e-4c22-b0c9-c244e3cb2e45';

async function cademiGet(path) {
  const res = await fetch(`${CADEMI_API}${path}`, {
    headers: { 'Authorization': `Bearer ${CADEMI_KEY}`, 'Content-Type': 'application/json' }
  });
  return res.json();
}

async function run() {
  await client.connect();
  console.log('A actualizar subscrições com dados reais do Cademi...\n');

  // Get all users from Cademi
  const usersRes = await cademiGet('/usuario');
  const users = usersRes.data?.usuario || [];

  let updated = 0;

  for (const user of users) {
    if (!user.email) continue;

    // Get access data
    let accessRes;
    try {
      accessRes = await cademiGet(`/usuario/acesso/${user.id}`);
    } catch { continue; }

    const accesses = accessRes.data?.acesso || [];
    if (accesses.length === 0) continue;

    // Find customer in our DB
    const cust = await client.query(`SELECT id FROM customers WHERE email = $1`, [user.email]);
    if (cust.rows.length === 0) continue;
    const customerId = cust.rows[0].id;

    for (const access of accesses) {
      const productName = access.produto?.nome;
      if (!productName) continue;

      // Find plan
      const plan = await client.query(`SELECT id FROM plans WHERE name = $1`, [productName]);
      if (plan.rows.length === 0) continue;
      const planId = plan.rows[0].id;

      // Check if subscription exists
      const existing = await client.query(
        `SELECT id FROM subscriptions WHERE customer_id = $1 AND plan_id = $2`,
        [customerId, planId]
      );

      if (existing.rows.length > 0) {
        // Update with real dates
        await client.query(
          `UPDATE subscriptions SET start_date = $1, end_date = $2, active = $3, updated_at = NOW() WHERE id = $4`,
          [access.comecou_em, access.encerra_em, !access.encerrado, existing.rows[0].id]
        );
        console.log(`  ✓ ${user.nome} → ${productName} (${access.comecou_em?.split('T')[0]} → ${access.encerra_em?.split('T')[0]})`);
        updated++;
      }
    }
  }

  console.log(`\n${updated} subscrições actualizadas com dados reais.`);
  await client.end();
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });

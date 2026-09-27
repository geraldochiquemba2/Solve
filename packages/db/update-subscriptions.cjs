const { Client } = require('pg');
const crypto = require('crypto');

// SEGURANÇA Set/2026: segredo via env, nunca hardcoded.
const DB_URL = (process.env.CRM_DATABASE_URL || process.env.DATABASE_URL || "");
if (!DB_URL) { console.error('FATAL: define CRM_DATABASE_URL ou DATABASE_URL no ambiente.'); process.exit(1); }

const client = new Client({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
});

const CADEMI_API = 'https://brunosamora.cademi.com.br/api/v1';
const CADEMI_KEY = process.env.CADEMI_API_KEY || "";
if (!CADEMI_KEY) { console.error('FATAL: define CADEMI_API_KEY no ambiente.'); process.exit(1); }

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

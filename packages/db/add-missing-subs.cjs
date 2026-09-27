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

async function run() {
  await client.connect();
  console.log('A buscar acessos pendentes do Cademi...\n');

  const usersRes = await fetch(CADEMI_API + '/usuario', {
    headers: { 'Authorization': 'Bearer ' + CADEMI_KEY, 'Content-Type': 'application/json' }
  });
  const usersData = await usersRes.json();
  const users = usersData.data.usuario;

  let created = 0;

  for (const user of users) {
    if (!user.email) continue;

    const cust = await client.query('SELECT id FROM customers WHERE email = $1', [user.email]);
    if (cust.rows.length === 0) continue;
    const customerId = cust.rows[0].id;

    let accessData;
    try {
      const res = await fetch(CADEMI_API + '/usuario/acesso/' + user.id, {
        headers: { 'Authorization': 'Bearer ' + CADEMI_KEY, 'Content-Type': 'application/json' }
      });
      accessData = await res.json();
    } catch (e) { continue; }

    const accesses = accessData.data && accessData.data.acesso ? accessData.data.acesso : [];

    for (const access of accesses) {
      const productName = access.produto && access.produto.nome ? access.produto.nome : null;
      if (!productName) continue;

      const plan = await client.query('SELECT id FROM plans WHERE name = $1', [productName]);
      if (plan.rows.length === 0) continue;
      const planId = plan.rows[0].id;

      const existing = await client.query('SELECT id FROM subscriptions WHERE customer_id = $1 AND plan_id = $2', [customerId, planId]);
      if (existing.rows.length > 0) continue;

      const subId = crypto.randomUUID();
      await client.query(
        'INSERT INTO subscriptions (id, customer_id, plan_id, start_date, end_date, active, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())',
        [subId, customerId, planId, access.comecou_em, access.encerra_em, !access.encerrado]
      );
      console.log('  + ' + user.nome + ' -> ' + productName);
      created++;
    }
  }

  console.log('\n' + created + ' subscrições criadas');
  await client.end();
}

run().catch(function(e) { console.error('FATAL:', e.message); process.exit(1); });

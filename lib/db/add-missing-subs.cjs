const { Client } = require('pg');
const crypto = require('crypto');

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_bXxHCos9Z3Nl@ep-rapid-heart-a5mtx2z6-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

const CADEMI_API = 'https://brunosamora.cademi.com.br/api/v1';
const CADEMI_KEY = '3f4de508-842e-4c22-b0c9-c244e3cb2e45';

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

const { Client } = require('pg');

// SEGURANÇA Set/2026: segredo via env, nunca hardcoded.
const DB_URL = (process.env.CRM_DATABASE_URL || process.env.DATABASE_URL || "");
if (!DB_URL) { console.error('FATAL: define CRM_DATABASE_URL ou DATABASE_URL no ambiente.'); process.exit(1); }

const client = new Client({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false }
});

const CADEMI_API = 'https://brunosamora.cademi.com.br/api/v1';
const CADEMI_KEY = process.env.CADEMI_API_KEY || "";
if (!CADEMI_KEY) { console.error('FATAL: define CADEMI_API_KEY no ambiente.'); process.exit(1); }

async function cademiGet(path) {
  const res = await fetch(CADEMI_API + path, {
    headers: { 'Authorization': 'Bearer ' + CADEMI_KEY, 'Content-Type': 'application/json' }
  });
  return res.json();
}

async function run() {
  await client.connect();
  console.log('A buscar datas reais do Cademi...\n');

  const usersRes = await cademiGet('/usuario');
  const users = usersRes.data && usersRes.data.usuario ? usersRes.data.usuario : [];

  let updatedCustomers = 0;
  let updatedSubscriptions = 0;

  for (const user of users) {
    if (!user.email) continue;

    const criadoEm = user.criado_em;
    if (!criadoEm) continue;

    const cust = await client.query(
      'UPDATE customers SET created_at = $1, updated_at = NOW() WHERE email = $2 RETURNING id, name',
      [criadoEm, user.email]
    );

    if (cust.rows.length === 0) continue;
    const customerId = cust.rows[0].id;
    const name = cust.rows[0].name;
    console.log('  ' + name + ' | Criado: ' + criadoEm.split('T')[0]);
    updatedCustomers++;

    var accessRes;
    try {
      accessRes = await cademiGet('/usuario/acesso/' + user.id);
    } catch(e) { continue; }

    const accesses = accessRes.data && accessRes.data.acesso ? accessRes.data.acesso : [];

    for (const access of accesses) {
      const productName = access.produto && access.produto.nome ? access.produto.nome : null;
      if (!productName) continue;

      const plan = await client.query('SELECT id FROM plans WHERE name = $1', [productName]);
      if (plan.rows.length === 0) continue;
      const planId = plan.rows[0].id;

      const sub = await client.query(
        'SELECT id FROM subscriptions WHERE customer_id = $1 AND plan_id = $2',
        [customerId, planId]
      );

      if (sub.rows.length > 0 && access.comecou_em) {
        await client.query(
          'UPDATE subscriptions SET start_date = $1, end_date = $2, active = $3, updated_at = NOW() WHERE id = $4',
          [access.comecou_em, access.encerra_em, !access.encerrado, sub.rows[0].id]
        );
        console.log('    -> ' + productName + ' | ' + access.comecou_em.split('T')[0] + ' a ' + (access.encerra_em ? access.encerra_em.split('T')[0] : '?'));
        updatedSubscriptions++;
      }
    }
  }

  console.log('\n' + updatedCustomers + ' clientes actualizados');
  console.log(updatedSubscriptions + ' subscrições actualizadas');
  await client.end();
}

run().catch(function(e) { console.error('FATAL:', e.message); process.exit(1); });

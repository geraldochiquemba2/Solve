const { Client } = require('pg');
const crypto = require('crypto');

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_bXxHCos9Z3Nl@ep-rapid-heart-a5mtx2z6-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

function uuid() { return crypto.randomUUID(); }
function now() { return new Date().toISOString(); }

async function run() {
  await client.connect();
  console.log('A criar planos e subscrições do Cademi...\n');

  // 1. Create plans from Cademi products
  const cademiProducts = [
    { cademiId: 628509, name: 'SamoraFit Workout', price: 25000, desc: 'Plano de treino completo' },
    { cademiId: 643937, name: 'teste', price: 0, desc: 'Plano de teste' },
    { cademiId: 643964, name: 'teste2', price: 0, desc: 'Plano de teste 2' },
    { cademiId: 643965, name: 'teste3', price: 0, desc: 'Plano de teste 3' },
  ];

  const planIds = {};
  for (const p of cademiProducts) {
    const id = uuid();
    await client.query(
      `INSERT INTO plans (id, name, price, periodicity, active, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, p.name, p.price, 'mensal', true, now(), now()]
    );
    planIds[p.cademiId] = id;
    console.log(`  ✓ Plano: ${p.name} (${p.price} Kz)`);
  }

  // 2. Customer-Plan mapping from Cademi access data
  const accessData = [
    { email: 'punjalerdin@gmail.com', products: [628509, 643937] },
    { email: 'admin@samora.com', products: [628509, 643937] },
    { email: 'simaoavelino13@gmail.com', products: [628509] },
    { email: 'aritsonwilala@gmail.com', products: [628509, 643937] },
  ];

  for (const access of accessData) {
    const cust = await client.query(`SELECT id FROM customers WHERE email = $1`, [access.email]);
    if (cust.rows.length === 0) continue;
    const customerId = cust.rows[0].id;

    for (const prodId of access.products) {
      const planId = planIds[prodId];
      if (!planId) continue;

      const subId = uuid();
      await client.query(
        `INSERT INTO subscriptions (id, customer_id, plan_id, start_date, active, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [subId, customerId, planId, now(), true, now(), now()]
      );
      console.log(`  ✓ Subscrição: ${access.email} → ${cademiProducts.find(p => p.cademiId === prodId)?.name}`);
    }
  }

  console.log('\nPronto! Planos e subscrições criados.');
  await client.end();
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });

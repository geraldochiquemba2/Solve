const { Client } = require('./node_modules/pg');
const crypto = require('crypto');

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_bXxHCos9Z3Nl@ep-rapid-heart-a5mtx2z6-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

function uuid() { return crypto.randomUUID(); }
function now() { return new Date().toISOString(); }

async function run() {
  await client.connect();
  console.log('Connected. Seeding...');

  // 1. Users
  const userId = uuid();
  const existing = await client.query(`SELECT id FROM users WHERE email = $1`, ['admin@solvecorporate.ao']);
  const finalUserId = existing.rows.length > 0 ? existing.rows[0].id : userId;
  if (existing.rows.length > 0) {
    console.log('Users: admin user already exists, reusing id');
  } else {
    await client.query(
      `INSERT INTO users (id, name, email, password_hash, role, phone, active) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, 'Ana Martins', 'admin@solvecorporate.ao', '1234567890', 'administrador', '999999999', true]
    );
    console.log('Users: admin user created');
  }

  // 2. Integrations
  const integrations = [
    { name: 'ovg', status: 'operacional', errorCount: 0 },
    { name: 'pay4all', status: 'operacional', errorCount: 0 },
    { name: 'cademi', status: 'atencao', errorCount: 2 },
    { name: 'whatsapp', status: 'operacional', errorCount: 0 },
    { name: 'website', status: 'operacional', errorCount: 0 },
  ];
  for (const ig of integrations) {
    await client.query(
      `INSERT INTO integrations (id, name, status, error_count, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (name) DO NOTHING`,
      [uuid(), ig.name, ig.status, ig.errorCount, now(), now()]
    );
  }
  console.log('Integrations: 5 created');

  // 3. Plans
  const plans = [
    { name: 'Starter', price: 85000, desc: 'Para equipas em inicio de operacao' },
    { name: 'Growth', price: 245000, desc: 'O plano mais utilizado pelas equipas' },
    { name: 'Enterprise', price: 500000, desc: 'Operacao avancada e integracoes dedicadas' },
  ];
  const planIds = [];
  for (const p of plans) {
    const pid = uuid();
    planIds.push(pid);
    await client.query(
      `INSERT INTO plans (id, name, description, price, periodicity, active, created_at, updated_at) VALUES ($1, $2, $3, $4, 'mensal', true, $5, $6)`,
      [pid, p.name, p.desc, p.price, now(), now()]
    );
  }
  console.log('Plans: 3 created');

  // 4. Leads
  const leads = [
    { name: 'Carlos Silva', email: 'carlos@empresa.co.ao', phone: '923456789', company: 'Silva & Associados', source: 'OVG', status: 'qualificado', value: 245000 },
    { name: 'Maria Fernandes', email: 'maria@tech.co.ao', phone: '912345678', company: 'Tech Angola', source: 'Website', status: 'contacto', value: 85000 },
    { name: 'Pedro Santos', email: 'pedro@construcoes.co.ao', phone: '934567890', company: 'Santos Construcoes', source: 'WhatsApp', status: 'novo_lead', value: 500000 },
    { name: 'Ana Rodrigues', email: 'ana@consultoria.co.ao', phone: '945678901', company: 'Consultoria Rod', source: 'OVG', status: 'proposta', value: 245000 },
    { name: 'Jorge Mendes', email: 'jorge@importacoes.co.ao', phone: '956789012', company: 'Mendes Import', source: 'Website', status: 'negociacao', value: 500000 },
  ];
  const leadIds = [];
  for (const l of leads) {
    const lid = uuid();
    leadIds.push(lid);
    await client.query(
      `INSERT INTO leads (id, code, name, email, phone, company, source, status, owner_id, estimated_value, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) ON CONFLICT (code) DO NOTHING`,
      [lid, `LED-${1000 + leads.indexOf(l)}`, l.name, l.email, l.phone, l.company, l.source, l.status, finalUserId, l.value, now(), now()]
    );
  }
  console.log('Leads: 5 created');

  // 5. Customers
  const customers = [
    { name: 'Lume & Filhos', email: 'lume@filhos.co.ao', phone: '923000111', company: 'Lume & Filhos Lda', nif: '5412345678' },
    { name: 'Fazenda 7', email: 'info@fazenda7.co.ao', phone: '923000222', company: 'Fazenda 7 Investments', nif: '5412345679' },
    { name: 'Norte Energia', email: 'norte@energia.co.ao', phone: '923000333', company: 'Norte Energia SA', nif: '5412345680' },
    { name: 'Kwanza Office', email: 'info@kwanzaoffice.co.ao', phone: '923000444', company: 'Kwanza Office Solutions', nif: '5412345681' },
    { name: 'Mosaico Digital', email: 'mosaico@digital.co.ao', phone: '923000555', company: 'Mosaico Digital Lda', nif: '5412345682' },
  ];
  const custIds = [];
  for (let i = 0; i < customers.length; i++) {
    const c = customers[i];
    const cid = uuid();
    custIds.push(cid);
    await client.query(
      `INSERT INTO customers (id, code, name, email, phone, company, nif, state, lead_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, 'activo', $8, $9, $10) ON CONFLICT (code) DO NOTHING`,
      [cid, `CLI-${2000 + i}`, c.name, c.email, c.phone, c.company, c.nif, leadIds[i], now(), now()]
    );
  }
  console.log('Customers: 5 created');

  // 6. Subscriptions + Payments
  const methods = ['Pay4All', 'Transferencia', 'Referencia'];
  const statuses = ['confirmado', 'pendente', 'em_atraso', 'confirmado', 'confirmado'];
  for (let i = 0; i < custIds.length; i++) {
    const subId = uuid();
    await client.query(
      `INSERT INTO subscriptions (id, customer_id, plan_id, start_date, active, created_at, updated_at) VALUES ($1, $2, $3, $4, true, $5, $6) ON CONFLICT DO NOTHING`,
      [subId, custIds[i], planIds[i % planIds.length], now(), now(), now()]
    );
    await client.query(
      `INSERT INTO payments (id, code, customer_id, subscription_id, amount, method, status, paid_at, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (code) DO NOTHING`,
      [uuid(), `TRX-${81000 + i}`, custIds[i], subId, [85000, 245000, 500000, 245000, 85000][i], methods[i % 3], statuses[i], now(), now(), now()]
    );
  }
  console.log('Subscriptions: 5, Payments: 5 created');

  console.log('Seeding complete!');
  await client.end();
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });

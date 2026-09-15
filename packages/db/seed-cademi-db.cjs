// Seed da BD NOVA — fase Cademi-CRM (SEM ginásio).
// Cria: admin, integrações (cademi operacional; ovg/whatsapp inativos), planos dos 4 produtos Cademi.
// Uso:  DATABASE_URL="<nova-url-neon>" node packages/db/seed-cademi-db.cjs
// NUNCA hardcoded: a URL vem do ambiente.
const { Client } = require('pg');
const crypto = require('crypto');

let bcrypt;
try { bcrypt = require('bcryptjs'); }
catch { bcrypt = require('./node_modules/bcryptjs'); }

const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

async function run() {
  // Fase 2 BDs: opera sobre a BD do CRM (CRM_DATABASE_URL, nova).
  process.env.DATABASE_URL = process.env.CRM_DATABASE_URL || process.env.DATABASE_URL;
  if (!process.env.DATABASE_URL) {
    console.error('FATAL: define CRM_DATABASE_URL. Ex: CRM_DATABASE_URL="..." node packages/db/seed-cademi-db.cjs');
    process.exit(1);
  }
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // 1. Admin (credenciais padrão do ginásio).
  // AVISO: valores via ADMIN_PHONE/ADMIN_PASSWORD quando possível — o fallback
  // abaixo existe só porque o ginásio pediu estas credenciais simples.
  const adminEmail = 'admin@solvecorporate.ao';
  const adminPhone = process.env.ADMIN_PHONE || '999999999';
  const adminPass = process.env.ADMIN_PASSWORD || '1234567890';
  const exists = await client.query('SELECT id FROM users WHERE LOWER(email)=LOWER($1)', [adminEmail]);
  if (exists.rows.length === 0) {
    const hash = await bcrypt.hash(adminPass, 10);
    await client.query(
      `INSERT INTO users (id, name, email, password_hash, role, phone, active) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [uuid(), 'Bruno Samora', adminEmail, hash, 'administrador', adminPhone, true]
    );
    console.log(`OK admin criado: ${adminEmail} / telefone ${adminPhone}`);
  } else console.log('OK admin já existe, salto.');

  // 2. Integrações — só Cademi operacional; ginásio (ovg) desligado nesta fase
  const integrations = [
    { name: 'ovg', status: 'inativo' },
    { name: 'pay4all', status: 'operacional' },
    { name: 'cademi', status: 'operacional' },
    { name: 'whatsapp', status: 'inativo' },
    { name: 'website', status: 'operacional' },
  ];
  for (const ig of integrations) {
    await client.query(
      `INSERT INTO integrations (id, name, status, error_count, created_at, updated_at)
       VALUES ($1,$2,$3,0,$4,$5) ON CONFLICT (name) DO UPDATE SET status=EXCLUDED.status, updated_at=NOW()`,
      [uuid(), ig.name, ig.status, now(), now()]
    );
  }
  console.log('OK integrações (cademi=operacional, ovg=inativo).');

  // 3. Planos = produtos reais da Cademi (confirmados via API a 15/09/2026)
  const products = [
    { name: 'SamoraFit Workout', price: 25000 },
    { name: 'teste', price: 0 },
    { name: 'teste2', price: 0 },
    { name: 'teste3', price: 0 },
  ];
  for (const p of products) {
    const r = await client.query('SELECT id FROM plans WHERE name=$1', [p.name]);
    if (r.rows.length === 0) {
      await client.query(
        `INSERT INTO plans (id, name, price, periodicity, active, created_at, updated_at) VALUES ($1,$2,$3,'mensal',true,$4,$5)`,
        [uuid(), p.name, p.price, now(), now()]
      );
      console.log('OK plano:', p.name);
    } else console.log('OK plano já existe:', p.name);
  }

  await client.end();
  console.log('Seed Cademi-CRM concluído.');
}
run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });

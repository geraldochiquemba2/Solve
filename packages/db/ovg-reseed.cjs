// Reseed OVG automático — corre no PC com IP autorizado (casa/ginásio), NÃO no Render
// (a API OVG só aceita estes IPs; o IP do Render está bloqueado).
// Agendar no Windows: schtasks 4x/dia (ver sincronizar-ovg.cmd + instruções no fim).
// Lê tudo do .env da raiz (OVG_* + CRM_DATABASE_URL). Sem segredos hardcoded.
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
require('dotenv').config({ path: path.join(ROOT, '.env') });
const pg = require('pg');

const log = (m) => console.log(`[${new Date().toISOString()}] ${m}`);

async function run() {
  const base = (process.env.OVG_API_URL || '').replace(/\/$/, '');
  const club = process.env.OVG_CLUB_CODE || 'LUA';
  if (!base || !process.env.OVG_USERNAME || !process.env.OVG_PASSWORD) {
    throw new Error('OVG_API_URL/OVG_USERNAME/OVG_PASSWORD em falta no .env');
  }
  const dburl = (process.env.CRM_DATABASE_URL || process.env.DATABASE_URL || '')
    .replace(/["']/g, '')
    .replace('&channel_binding=require', '')
    .replace('channel_binding=require&', '');
  if (!dburl) throw new Error('CRM_DATABASE_URL em falta no .env');

  const UA = { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' };
  const lr = await fetch(base + '/APIControlAccess', {
    method: 'POST', headers: UA,
    body: JSON.stringify({ username: process.env.OVG_USERNAME, password: process.env.OVG_PASSWORD }),
  });
  const lb = await lr.json();
  const token = lb.token || lb.Token || lb.access_token;
  if (!token) throw new Error('Login OVG falhou: ' + JSON.stringify(lb).slice(0, 200));

  const mr = await fetch(`${base}/ListOfCustomersDataDetailed/${club}`, {
    headers: { ...UA, Authorization: 'Bearer ' + token },
  });
  const mb = await mr.json();
  const members = mb.clients_data || (mb.data && mb.data.clients_data) || [];
  log(`OVG: ${members.length} membros recebidos`);

  const c = new pg.Client({ connectionString: dburl, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query(`CREATE TABLE IF NOT EXISTS ovg_members (
    customer_number TEXT PRIMARY KEY, name TEXT, sex TEXT, nif TEXT, mobile_number TEXT,
    email TEXT, status TEXT, club TEXT, last_entry TEXT, entry_date TEXT, synced_at TIMESTAMPTZ DEFAULT NOW())`);
  await c.query(`CREATE TABLE IF NOT EXISTS sync_log (id SERIAL PRIMARY KEY, synced_at TIMESTAMPTZ DEFAULT NOW(), records_synced INT DEFAULT 0, source TEXT DEFAULT 'sync_crm')`);

  let upserted = 0;
  for (const m of members) {
    try {
      await c.query(
        `INSERT INTO ovg_members (customer_number, name, sex, nif, mobile_number, email, status, club, last_entry, entry_date, synced_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
         ON CONFLICT (customer_number) DO UPDATE SET name=EXCLUDED.name, sex=EXCLUDED.sex, nif=EXCLUDED.nif,
           mobile_number=EXCLUDED.mobile_number, email=EXCLUDED.email, status=EXCLUDED.status, club=EXCLUDED.club,
           last_entry=EXCLUDED.last_entry, entry_date=EXCLUDED.entry_date, synced_at=NOW()`,
        [String(m.customer_number), m.name || null, m.sex || null, m.nif || null, m.mobile_number || null,
         m.email || null, m.status || null, m.club_cod || m.club || null, m.last_entry || null, m.entry_date || null]);
      upserted++;
    } catch (e) { log('upsert erro: ' + e.message); }
  }
  await c.query("INSERT INTO sync_log (synced_at, records_synced, source) VALUES (NOW(), $1, 'ovg-reseed-auto')", [upserted]);
  const st = await c.query('SELECT COUNT(*) AS total FROM ovg_members');
  log(`OK upserted=${upserted} total=${st.rows[0].total}`);
  await c.end();
}

run().then(() => process.exit(0)).catch((e) => { log('FATAL: ' + e.message); process.exit(1); });

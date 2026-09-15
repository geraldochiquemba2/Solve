// Índices anti-cota Neon — aplicados UMA vez na BD nova (fase Cademi-CRM).
// Sem índices, cada polling (EXPIRY/AUTO-SYNC/sync Cademi) faz full-scan = queima transferência.
// Uso:  DATABASE_URL="<nova-url>" node packages/db/add-indexes.cjs
const { Client } = require('pg');

const statements = [
  // EXPIRY + AUTO-SYNC É-kwanza (WHERE status='pendente' ...)
  `CREATE INDEX IF NOT EXISTS idx_payments_status_expires ON payments(status, expires_at)`,
  `CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id)`,
  `CREATE INDEX IF NOT EXISTS idx_payments_code ON payments(code)`,
  // Sync Cademi -> CRM (lookup por email + cademi_id)
  `CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email)`,
  `CREATE INDEX IF NOT EXISTS idx_customers_cademi ON customers(cademi_id)`,
  // Listagens admin (ORDER BY created_at DESC)
  `CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_portal_otps_phone ON portal_otps(phone)`,
];

async function run() {
  // Fase 2 BDs: opera sobre a BD do CRM (CRM_DATABASE_URL, nova).
  process.env.DATABASE_URL = process.env.CRM_DATABASE_URL || process.env.DATABASE_URL;
  if (!process.env.DATABASE_URL) {
    console.error('FATAL: define CRM_DATABASE_URL no ambiente. Ex: CRM_DATABASE_URL="..." node packages/db/add-indexes.cjs');
    process.exit(1);
  }
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  for (const s of statements) {
    try { await client.query(s); console.log('OK:', s.slice(0, 70)); }
    catch (e) { console.error('FALHOU:', s.slice(0, 70), '-', e.message); }
  }
  await client.end();
  console.log('Índices aplicados.');
}
run();

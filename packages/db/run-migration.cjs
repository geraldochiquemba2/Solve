const { Client } = require('./node_modules/pg');
const fs = require('fs');
const path = require('path');

const sql = fs.readFileSync(path.join(__dirname, 'drizzle', '0000_empty_hydra.sql'), 'utf8')
  .replace(/--> statement-breakpoint/g, '');

// SEGURANÇA Set/2026: segredo via env, nunca hardcoded.
const DB_URL = (process.env.CRM_DATABASE_URL || process.env.DATABASE_URL || "");
if (!DB_URL) { console.error('FATAL: define CRM_DATABASE_URL ou DATABASE_URL no ambiente.'); process.exit(1); }

const client = new Client({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to Neon DB');
    const statements = sql.split(';').filter(s => s.trim().length > 0);
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i].trim();
      if (!stmt) continue;
      try {
        await client.query(stmt);
        console.log(`Statement ${i + 1}/${statements.length} OK`);
      } catch (e) {
        if (e.message.includes('already exists')) {
          console.log(`Statement ${i + 1}/${statements.length} SKIP (already exists)`);
        } else {
          console.log(`Statement ${i + 1}/${statements.length} ERROR: ${e.message}`);
          console.log('SQL:', stmt.substring(0, 120));
        }
      }
    }
    console.log('Migration complete!');
    await client.end();
  } catch (e) {
    console.error('FATAL:', e.message);
    await client.end();
  }
}

run();

const { Client } = require('./node_modules/pg');
const fs = require('fs');
const path = require('path');

const sql = fs.readFileSync(path.join(__dirname, 'drizzle', '0000_empty_hydra.sql'), 'utf8')
  .replace(/--> statement-breakpoint/g, '');

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_bXxHCos9Z3Nl@ep-rapid-heart-a5mtx2z6-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
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

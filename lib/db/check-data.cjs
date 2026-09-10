const { Client } = require('./node_modules/pg');

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_bXxHCos9Z3Nl@ep-rapid-heart-a5mtx2z6-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  const tables = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
  for (const t of tables.rows) {
    const count = await client.query(`SELECT count(*) FROM "${t.tablename}"`);
    console.log(`${t.tablename}: ${count.rows[0].count} rows`);
  }
  await client.end();
}

run().catch(e => { console.error(e.message); process.exit(1); });

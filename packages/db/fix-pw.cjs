const { Client } = require('./node_modules/pg');
const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_bXxHCos9Z3Nl@ep-rapid-heart-a5mtx2z6-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});
async function run() {
  await client.connect();
  await client.query("UPDATE users SET password_hash = '1234567890' WHERE email = 'admin@solvecorporate.ao'");
  console.log('Password updated');
  const r = await client.query("SELECT email, password_hash FROM users");
  console.log(r.rows);
  await client.end();
}
run().catch(e => { console.error(e.message); process.exit(1); });

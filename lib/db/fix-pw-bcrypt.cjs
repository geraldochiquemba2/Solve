const { Client } = require('C:/Users/Geraldo/Downloads/Solve-Corporate-CRM/Solve-Corporate-CRM/lib/db/node_modules/pg');
const bcrypt = require('C:/Users/Geraldo/Downloads/Solve-Corporate-CRM/Solve-Corporate-CRM/artifacts/api-server/node_modules/bcryptjs');

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_bXxHCos9Z3Nl@ep-rapid-heart-a5mtx2z6-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  const hash = await bcrypt.hash('1234567890', 10);
  await client.query("UPDATE users SET password_hash = $1 WHERE email = 'admin@solvecorporate.ao'", [hash]);
  console.log('Password updated with bcrypt hash');
  const r = await client.query("SELECT email, left(password_hash, 20) as pw_prefix FROM users");
  console.log(r.rows);
  await client.end();
}

run().catch(e => { console.error(e.message); process.exit(1); });

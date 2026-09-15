const { Client } = require('pg');
const crypto = require('crypto');
const bcrypt = require('./node_modules/bcryptjs');

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_bXxHCos9Z3Nl@ep-rapid-heart-a5mtx2z6-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  console.log('A actualizar admin...');

  const password = '1234567890';
  const passwordHash = await bcrypt.hash(password, 10);

  await client.query(
    `UPDATE users SET phone = '999999999', password_hash = $1 WHERE email = 'admin@solvecorporate.ao'`,
    [passwordHash]
  );

  console.log('✓ Admin actualizado');
  console.log('\nCredenciais:');
  console.log('  Telefone: 999999999');
  console.log('  Password: 1234567890');

  await client.end();
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });

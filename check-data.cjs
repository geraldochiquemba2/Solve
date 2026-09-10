const { Pool } = require('pg');
const c = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_bXxHCos9Z3Nl@ep-rapid-heart-a5mtx2z6-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require'
});
c.query('SELECT remote_id,customer_name,access_date,access_time,access_type,result FROM solve_access_logs ORDER BY remote_id DESC LIMIT 10')
  .then(r => { console.table(r.rows); c.end(); })
  .catch(e => { console.error(e.message); c.end(); });

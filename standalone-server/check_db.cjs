const { Client } = require('./node_modules/pg');
const c = new Client({ connectionString: 'postgresql://neondb_owner:npg_K1xRfZW0hcdT@ep-wispy-rain-ad0exw5p.us-east-2.aws.neon.tech/neondb?sslmode=require' });
c.connect().then(async () => {
    const r = await c.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
    console.log('TABLES:', r.rows.map(x=>x.table_name).join(', '));
    try { const n = await c.query('SELECT count(*) FROM customers'); console.log('customers:', n.rows[0].count); } catch(e) { console.log('no customers table:', e.message); }
    try { const n = await c.query('SELECT count(*) FROM ovg_members'); console.log('ovg_members:', n.rows[0].count); } catch(e) { console.log('no ovg_members:', e.message); }
    try { const n = await c.query('SELECT count(*) FROM solve_access_logs'); console.log('solve_access_logs:', n.rows[0].count); } catch(e) { console.log('no solve_access_logs:', e.message); }
    await c.end();
}).catch(e => console.error(e.message));

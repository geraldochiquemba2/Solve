const { Client } = require('./node_modules/pg');
const c = new Client({ connectionString: 'postgresql://neondb_owner:npg_K1xRfZW0hcdT@ep-wispy-rain-ad0exw5p.us-east-2.aws.neon.tech/neondb?sslmode=require' });
c.connect().then(async () => {
    const r = await c.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
    for (const row of r.rows) {
        const count = await c.query("SELECT count(*) as c FROM " + row.table_name);
        console.log(row.table_name + ': ' + count.rows[0].c + ' rows');
    }
    await c.end();
}).catch(e => console.error(e.message));

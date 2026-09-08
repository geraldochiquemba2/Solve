import express from "express";
import cors from "cors";
import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const app = express();
app.use(cors());
app.use(express.json());

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post("/api/v1/access/sync", async (req, res) => {
  try {
    const { acessos } = req.body;
    if (!Array.isArray(acessos) || acessos.length === 0) {
      res.status(400).json({ error: "Array 'acessos' vazio" });
      return;
    }

    let inserted = 0;
    for (const a of acessos) {
      try {
        await pool.query(
          `INSERT INTO solve_access_logs (id, remote_id, customer_id, customer_name, access_date, access_time, access_type, result, reason)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (remote_id) DO NOTHING`,
          [a.id_acesso, a.cliente_id, a.cliente_nome || null, a.data_acesso, a.hora_acesso, a.tipo_acesso, a.resultado, a.motivo || null]
        );
        inserted++;
      } catch (e) { console.error("insert error:", e.message); }
    }

    res.json({ ok: true, inserted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const sseClients = new Set();
let lastSyncedId = 0;

app.get("/api/v1/access/stream", async (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  try {
    const result = await pool.query(
      `SELECT id, remote_id, customer_id, customer_name, access_date, access_time, access_type, result, reason
       FROM solve_access_logs ORDER BY remote_id DESC LIMIT 20`
    );
    res.write(`data: ${JSON.stringify({ type: "connected", history: result.rows })}\n\n`);
  } catch {}

  sseClients.add(res);
  req.on("close", () => sseClients.delete(res));
});

setInterval(async () => {
  try {
    const result = await pool.query(
      `SELECT id, remote_id, customer_id, customer_name, access_date, access_time, access_type, result, reason
       FROM solve_access_logs WHERE remote_id > $1 ORDER BY remote_id DESC`,
      [lastSyncedId]
    );
    if (result.rows.length > 0) {
      lastSyncedId = result.rows[0].remote_id;
      for (const client of sseClients) {
        try { client.write(`data: ${JSON.stringify({ type: "access", data: result.rows })}\n\n`); }
        catch { sseClients.delete(client); }
      }
    }
  } catch {}
}, 3000);

app.get("/api/v1/access/stats", async (req, res) => {
  try {
    const total = await pool.query("SELECT COUNT(*) as cnt FROM solve_access_logs");
    const today = await pool.query("SELECT COUNT(*) as cnt FROM solve_access_logs WHERE access_date = to_char(CURRENT_DATE, 'YYYY-MM-DD')");
    res.json({ total: total.rows[0].cnt, today: today.rows[0].cnt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`Server listening on port ${port}`));

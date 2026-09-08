import "dotenv/config";
import express from "express";
import cors from "cors";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Sync: PC da catraca envia acessos ──────────────────────────────────────

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
        await db.execute(sql`
          INSERT INTO solve_access_logs (id, remote_id, customer_id, customer_name, access_date, access_time, access_type, result, reason)
          VALUES (gen_random_uuid(), ${a.id_acesso}, ${a.cliente_id}, ${a.cliente_nome || null}, ${a.data_acesso}, ${a.hora_acesso}, ${a.tipo_acesso}, ${a.resultado}, ${a.motivo || null})
          ON CONFLICT (remote_id) DO NOTHING
        `);
        inserted++;
      } catch (e) { console.error("insert error:", e); }
    }

    res.json({ ok: true, inserted });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SSE: Streaming de acessos ──────────────────────────────────────────────

const sseClients: Set<any> = new Set();
let lastSyncedId = 0;

app.get("/api/v1/access/stream", async (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  try {
    const result = await db.execute(sql`
      SELECT id, remote_id, customer_id, customer_name, access_date, access_time, access_type, result, reason
      FROM solve_access_logs
      ORDER BY remote_id DESC LIMIT 20
    `);
    res.write(`data: ${JSON.stringify({ type: "connected", history: result.rows })}\n\n`);
  } catch {}

  sseClients.add(res);
  req.on("close", () => sseClients.delete(res));
});

setInterval(async () => {
  try {
    const result = await db.execute(sql`
      SELECT id, remote_id, customer_id, customer_name, access_date, access_time, access_type, result, reason
      FROM solve_access_logs
      WHERE remote_id > ${lastSyncedId}
      ORDER BY remote_id DESC
    `);
    const rows = result.rows as any[];
    if (rows.length > 0) {
      lastSyncedId = rows[0].remote_id;
      for (const client of sseClients) {
        try { client.write(`data: ${JSON.stringify({ type: "access", data: rows })}\n\n`); } catch { sseClients.delete(client); }
      }
    }
  } catch {}
}, 3000);

// ─── Stats ──────────────────────────────────────────────────────────────────

app.get("/api/v1/access/stats", async (req, res) => {
  try {
    const total = await db.execute(sql`SELECT COUNT(*) as cnt FROM solve_access_logs`);
    const today = await db.execute(sql`SELECT COUNT(*) as cnt FROM solve_access_logs WHERE access_date = to_char(CURRENT_DATE, 'YYYY-MM-DD')`);
    res.json({ total: (total.rows[0] as any).cnt, today: (today.rows[0] as any).cnt });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`Server listening on port ${port}`));

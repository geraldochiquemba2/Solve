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

// ─── Stats ──────────────────────────────────────────────────────────────────

app.get("/api/v1/access/stats", async (req, res) => {
  try {
    const totalResult = await pool.query("SELECT COUNT(*) as cnt FROM solve_access_logs");
    const todayResult = await pool.query("SELECT COUNT(*) as cnt FROM solve_access_logs WHERE access_date = to_char(CURRENT_DATE, 'YYYY-MM-DD')");
    const authorizedToday = await pool.query("SELECT COUNT(*) as cnt FROM solve_access_logs WHERE access_date = to_char(CURRENT_DATE, 'YYYY-MM-DD') AND LOWER(result) = 'autorizado'");
    const deniedToday = await pool.query("SELECT COUNT(*) as cnt FROM solve_access_logs WHERE access_date = to_char(CURRENT_DATE, 'YYYY-MM-DD') AND LOWER(result) != 'autorizado'");
    const uniqueClients = await pool.query("SELECT COUNT(DISTINCT customer_id) as cnt FROM solve_access_logs");
    const clientsToday = await pool.query("SELECT COUNT(DISTINCT customer_id) as cnt FROM solve_access_logs WHERE access_date = to_char(CURRENT_DATE, 'YYYY-MM-DD')");
    const recentAccesses = await pool.query(
      "SELECT remote_id as id_acesso, customer_id as cliente_id, customer_name as cliente_nome, access_date as data_acesso, access_time as hora_acesso, access_type as tipo_acesso, result as resultado, reason as motivo FROM solve_access_logs ORDER BY remote_id DESC LIMIT 10"
    );

    res.json({
      data: {
        clients: { total: parseInt(uniqueClients.rows[0].cnt), active: parseInt(clientsToday.rows[0].cnt), online: 0, blocked: 0 },
        accesses: {
          today: parseInt(todayResult.rows[0].cnt),
          month: parseInt(totalResult.rows[0].cnt),
          authorizedToday: parseInt(authorizedToday.rows[0].cnt),
          deniedToday: parseInt(deniedToday.rows[0].cnt),
        },
        recentAccesses: recentAccesses.rows,
        accessByDay: [],
        peakHours: [],
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Logs ───────────────────────────────────────────────────────────────────

app.get("/api/v1/access/logs", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(1000, parseInt(req.query.limit) || 200);
    const offset = (page - 1) * limit;

    const where = [];
    const params = [];

    if (req.query.client_id) {
      where.push("customer_id = $" + (params.length + 1));
      params.push(parseInt(req.query.client_id));
    }
    if (req.query.resultado) {
      where.push("result = $" + (params.length + 1));
      params.push(req.query.resultado);
    }
    if (req.query.tipo_acesso) {
      where.push("access_type = $" + (params.length + 1));
      params.push(req.query.tipo_acesso);
    }
    if (req.query.date_from) {
      where.push("access_date >= $" + (params.length + 1));
      params.push(req.query.date_from);
    }
    if (req.query.date_to) {
      where.push("access_date <= $" + (params.length + 1));
      params.push(req.query.date_to);
    }
    if (req.query.search) {
      where.push("(LOWER(customer_name) LIKE $" + (params.length + 1) + " OR customer_id::text LIKE $" + (params.length + 2) + ")");
      params.push("%" + req.query.search.toLowerCase() + "%", req.query.search);
    }

    const whereClause = where.length > 0 ? "WHERE " + where.join(" AND ") : "";

    const totalResult = await pool.query("SELECT COUNT(*) as cnt FROM solve_access_logs " + whereClause, params);
    const logs = await pool.query(
      `SELECT remote_id as id_acesso, customer_id as cliente_id, customer_name as cliente_nome,
              access_date as data_acesso, access_time as hora_acesso,
              access_type as tipo_acesso, result as resultado, reason as motivo
       FROM solve_access_logs ${whereClause}
       ORDER BY remote_id DESC LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    res.json({
      data: logs.rows,
      pagination: { page, limit, total: parseInt(totalResult.rows[0].cnt), totalPages: Math.ceil(parseInt(totalResult.rows[0].cnt) / limit) },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Terminal Status ──────────────────────────────────────────────────────────

app.get("/api/v1/terminal/status", async (req, res) => {
  try {
    const recentResult = await pool.query(
      "SELECT MAX(synced_at) as last_sync FROM solve_access_logs"
    );
    const lastSync = recentResult.rows[0]?.last_sync;
    const isOnline = lastSync && (Date.now() - new Date(lastSync).getTime()) < 30 * 60 * 1000;

    res.json({
      data: {
        nome_terminal: "Solve Access",
        online: isOnline,
        ip: "192.168.1.182",
        porta: 8080,
        modelo: "ZKTeco",
        tipo: "Entrada",
        lastSync: lastSync,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Clients ────────────────────────────────────────────────────────────────

app.get("/api/v1/access/clients", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT DISTINCT customer_id as id_cliente, customer_name as nome FROM solve_access_logs ORDER BY customer_name ASC"
    );
    res.json({ data: result.rows, total: result.rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SSE: Streaming de acessos em tempo real ─────────────────────────────────

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
      `SELECT remote_id as id_acesso, customer_id as cliente_id, customer_name as cliente_nome,
              access_date as data_acesso, access_time as hora_acesso,
              access_type as tipo_acesso, result as resultado, reason as motivo
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
      `SELECT remote_id as id_acesso, customer_id as cliente_id, customer_name as cliente_nome,
              access_date as data_acesso, access_time as hora_acesso,
              access_type as tipo_acesso, result as resultado, reason as motivo
       FROM solve_access_logs WHERE remote_id > $1 ORDER BY remote_id DESC`,
      [lastSyncedId]
    );
    if (result.rows.length > 0) {
      lastSyncedId = result.rows[0].id_acesso;
      for (const client of sseClients) {
        try { client.write(`data: ${JSON.stringify({ type: "access", data: result.rows })}\n\n`); }
        catch { sseClients.delete(client); }
      }
    }
  } catch {}
}, 3000);

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`Server listening on port ${port}`));

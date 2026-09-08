import { Router } from "express";
import { authenticate } from "../middlewares/auth";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

// ─── Stats (lê da Neon PostgreSQL) ──────────────────────────────────────────

router.get("/access/stats", authenticate, async (req, res, next) => {
  try {
    const totalResult = await db.execute(sql`SELECT COUNT(*) as cnt FROM solve_access_logs`);
    const total = (totalResult.rows as any[])[0]?.cnt ?? 0;

    const todayResult = await db.execute(sql`
      SELECT COUNT(*) as cnt FROM solve_access_logs 
      WHERE access_date = to_char(CURRENT_DATE, 'YYYY-MM-DD')
    `);
    const today = (todayResult.rows as any[])[0]?.cnt ?? 0;

    const authorizedResult = await db.execute(sql`
      SELECT COUNT(*) as cnt FROM solve_access_logs 
      WHERE access_date = to_char(CURRENT_DATE, 'YYYY-MM-DD') AND result = 'Autorizado'
    `);
    const authorizedToday = (authorizedResult.rows as any[])[0]?.cnt ?? 0;

    const deniedResult = await db.execute(sql`
      SELECT COUNT(*) as cnt FROM solve_access_logs 
      WHERE access_date = to_char(CURRENT_DATE, 'YYYY-MM-DD') AND result != 'Autorizado'
    `);
    const deniedToday = (deniedResult.rows as any[])[0]?.cnt ?? 0;

    const recentResult = await db.execute(sql`
      SELECT id, remote_id, customer_id, customer_name, access_date, access_time, access_type, result, reason
      FROM solve_access_logs
      ORDER BY remote_id DESC LIMIT 10
    `);

    res.json({
      data: {
        clients: { total: 0, active: 0, online: 0, blocked: 0 },
        accesses: { today, month: total, authorizedToday, deniedToday },
        recentAccesses: recentResult.rows,
        accessByDay: [],
        peakHours: [],
      },
    });
  } catch (err: any) {
    next(err);
  }
});

// ─── Logs (lê da Neon PostgreSQL) ───────────────────────────────────────────

router.get("/access/logs", authenticate, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
    const offset = (page - 1) * limit;

    const result = await db.execute(sql`
      SELECT id, remote_id, customer_id, customer_name, access_date, access_time, access_type, result, reason, synced_at
      FROM solve_access_logs
      ORDER BY remote_id DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const countResult = await db.execute(sql`SELECT COUNT(*) as cnt FROM solve_access_logs`);
    const total = (countResult.rows as any[])[0]?.cnt ?? 0;

    res.json({
      data: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err: any) {
    next(err);
  }
});

// ─── Clients (lê da Neon PostgreSQL) ────────────────────────────────────────

router.get("/access/clients", authenticate, async (req, res, next) => {
  try {
    const result = await db.execute(sql`
      SELECT DISTINCT customer_id as id_cliente, customer_name as nome
      FROM solve_access_logs
      ORDER BY customer_name ASC
    `);
    res.json({ data: result.rows, total: result.rows.length });
  } catch (err: any) {
    next(err);
  }
});

// ─── Sync: PC da catraca envia acessos novos para o CRM ──────────────────────

router.post("/access/sync", async (req, res) => {
  try {
    const { acessos } = req.body;
    if (!Array.isArray(acessos) || acessos.length === 0) {
      res.status(400).json({ error: "Array 'acessos' vazio ou inválido" });
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
      } catch {}
    }

    for (const client of accessSSEClients) {
      try {
        client.write(`data: ${JSON.stringify({ type: "sync", inserted })}\n\n`);
      } catch {
        accessSSEClients.delete(client);
      }
    }

    res.json({ ok: true, inserted });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SSE: Streaming de acessos em tempo real ─────────────────────────────────

const accessSSEClients: Set<any> = new Set();
let lastSyncedId = 0;
let pollTimer: NodeJS.Timeout | null = null;

async function pollAccessDB() {
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
      for (const client of accessSSEClients) {
        try {
          client.write(`data: ${JSON.stringify({ type: "access", data: rows })}\n\n`);
        } catch {
          accessSSEClients.delete(client);
        }
      }
    }
  } catch {}
}

function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(pollAccessDB, 3000);
}

function stopPolling() {
  if (accessSSEClients.size === 0 && pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

router.get("/access/stream", async (req, res) => {
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

  accessSSEClients.add(res);
  startPolling();

  req.on("close", () => {
    accessSSEClients.delete(res);
    stopPolling();
  });
});

export default router;

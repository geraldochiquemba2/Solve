import { Router } from "express";
import { DatabaseSync } from "node:sqlite";
import path from "path";
import { fileURLToPath } from "url";
import { authenticate } from "../middlewares/auth";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

const ACCESS_DB_PATH = process.env.ACCESS_DB_PATH || "E:\\solve acces arq\\solve-access.db";

function getAccessDb() {
  const db = new DatabaseSync(ACCESS_DB_PATH, { open: true, readOnly: true } as any);
  return db;
}

// Helper to query and return rows
function queryAll(db: DatabaseSync, sql: string, params: any[] = []): any[] {
  const stmt = db.prepare(sql);
  return stmt.all(...params) as any[];
}

function queryOne(db: DatabaseSync, sql: string, params: any[] = []): any {
  const stmt = db.prepare(sql);
  return stmt.get(...params) as any;
}

// Solve Access stats for dashboard
router.get("/access/stats", authenticate, async (req, res, next) => {
  let db;
  try {
    db = getAccessDb();

    const totalClients = queryOne(db, "SELECT COUNT(*) as cnt FROM Clientes");
    const activeClients = queryOne(db, "SELECT COUNT(*) as cnt FROM Clientes WHERE status = 'ativo'");
    const onlineClients = queryOne(db, "SELECT COUNT(*) as cnt FROM Clientes WHERE online = 1");
    const blockedClients = queryOne(db, "SELECT COUNT(*) as cnt FROM Clientes WHERE bloqueado = 1");
    const todayAccesses = queryOne(db, "SELECT COUNT(*) as cnt FROM Acessos WHERE data_acesso = date('now')");
    const monthAccesses = queryOne(db, "SELECT COUNT(*) as cnt FROM Acessos WHERE data_acesso >= date('now', 'start of month')");
    const authorizedToday = queryOne(db, "SELECT COUNT(*) as cnt FROM Acessos WHERE data_acesso = date('now') AND resultado = 'autorizado'");
    const deniedToday = queryOne(db, "SELECT COUNT(*) as cnt FROM Acessos WHERE data_acesso = date('now') AND resultado = 'negado'");

    const recentAccesses = queryAll(db, `
      SELECT a.id_acesso, a.cliente_id, c.nome as cliente_nome, a.data_acesso, a.hora_acesso, 
             a.tipo_acesso, a.resultado, a.motivo
      FROM Acessos a
      LEFT JOIN Clientes c ON a.cliente_id = c.id_cliente
      ORDER BY a.data_acesso DESC, a.hora_acesso DESC
      LIMIT 10
    `);

    const accessByDay = queryAll(db, `
      SELECT data_acesso as date, COUNT(*) as count, 
             SUM(CASE WHEN resultado = 'autorizado' THEN 1 ELSE 0 END) as authorized,
             SUM(CASE WHEN resultado = 'negado' THEN 1 ELSE 0 END) as denied
      FROM Acessos
      WHERE data_acesso >= date('now', '-7 days')
      GROUP BY data_acesso
      ORDER BY data_acesso ASC
    `);

    const peakHours = queryAll(db, `
      SELECT CAST(substr(hora_acesso, 1, 2) AS INTEGER) as hour, COUNT(*) as count
      FROM Acessos
      WHERE data_acesso >= date('now', '-7 days')
      GROUP BY hour
      ORDER BY count DESC
      LIMIT 5
    `);

    res.json({
      data: {
        clients: {
          total: totalClients?.cnt ?? 0,
          active: activeClients?.cnt ?? 0,
          online: onlineClients?.cnt ?? 0,
          blocked: blockedClients?.cnt ?? 0,
        },
        accesses: {
          today: todayAccesses?.cnt ?? 0,
          month: monthAccesses?.cnt ?? 0,
          authorizedToday: authorizedToday?.cnt ?? 0,
          deniedToday: deniedToday?.cnt ?? 0,
        },
        recentAccesses,
        accessByDay,
        peakHours,
      },
    });
  } catch (err: any) {
    if (err?.code === "SQLITE_CANTOPEN" || err?.message?.includes("unable to open")) {
      res.status(503).json({ error: "Solve Access database not available", code: "ACCESS_DB_UNAVAILABLE" });
      return;
    }
    next(err);
  } finally {
    db?.close();
  }
});

// List access logs with pagination
router.get("/access/logs", authenticate, async (req, res, next) => {
  let db;
  try {
    db = getAccessDb();
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
    const offset = (page - 1) * limit;

    const where = [];
    const params: any[] = [];

    if (req.query.client_id) {
      where.push("a.cliente_id = ?");
      params.push(parseInt(req.query.client_id as string));
    }
    if (req.query.resultado) {
      where.push("a.resultado = ?");
      params.push(req.query.resultado);
    }
    if (req.query.tipo_acesso) {
      where.push("a.tipo_acesso = ?");
      params.push(req.query.tipo_acesso);
    }
    if (req.query.date_from) {
      where.push("a.data_acesso >= ?");
      params.push(req.query.date_from);
    }
    if (req.query.date_to) {
      where.push("a.data_acesso <= ?");
      params.push(req.query.date_to);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

    const total = queryOne(db, `SELECT COUNT(*) as cnt FROM Acessos a ${whereClause}`, params);

    const logs = queryAll(db, `
      SELECT a.id_acesso, a.cliente_id, c.nome as cliente_nome, c.numero_cartao,
             a.terminal_id, t.nome_terminal, a.data_acesso, a.hora_acesso,
             a.tipo_acesso, a.resultado, a.motivo
      FROM Acessos a
      LEFT JOIN Clientes c ON a.cliente_id = c.id_cliente
      LEFT JOIN Terminais t ON a.terminal_id = t.id_terminal
      ${whereClause}
      ORDER BY a.data_acesso DESC, a.hora_acesso DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    res.json({
      data: logs,
      pagination: { page, limit, total: total?.cnt ?? 0, totalPages: Math.ceil((total?.cnt ?? 0) / limit) },
    });
  } catch (err: any) {
    if (err?.code === "SQLITE_CANTOPEN" || err?.message?.includes("unable to open")) {
      res.status(503).json({ error: "Solve Access database not available", code: "ACCESS_DB_UNAVAILABLE" });
      return;
    }
    next(err);
  } finally {
    db?.close();
  }
});

// List clients from Solve Access
router.get("/access/clients", authenticate, async (req, res, next) => {
  let db;
  try {
    db = getAccessDb();

    const where = [];
    const params: any[] = [];

    if (req.query.status) {
      where.push("status = ?");
      params.push(req.query.status);
    }
    if (req.query.online !== undefined) {
      where.push("online = ?");
      params.push(req.query.online === "1" ? 1 : 0);
    }
    if (req.query.search) {
      where.push("(nome LIKE ? OR telefone LIKE ? OR email LIKE ? OR nif LIKE ?)");
      const s = `%${req.query.search}%`;
      params.push(s, s, s, s);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

    const clients = queryAll(db, `
      SELECT id_cliente, nome, telefone, email, nif, numero_cartao, 
             status, online, bloqueado, limite_entradas, numero_entradas,
             ciclo_inicio, data_cadastro
      FROM Clientes
      ${whereClause}
      ORDER BY nome ASC
    `, params);

    res.json({ data: clients, total: clients.length });
  } catch (err: any) {
    if (err?.code === "SQLITE_CANTOPEN" || err?.message?.includes("unable to open")) {
      res.status(503).json({ error: "Solve Access database not available", code: "ACCESS_DB_UNAVAILABLE" });
      return;
    }
    next(err);
  } finally {
    db?.close();
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

    // Notifica SSE clients
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

// ─── SSE: Streaming de acessos em tempo real (lê da Neon PostgreSQL) ──────────

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

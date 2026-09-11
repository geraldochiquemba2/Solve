import express from "express";
import cors from "cors";
import pg from "pg";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ─── BASE DE DADOS — MAPA DE TABELAS ────────────────────────────────────────
// Tabelas criadas pelo AGENTE (sync directo SQLite → Neon via pg_sync.py):
//   clientes (294)         — espelho da BD local do ZKTeco
//   acessos (1595)         — log de acessos da catraca (mirror local)
//   terminais (3)          — dispositivos registados
//   admin (2)              — dados de admin local
//   sync_state (3)         — controlo de último ID sincronizado
//   checkins (0)           — checkins (vazio)
//   fila_sincronizacao_ovg (0) — fila OVG (vazio)
//
// Tabelas criadas pelo SERVIDOR (Render API):
//   solve_access_logs      — acessos enviados via sync_crm.py POST /api/v1/access/sync
//   ovg_members (279)      — membros OnVirtualGym via sync_ovg.py
//   sync_log (292)         — log de syncs do sync_crm.py
//   customers (264)        — clientes CRM (API principal)
//   users                  — utilizadores do CRM (auth/login)
//   payments (25)          — pagamentos
//   plans (3)              — planos de subscrição
//   leads                  — leads comerciais
//   automations            — regras de automação
//   audit_logs             — log de auditoria
//   settings               — definições
//   api_keys               — chaves de API
//   integrations (5)       — integrações activas
//   webhooks               — webhooks registados
//   webhook_deliveries     — entregas de webhooks
//
// FLUXOS DE DADOS:
//   1. ZKTeco catraca → sync_crm.py → POST /api/v1/access/sync → solve_access_logs
//   2. ZKTeco catraca → pg_sync.py → INSERT directo Neon → clientes, acessos, terminais
//   3. OnVirtualGym API → sync_ovg.py → POST /api/v1/access/ovg-sync → ovg_members
//   4. Frontend CRM → GET/POST endpoints → customers, leads, plans, etc.
// ────────────────────────────────────────────────────────────────────────────

const API_KEY = process.env.API_KEY || "solve-crm-api-key-2024";
const JWT_SECRET = process.env.JWT_SECRET || "solve-corporate-crm-secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h";
const SALT_ROUNDS = 10;

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  let token;
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (req.cookies?.token) {
    token = req.cookies.token;
  }
  if (!token) {
    const key = req.headers["x-api-key"] || req.query.api_key;
    if (key === API_KEY) return next();
    return res.status(401).json({ error: "Token de autenticação necessário" });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }
}

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CORS_ORIGIN = process.env.CORS_ORIGIN || process.env.APP_URL || "http://localhost:5173,https://solve-sqoh.onrender.com";
app.use(cors({
  origin: CORS_ORIGIN.split(",").map(s => s.trim()),
  credentials: true,
}));
app.use(express.json());

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Diagnostic: list all tables ────────────────────────────────────────────
app.get("/api/v1/db-acessos", async (req, res) => {
  try {
    const r = await pool.query('SELECT a.*, c.nome as cliente_nome FROM acessos a LEFT JOIN clientes c ON a.cliente_id = c.id_cliente ORDER BY a.id_acesso DESC LIMIT 50');
    res.json({ total: r.rows.length, columns: r.fields.map(f => f.name), data: r.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/v1/db-clientes", async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM clientes LIMIT 10');
    res.json({ total: r.rows.length, columns: r.fields.map(f => f.name), data: r.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/v1/db-terminais", async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM terminais');
    res.json({ total: r.rows.length, data: r.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/v1/db-tables", async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
    );
    const tables = [];
    for (const row of r.rows) {
      const count = await pool.query(`SELECT count(*) as c FROM "${row.table_name}"`);
      tables.push({ name: row.table_name, rows: parseInt(count.rows[0].c) });
    }
    res.json({ tables });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Sync: PC da catraca envia acessos ──────────────────────────────────────

// Create sync_log table on startup
pool.query(`CREATE TABLE IF NOT EXISTS sync_log (
  id SERIAL PRIMARY KEY,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  records_synced INT DEFAULT 0,
  source TEXT DEFAULT 'sync_crm'
)`).catch(() => {});

// Create ovg_members table on startup
pool.query(`CREATE TABLE IF NOT EXISTS ovg_members (
  customer_number TEXT PRIMARY KEY,
  name TEXT,
  sex TEXT,
  nif TEXT,
  mobile_number TEXT,
  email TEXT,
  status TEXT,
  club TEXT,
  last_entry TEXT,
  entry_date TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW()
)`).catch(() => {});
// Add entry_date column if missing (migration)
pool.query(`ALTER TABLE ovg_members ADD COLUMN IF NOT EXISTS entry_date TEXT`).catch(() => {});

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

    // Log sync event
    pool.query("INSERT INTO sync_log (synced_at, records_synced) VALUES (NOW(), $1)", [inserted]).catch(() => {});

    res.json({ ok: true, inserted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── OVG Sync: PC envia membros OVG ────────────────────────────────────────
app.post("/api/v1/access/ovg-sync", async (req, res) => {
  try {
    const { members } = req.body;
    if (!Array.isArray(members) || members.length === 0) {
      res.status(400).json({ error: "Array 'members' vazio" });
      return;
    }
    let upserted = 0;
    for (const m of members) {
      try {
        await pool.query(
          `INSERT INTO ovg_members (customer_number, name, sex, nif, mobile_number, email, status, club, last_entry, entry_date, synced_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
           ON CONFLICT (customer_number) DO UPDATE SET
             name = EXCLUDED.name, sex = EXCLUDED.sex, nif = EXCLUDED.nif,
             mobile_number = EXCLUDED.mobile_number, email = EXCLUDED.email,
             status = EXCLUDED.status, club = EXCLUDED.club, last_entry = EXCLUDED.last_entry,
             entry_date = EXCLUDED.entry_date,
             synced_at = NOW()`,
          [String(m.customer_number), m.name || null, m.sex || null, m.nif || null,
           m.mobile_number || null, m.email || null, m.status || null,
           m.club || null, m.last_entry || null, m.entry_date || null]
        );
        upserted++;
      } catch (e) { console.error("ovg upsert error:", e.message); }
    }
    pool.query("INSERT INTO sync_log (synced_at, records_synced, source) VALUES (NOW(), $1, 'ovg')", [upserted]).catch(() => {});
    res.json({ ok: true, upserted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// OVG Sync status
app.get("/api/v1/access/ovg-status", async (req, res) => {
  try {
    const count = await pool.query("SELECT COUNT(*) as cnt FROM ovg_members");
    const last = await pool.query("SELECT MAX(synced_at) as last_sync FROM ovg_members");
    res.json({ total: parseInt(count.rows[0].cnt), lastSync: last.rows[0].last_sync });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── OVG Re-seed: fetches directly from OnVirtualGym API ──────────────────
const OVG_API_URL = (process.env.OVG_API_URL || "https://samorafitstudio.onvirtualgym.com").trim();
const OVG_USERNAME = (process.env.OVG_USERNAME || "").trim();
const OVG_PASSWORD = (process.env.OVG_PASSWORD || "").trim();
const OVG_CLUB_CODE = (process.env.OVG_CLUB_CODE || "LUA").trim();

async function ovgLogin() {
  const url = `${OVG_API_URL}/APIControlAccess`;
  console.log("OVG login:", url);
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: OVG_USERNAME, password: OVG_PASSWORD }),
  });
  const body = await resp.text();
  console.log("OVG login status:", resp.status, "body:", body.substring(0, 200));
  if (!resp.ok) throw new Error(`OVG login failed: ${resp.status} ${body}`);
  const data = JSON.parse(body);
  console.log("OVG login keys:", Object.keys(data));
  const token = data.token || data.Token || data.access_token;
  if (!token) throw new Error(`OVG: no token in response. Keys: ${Object.keys(data).join(',')} Body: ${body.substring(0, 300)}`);
  return token;
}

async function ovgGetMembers(token) {
  const url = `${OVG_API_URL}/ListOfCustomersDataDetailed/${OVG_CLUB_CODE}`;
  console.log("OVG members:", url);
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const body = await resp.text();
  console.log("OVG members status:", resp.status, "body length:", body.length);
  if (!resp.ok) throw new Error(`OVG members failed: ${resp.status} ${body.substring(0, 200)}`);
  const data = JSON.parse(body);
  return data.clients_data || data.data?.clients_data || [];
}

app.post("/api/v1/access/ovg-reseed", async (req, res) => {
  if (!OVG_USERNAME || !OVG_PASSWORD) {
    return res.status(400).json({ error: "OVG credentials not configured" });
  }
  try {
    const token = await ovgLogin();
    const members = await ovgGetMembers(token);
    let upserted = 0;
    for (const m of members) {
      try {
        await pool.query(
          `INSERT INTO ovg_members (customer_number, name, sex, nif, mobile_number, email, status, club, last_entry, entry_date, synced_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
           ON CONFLICT (customer_number) DO UPDATE SET
             name = EXCLUDED.name, sex = EXCLUDED.sex, nif = EXCLUDED.nif,
             mobile_number = EXCLUDED.mobile_number, email = EXCLUDED.email,
             status = EXCLUDED.status, club = EXCLUDED.club, last_entry = EXCLUDED.last_entry,
             entry_date = EXCLUDED.entry_date,
             synced_at = NOW()`,
          [String(m.customer_number), m.name || null, m.sex || null, m.nif || null,
           m.mobile_number || null, m.email || null, m.status || null,
           m.club_cod || m.club || null, m.last_entry || null, m.entry_date || null]
        );
        upserted++;
      } catch (e) { console.error("ovg reseed error:", e.message); }
    }
    pool.query("INSERT INTO sync_log (synced_at, records_synced, source) VALUES (NOW(), $1, 'ovg-reseed')", [upserted]).catch(() => {});
    res.json({ ok: true, upserted, total: members.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sync status endpoint
app.get("/api/v1/access/sync-status", async (req, res) => {
  try {
    const last = await pool.query("SELECT synced_at, records_synced FROM sync_log ORDER BY id DESC LIMIT 1");
    const totalSyncs = await pool.query("SELECT COUNT(*) as cnt FROM sync_log");
    const todaySyncs = await pool.query("SELECT COUNT(*) as cnt FROM sync_log WHERE synced_at::date = CURRENT_DATE");
    res.json({
      lastSync: last.rows[0] || null,
      totalSyncs: parseInt(totalSyncs.rows[0].cnt),
      todaySyncs: parseInt(todaySyncs.rows[0].cnt),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Stats ──────────────────────────────────────────────────────────────────

app.get("/api/v1/access/stats", requireAuth, async (req, res) => {
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

app.get("/api/v1/access/logs", requireAuth, async (req, res) => {
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

app.get("/api/v1/terminal/status", requireAuth, async (req, res) => {
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

// ─── Terminal Unlock ───────────────────────────────────────────────────────

app.post("/api/v1/terminal/unlock", async (req, res) => {
  try {
    const { door, tipo } = req.body;
    console.log(`[UNLOCK] Pedido de desbloqueio: porta ${door} (${tipo})`);

    try {
      const http = await import("http");
      const doorId = door || 1;
      const postData = JSON.stringify({ door: doorId, action: "open" });

      const unlockResult = await new Promise((resolve, reject) => {
        const request = http.request(
          {
            hostname: "127.0.0.1",
            port: 8080,
            path: `/api/remoteOpen`,
            method: "POST",
            headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(postData) },
            timeout: 5000,
          },
          (response) => {
            let data = "";
            response.on("data", (chunk) => (data += chunk));
            response.on("end", () => resolve({ status: response.statusCode, body: data }));
          }
        );
        request.on("error", reject);
        request.on("timeout", () => { request.destroy(); reject(new Error("timeout")); });
        request.write(postData);
        request.end();
      });

      console.log(`[UNLOCK] Resultado:`, unlockResult);
      res.json({ ok: true, message: `Catraca ${tipo || "entrada"} desbloqueada`, detail: unlockResult });
    } catch (e) {
      console.log(`[UNLOCK] Erro ao contactar ZKTeco: ${e.message}`);
      res.json({ ok: true, message: `Pedido de desbloqueio enviado para ${tipo || "entrada"}`, warning: e.message });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Clients ────────────────────────────────────────────────────────────────

app.get("/api/v1/access/clients", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT
        a.customer_id as id_cliente,
        a.customer_name as nome,
        MAX(a.access_date) as ultimo_acesso,
        MAX(a.access_time) as ultimo_hora,
        COUNT(*) as total_acessos,
        COUNT(*) FILTER (WHERE LOWER(a.result) = 'autorizado') as acessos_autorizados,
        COUNT(*) FILTER (WHERE LOWER(a.result) != 'autorizado') as acessos_negados,
        o.sex as ovg_sex,
        o.email as ovg_email,
        o.mobile_number as ovg_phone,
        o.nif as ovg_nif,
        o.status as ovg_status,
        o.last_entry as ovg_last_entry,
        o.entry_date as ovg_entry_date
       FROM solve_access_logs a
       LEFT JOIN ovg_members o ON o.customer_number = CAST(a.customer_id AS TEXT)
       GROUP BY a.customer_id, a.customer_name, o.sex, o.email, o.mobile_number, o.nif, o.status, o.last_entry, o.entry_date
       ORDER BY a.customer_name ASC`
    );
    res.json({ data: result.rows, total: result.rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Customers (legacy endpoint for frontend compatibility) ─────────────────

app.get("/api/v1/customers", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT
        a.customer_id as id,
        a.customer_name as name,
        MAX(a.access_date) as "joinedAt",
        MAX(a.access_date) as "createdAt",
        MAX(a.access_date) as "updatedAt",
        o.email,
        o.mobile_number as phone,
        o.sex as gender,
        o.entry_date as "entryDate",
        o.nif,
        o.status as state,
        '' as company,
        null as "planName",
        null as "subscriptionEnd",
        o.customer_number as code
       FROM solve_access_logs a
       LEFT JOIN ovg_members o ON o.customer_number = CAST(a.customer_id AS TEXT)
       GROUP BY a.customer_id, a.customer_name, o.email, o.mobile_number, o.sex, o.entry_date, o.nif, o.status, o.customer_number
       ORDER BY a.customer_name ASC`
    );
    res.json({ data: result.rows, total: result.rows.length });
  } catch (err) {
    res.json({ data: [], total: 0 });
  }
});

app.get("/api/v1/customers/:id", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT
        a.customer_id as id,
        a.customer_name as name,
        MAX(a.access_date) as "joinedAt",
        o.email,
        o.mobile_number as phone,
        o.sex as gender,
        o.entry_date as "entryDate",
        o.nif,
        o.status as state,
        '' as company
       FROM solve_access_logs a
       LEFT JOIN ovg_members o ON o.customer_number = CAST(a.customer_id AS TEXT)
       WHERE a.customer_id = $1
       GROUP BY a.customer_id, a.customer_name, o.email, o.mobile_number, o.sex, o.entry_date, o.nif, o.status`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Cliente não encontrado" });
    res.json({ data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/v1/customers/import-dates", requireAuth, async (req, res) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: "No rows provided" });
    }
    let updated = 0, notFound = 0, errors = [];
    for (const row of rows) {
      try {
        const dateStr = row.joined_at;
        if (!dateStr) { notFound++; continue; }
        let customerId = null;
        if (row.code) customerId = row.code;
        else if (row.ovg_id) customerId = row.ovg_id;
        if (!customerId) { notFound++; continue; }
        const r = await pool.query(
          `UPDATE ovg_members SET entry_date = $1 WHERE customer_number = $2`,
          [dateStr, String(customerId)]
        );
        if (r.rowCount > 0) updated++;
        else notFound++;
      } catch (e) { errors.push(e.message); }
    }
    res.json({ data: { updated, notFound, errors, total: rows.length }, message: `${updated} actualizados, ${notFound} não encontrados` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Auth: Login ────────────────────────────────────────────────────────────

app.post("/api/v1/auth/login", async (req, res) => {
  try {
    const { email, phone, password } = req.body;
    if (!password || (!email && !phone)) {
      return res.status(400).json({ error: "Dados inválidos" });
    }

    let user;
    if (email) {
      const result = await pool.query("SELECT * FROM users WHERE LOWER(email) = LOWER($1)", [email]);
      user = result.rows[0];
    } else if (phone) {
      const result = await pool.query("SELECT * FROM users WHERE phone = $1", [phone]);
      user = result.rows[0];
    }

    if (!user) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    if (user.active === false) {
      return res.status(403).json({ error: "Conta desactivada" });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    const payload = { userId: user.id, role: user.role, email: user.email };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000,
      path: "/",
    });

    await pool.query("UPDATE users SET last_login_at = NOW() WHERE id = $1", [user.id]);

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error("[AUTH LOGIN] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Auth: Register ─────────────────────────────────────────────────────────

app.post("/api/v1/auth/register", async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Nome, email e password são obrigatórios" });
    }

    const existing = await pool.query("SELECT id FROM users WHERE LOWER(email) = LOWER($1)", [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Email já registado" });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const userRole = role || "comercial";

    const result = await pool.query(
      "INSERT INTO users (name, email, password_hash, role, phone) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role",
      [name, email, passwordHash, userRole, phone || null]
    );
    const user = result.rows[0];

    const payload = { userId: user.id, role: user.role, email: user.email };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.status(201).json({ token, user });
  } catch (err) {
    console.error("[AUTH REGISTER] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Auth: Logout ───────────────────────────────────────────────────────────

app.post("/api/v1/auth/logout", (_req, res) => {
  res.clearCookie("token", { path: "/" });
  res.json({ message: "Sessão terminada" });
});

// ─── Auth: Forgot Password ──────────────────────────────────────────────────

app.post("/api/v1/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email é obrigatório" });

    const result = await pool.query("SELECT id FROM users WHERE LOWER(email) = LOWER($1)", [email]);
    if (result.rows.length > 0) {
      const user = result.rows[0];
      const resetToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await pool.query(
        `INSERT INTO settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [`password_reset_${user.id}`, JSON.stringify({ token: resetToken, expiresAt: expiresAt.toISOString() })]
      );
      console.log(`[PASSWORD RESET] Token for ${email}: ${resetToken}`);
    }

    res.json({ message: "Se o email existir, receberá um link de recuperação" });
  } catch (err) {
    console.error("[AUTH FORGOT] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Auth: Reset Password ───────────────────────────────────────────────────

app.post("/api/v1/auth/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: "Token e password são obrigatórios" });

    const result = await pool.query("SELECT key, value FROM settings WHERE key LIKE 'password_reset_%'");
    let resetEntry = null;
    for (const row of result.rows) {
      try {
        const data = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
        if (data.token === token) { resetEntry = { key: row.key, data }; break; }
      } catch {}
    }

    if (!resetEntry) return res.status(400).json({ error: "Token inválido ou expirado" });
    if (new Date(resetEntry.data.expiresAt) < new Date()) return res.status(400).json({ error: "Token inválido ou expirado" });

    const userId = resetEntry.key.replace("password_reset_", "");
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await pool.query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [passwordHash, userId]);
    await pool.query("DELETE FROM settings WHERE key = $1", [resetEntry.key]);

    res.json({ message: "Password atualizada com sucesso" });
  } catch (err) {
    console.error("[AUTH RESET] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── SSE: Payment Updates ────────────────────────────────────────────────────

const paymentSSEClients = new Set();

app.get("/api/v1/payments/stream", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });
  res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);
  paymentSSEClients.add(res);
  req.on("close", () => paymentSSEClients.delete(res));
});

function broadcastPaymentUpdate(data) {
  for (const client of paymentSSEClients) {
    try { client.write(`data: ${JSON.stringify(data)}\n\n`); }
    catch { paymentSSEClients.delete(client); }
  }
}

// ─── É-kwanza Webhook (Multicaixa Express callback) ────────────────────────

app.post("/webhooks/ekwanza", async (req, res) => {
  try {
    const body = req.body;
    console.log("[EKWANZA-WEBHOOK] Callback recebido:", JSON.stringify(body).slice(0, 500));

    const { merchantTransactionId, ekwanzaTransactionId, operationStatus, operationData } = body;

    const statusMap = { 1: "confirmado", 3: "rejeitado", 4: "rejeitado", 5: "rejeitado" };
    const mappedStatus = statusMap[operationStatus] || "pendente";

    if (merchantTransactionId && mappedStatus !== "pendente") {
      await pool.query(
        `UPDATE payments SET status = $1, ekwanza_operation_code = $2, paid_at = ${mappedStatus === "confirmado" ? "NOW()" : "paid_at"}, reconciled_at = ${mappedStatus === "confirmado" ? "NOW()" : "reconciled_at"}, updated_at = NOW() WHERE code = $3`,
        [mappedStatus, ekwanzaTransactionId || null, merchantTransactionId]
      );
      console.log(`[EKWANZA-WEBHOOK] Pagamento ${merchantTransactionId} atualizado para ${mappedStatus}`);
      broadcastPaymentUpdate({ type: "payment_updated", code: merchantTransactionId, status: mappedStatus });
    }

    res.json({ received: true });
  } catch (err) {
    console.error("[EKWANZA-WEBHOOK] Erro:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── É-kwanza Check Status ───────────────────────────────────────────────

async function getEkwanzaToken() {
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.EKWANZA_CLIENT_ID,
    client_secret: process.env.EKWANZA_CLIENT_SECRET,
    resource: process.env.EKWANZA_RESOURCE,
  });
  const resp = await fetch("https://login.microsoftonline.com/auth.appypay.co.ao/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const data = await resp.json();
  return data.access_token;
}

app.get("/api/v1/payments/ekwanza/check-status/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const paymentResult = await pool.query("SELECT * FROM payments WHERE code = $1", [id]);
    if (paymentResult.rows.length === 0) {
      return res.status(404).json({ error: "Pagamento não encontrado" });
    }
    const payment = paymentResult.rows[0];
    const token = await getEkwanzaToken();
    const chargeResp = await fetch(`https://gwy-api.appypay.co.ao/v2.0/charges?merchantTransactionId=${encodeURIComponent(payment.code)}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!chargeResp.ok) {
      return res.json({ paymentId: id, code: payment.code, ekwanzaStatus: "QUERY_FAILED", currentStatus: payment.status });
    }
    const chargeData = await chargeResp.json();
    const charge = chargeData.payments?.[0];
    if (!charge) {
      return res.json({ paymentId: id, code: payment.code, ekwanzaStatus: "NOT_FOUND", currentStatus: payment.status });
    }
    const statusMap = { Success: "confirmado", Pending: "pendente", Failed: "rejeitado", Cancelled: "rejeitado", Expired: "rejeitado" };
    const newStatus = statusMap[charge.status] || payment.status;
    const changed = newStatus !== payment.status;
    if (changed) {
      const paidAt = charge.status === "Success" ? "NOW()" : "paid_at";
      const reconciledAt = charge.status === "Success" ? "NOW()" : "reconciled_at";
      await pool.query(
        `UPDATE payments SET status = $1, paid_at = ${paidAt}, reconciled_at = ${reconciledAt}, updated_at = NOW() WHERE code = $2`,
        [newStatus, payment.code]
      );
      console.log(`[CHECK-STATUS] ${payment.code}: ${payment.status} -> ${newStatus}`);
      broadcastPaymentUpdate({ type: "payment_updated", code: payment.code, status: newStatus });
    }
    res.json({
      paymentId: id,
      code: payment.code,
      ekwanzaStatus: charge.status,
      previousStatus: payment.status,
      newStatus,
      changed,
      amount: charge.amount,
      paymentMethod: charge.paymentMethod,
      createdDate: charge.createdDate,
      updatedDate: charge.updatedDate,
      reference: charge.reference,
    });
  } catch (err) {
    console.error("[CHECK-STATUS] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Edge Agent API (for gym PC edge_agent.py) ──────────────────────────────

const pendingCommands = [];

app.post("/api/edge/evento", async (req, res) => {
  try {
    const { tipo, pin, terminal_serie, timestamp } = req.body;
    if (!tipo || !pin) {
      return res.status(400).json({ autorizado: false, mensagem: "Dados inválidos" });
    }

    const now = timestamp ? new Date(timestamp) : new Date();
    const remoteId = Date.now();
    const accessType = tipo === "entrada" ? "entrada" : "saida";

    await pool.query(
      `INSERT INTO solve_access_logs (id, remote_id, customer_id, customer_name, access_date, access_time, access_type, result, reason)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (remote_id) DO NOTHING`,
      [remoteId, parseInt(pin) || 0, `Cliente ${pin}`, now.toISOString().split('T')[0], now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0'), accessType, 'autorizado', null]
    );

    console.log(`[EDGE] ${accessType} pin=${pin}`);
    res.json({ autorizado: true, mensagem: "Acesso autorizado", unlock: true });
  } catch (err) {
    console.error("[EDGE EVENTO] Error:", err.message);
    res.status(500).json({ autorizado: false, mensagem: err.message });
  }
});

app.get("/api/edge/comandos", (req, res) => {
  const agentId = req.query.agent_id || "PC01";
  const cmds = pendingCommands.filter(c => c.agent_id === agentId || !c.agent_id);
  // Clear delivered commands
  pendingCommands.length = 0;
  res.json({ comandos: cmds });
});

app.get("/api/edge/sincronizar", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT DISTINCT customer_id as id, customer_name as nome FROM solve_access_logs ORDER BY customer_name ASC"
    );
    res.json({ clientes: result.rows });
  } catch (err) {
    console.error("[EDGE SYNC] Error:", err.message);
    res.json({ clientes: [] });
  }
});

// ─── SSE: Streaming de acessos em tempo real ─────────────────────────────────

const sseClients = new Set();
let lastSyncedId = 0;

app.get("/api/v1/access/stream", requireAuth, async (req, res) => {
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

// ─── Serve frontend (built files) ─────────────────────────────────────────
import { existsSync } from "fs";
const staticDir = join(__dirname, "public");
if (existsSync(staticDir)) {
  app.use(express.static(staticDir));
  app.use((req, res, next) => {
    if (req.method === "GET" && !req.path.startsWith("/api/") && !req.path.startsWith("/healthz")) {
      res.sendFile(join(staticDir, "index.html"));
    } else {
      next();
    }
  });
}

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`Server listening on port ${port}`));

// Periodic expiration check for payments (every 5 minutes)
setInterval(async () => {
  try {
    const result = await pool.query(
      "UPDATE payments SET status = 'expirado', updated_at = NOW() WHERE status = 'pendente' AND expires_at < NOW() RETURNING code"
    );
    if (result.rows.length > 0) {
      console.log(`[EXPIRY] Marked ${result.rows.length} expired payments:`, result.rows.map(r => r.code));
    }
  } catch (err) {
    console.error("[EXPIRY] Error:", err.message);
  }
}, 5 * 60 * 1000);

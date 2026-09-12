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

// Cademi (plataforma de cursos) — defaults; editável em Integrações > Configurar
const CADEMI_API_URL = (process.env.CADEMI_API_URL || "https://brunosamora.cademi.com.br/api/v1").replace(/\/$/, "");
const CADEMI_API_KEY = process.env.CADEMI_API_KEY || "";

// Config dinâmica: tabela settings tem prioridade sobre env (editável no CRM).
let _settingsCache = { at: 0, map: {} };
async function getSetting(key) {
  if (Date.now() - _settingsCache.at > 60000) {
    try {
      const r = await pool.query("SELECT key, value FROM settings");
      _settingsCache = { at: Date.now(), map: Object.fromEntries(r.rows.map(x => [x.key, x.value])) };
    } catch {}
  }
  return _settingsCache.map[key];
}
async function cfg(key, envVal = "") {
  const v = await getSetting(key);
  return (v ?? envVal ?? "").toString().trim();
}

// REGRA CRM (isMember): funcionário = nome único (sem espaço) OU >3 entradas
// no mesmo dia → oculto das contagens e listas em todo o CRM. Sócios têm
// nome completo e ≤3 entradas/dia. Alias da tabela clientes como argumento.
const isMember = (alias) => `(TRIM(${alias}.nome) LIKE '% %' AND NOT EXISTS (SELECT 1 FROM acessos ax WHERE ax.cliente_id = ${alias}.id_cliente AND ax.tipo_acesso = 'entrada' GROUP BY ax.cliente_id, ax.data_acesso::date HAVING COUNT(*) > 3))`;
// Registos apagados têm numero_cartao com sufixo _del → ocultar também.
const notDeleted = (alias) => `(COALESCE(POSITION('_del' IN ${alias}.numero_cartao), 0) = 0)`;

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
// Add cademi_id column if missing (Cademi ↔ CRM link)
pool.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS cademi_id TEXT`).catch(() => {});
// Settings table (definições do workspace)
pool.query(`CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
)`).catch(() => {});

// ─── Settings ───────────────────────────────────────────────────────────────

app.get("/api/v1/settings", requireAuth, async (req, res) => {
  try {
    const r = await pool.query("SELECT key, value FROM settings WHERE key NOT LIKE 'password\\_reset\\_%' ESCAPE '\\'");
    const data = {};
    r.rows.forEach(row => { data[row.key] = row.value; });
    res.json({ data });
  } catch (err) {
    res.json({ data: {} });
  }
});

app.put("/api/v1/settings", requireAuth, async (req, res) => {
  try {
    const settings = req.body?.settings || req.body || {};
    for (const [key, value] of Object.entries(settings)) {
      if (key.startsWith("password_reset_")) continue;
      const jv = JSON.stringify(value ?? null);
      const upd = await pool.query(
        "UPDATE settings SET value = $2::jsonb, updated_at = NOW() WHERE key = $1",
        [key, jv]
      );
      if (upd.rowCount === 0) {
        await pool.query(
          "INSERT INTO settings (key, value, updated_at) VALUES ($1, $2::jsonb, NOW())",
          [key, jv]
        );
      }
    }
    _settingsCache = { at: 0, map: {} };
    res.json({ message: "Definições guardadas" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
  const base = await cfg("ovg_api_url", OVG_API_URL);
  const user = await cfg("ovg_username", OVG_USERNAME);
  const pass = await cfg("ovg_password", OVG_PASSWORD);
  if (!user || !pass) throw new Error("OVG credentials not configured (Integrações > Configurar)");
  const url = `${base}/APIControlAccess`;
  console.log("OVG login:", url);
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: user, password: pass }),
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
  const base = await cfg("ovg_api_url", OVG_API_URL);
  const club = await cfg("ovg_club_code", OVG_CLUB_CODE);
  const url = `${base}/ListOfCustomersDataDetailed/${club}`;
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
  const user = await cfg("ovg_username", OVG_USERNAME);
  const pass = await cfg("ovg_password", OVG_PASSWORD);
  if (!user || !pass) {
    return res.status(400).json({ error: "OVG credentials not configured (Integrações > Configurar)" });
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
    const M = isMember("c");
    const ND = notDeleted("c");
    const totalResult = await pool.query(`SELECT COUNT(*) as cnt FROM acessos a JOIN clientes c ON a.cliente_id = c.id_cliente WHERE ${M} AND ${ND}`);
    const todayResult = await pool.query(`SELECT COUNT(*) as cnt FROM acessos a JOIN clientes c ON a.cliente_id = c.id_cliente WHERE ${M} AND ${ND} AND a.data_acesso::date = CURRENT_DATE`);
    const authorizedToday = await pool.query(`SELECT COUNT(*) as cnt FROM acessos a JOIN clientes c ON a.cliente_id = c.id_cliente WHERE ${M} AND ${ND} AND a.data_acesso::date = CURRENT_DATE AND LOWER(a.resultado) = 'autorizado'`);
    const deniedToday = await pool.query(`SELECT COUNT(*) as cnt FROM acessos a JOIN clientes c ON a.cliente_id = c.id_cliente WHERE ${M} AND ${ND} AND a.data_acesso::date = CURRENT_DATE AND LOWER(a.resultado) != 'autorizado'`);
    const uniqueClients = await pool.query(`SELECT COUNT(DISTINCT a.cliente_id) as cnt FROM acessos a JOIN clientes c ON a.cliente_id = c.id_cliente WHERE ${M} AND ${ND}`);
    const clientsToday = await pool.query(`SELECT COUNT(DISTINCT a.cliente_id) as cnt FROM acessos a JOIN clientes c ON a.cliente_id = c.id_cliente WHERE ${M} AND ${ND} AND a.data_acesso::date = CURRENT_DATE`);
    const onlineNow = await pool.query(`SELECT COUNT(*) as cnt FROM clientes WHERE online = true AND ${isMember("clientes")} AND ${notDeleted("clientes")}`);
    const recentAccesses = await pool.query(
      `SELECT a.id_acesso, a.cliente_id, c.nome as cliente_nome, a.data_acesso::text, a.hora_acesso,
              a.tipo_acesso, a.resultado, a.motivo
       FROM acessos a JOIN clientes c ON a.cliente_id = c.id_cliente
       WHERE ${M} AND ${ND}
       ORDER BY a.id_acesso DESC LIMIT 10`
    );

    res.json({
      data: {
        clients: { total: parseInt(uniqueClients.rows[0].cnt), active: parseInt(clientsToday.rows[0].cnt), online: parseInt(onlineNow.rows[0].cnt), blocked: 0 },
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

    // Ocultar funcionários e registos apagados em todas as listagens
    where.push(isMember("c"));
    where.push(notDeleted("c"));

    if (req.query.client_id) {
      where.push("a.cliente_id = $" + (params.length + 1));
      params.push(parseInt(req.query.client_id));
    }
    if (req.query.resultado) {
      where.push("LOWER(a.resultado) = $" + (params.length + 1));
      params.push(req.query.resultado.toLowerCase());
    }
    if (req.query.tipo_acesso) {
      where.push("a.tipo_acesso = $" + (params.length + 1));
      params.push(req.query.tipo_acesso);
    }
    if (req.query.date_from) {
      where.push("a.data_acesso >= $" + (params.length + 1));
      params.push(req.query.date_from);
    }
    if (req.query.date_to) {
      where.push("a.data_acesso <= $" + (params.length + 1));
      params.push(req.query.date_to);
    }
    if (req.query.search) {
      where.push("(LOWER(c.nome) LIKE $" + (params.length + 1) + " OR a.cliente_id::text LIKE $" + (params.length + 2) + ")");
      params.push("%" + req.query.search.toLowerCase() + "%", req.query.search);
    }

    const whereClause = where.length > 0 ? "WHERE " + where.join(" AND ") : "";

    const totalResult = await pool.query(
      "SELECT COUNT(*) as cnt FROM acessos a LEFT JOIN clientes c ON a.cliente_id = c.id_cliente " + whereClause, params
    );
    const logs = await pool.query(
      `SELECT a.id_acesso, a.cliente_id, c.nome as cliente_nome, a.data_acesso::text as data_acesso, a.hora_acesso,
              a.tipo_acesso, a.resultado, a.motivo
       FROM acessos a LEFT JOIN clientes c ON a.cliente_id = c.id_cliente
       ${whereClause}
       ORDER BY a.id_acesso DESC LIMIT ${limit} OFFSET ${offset}`,
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
      "SELECT MAX(data_acesso || ' ' || hora_acesso) as last_sync FROM acessos"
    );
    const lastSync = recentResult.rows[0]?.last_sync;
    const isOnline = lastSync && (Date.now() - new Date(lastSync).getTime()) < 30 * 60 * 1000;

    const onlineClients = await pool.query(`SELECT COUNT(*) as cnt FROM clientes WHERE online = true AND ${isMember("clientes")} AND ${notDeleted("clientes")}`);

    res.json({
      data: {
        nome_terminal: "Solve Access",
        online: isOnline,
        ip: "192.168.1.182",
        porta: 8080,
        modelo: "ZKTeco",
        tipo: "Entrada",
        lastSync: lastSync,
        onlineClients: parseInt(onlineClients.rows[0].cnt),
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
        a.cliente_id as id_cliente,
        c.nome as nome,
        c.numero_cartao as numero_cartao,
        MAX(a.data_acesso::text) as ultimo_acesso,
        MAX(a.hora_acesso) as ultimo_hora,
        COUNT(*) as total_acessos,
        COUNT(*) FILTER (WHERE LOWER(a.resultado) = 'autorizado') as acessos_autorizados,
        COUNT(*) FILTER (WHERE LOWER(a.resultado) != 'autorizado') as acessos_negados,
        c.online,
        c.bloqueado,
        c.numero_entradas,
        c.limite_entradas,
        c.status as cliente_status,
        o.sex as ovg_sex,
        o.email as ovg_email,
        o.mobile_number as ovg_phone,
        o.nif as ovg_nif,
        o.status as ovg_status,
        o.last_entry as ovg_last_entry,
        o.entry_date as ovg_entry_date
       FROM acessos a
       LEFT JOIN clientes c ON a.cliente_id = c.id_cliente
       LEFT JOIN ovg_members o ON o.customer_number = CAST(c.numero_cartao AS TEXT)
       GROUP BY a.cliente_id, c.nome, c.online, c.bloqueado, c.numero_entradas, c.limite_entradas, c.status, c.numero_cartao, o.sex, o.email, o.mobile_number, o.nif, o.status, o.last_entry, o.entry_date
       ORDER BY c.nome ASC`
    );
    // Filtra funcionários (nome único OU >3 entradas/dia) e registos apagados (_del)
    let staffIds = new Set();
    try {
      const s = await pool.query(
        `SELECT DISTINCT ax.cliente_id FROM acessos ax WHERE ax.tipo_acesso = 'entrada' GROUP BY ax.cliente_id, ax.data_acesso::date HAVING COUNT(*) > 3`
      );
      s.rows.forEach(r => staffIds.add(String(r.cliente_id)));
    } catch {}
    const filtered = result.rows.filter(r => {
      if (!(r.nome || '').trim().includes(' ')) return false;
      if ((r.numero_cartao || '').includes('_del')) return false;
      if (staffIds.has(String(r.id_cliente))) return false;
      return true;
    });
    res.json({ data: filtered, total: filtered.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Customers (legacy endpoint for frontend compatibility) ─────────────────

app.get("/api/v1/customers", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT
        c.id_cliente as id,
        c.nome as name,
        MAX(a.data_acesso::text) as "joinedAt",
        MAX(a.data_acesso::text) as "createdAt",
        MAX(a.data_acesso::text) as "updatedAt",
        o.email,
        o.mobile_number as phone,
        o.sex as gender,
        o.entry_date as "entryDate",
        o.nif,
        o.status as state,
        c.status as client_status,
        c.online,
        c.bloqueado,
        c.numero_entradas,
        c.limite_entradas,
        '' as company,
        null as "planName",
        null as "subscriptionEnd",
        c.numero_cartao as code
       FROM clientes c
       LEFT JOIN acessos a ON a.cliente_id = c.id_cliente
       LEFT JOIN ovg_members o ON o.customer_number = c.numero_cartao
       WHERE EXISTS (SELECT 1 FROM acessos a2 WHERE a2.cliente_id = c.id_cliente)
         AND (TRIM(c.nome) LIKE '% %')
         AND NOT EXISTS (SELECT 1 FROM acessos ax WHERE ax.cliente_id = c.id_cliente AND ax.tipo_acesso = 'entrada' GROUP BY ax.cliente_id, ax.data_acesso::date HAVING COUNT(*) > 3)
         AND (COALESCE(POSITION('_del' IN c.numero_cartao), 0) = 0)
       GROUP BY c.id_cliente, c.nome, c.numero_cartao, c.status, c.online, c.bloqueado, c.numero_entradas, c.limite_entradas, o.email, o.mobile_number, o.sex, o.entry_date, o.nif, o.status, o.customer_number
       ORDER BY c.nome ASC`
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
        c.id_cliente as id,
        c.nome as name,
        MAX(a.data_acesso::text) as "joinedAt",
        o.email,
        o.mobile_number as phone,
        o.sex as gender,
        o.entry_date as "entryDate",
        o.nif,
        o.status as state,
        c.status as client_status,
        c.online,
        c.bloqueado,
        c.numero_entradas,
        c.limite_entradas,
        '' as company
       FROM clientes c
       LEFT JOIN acessos a ON a.cliente_id = c.id_cliente
       LEFT JOIN ovg_members o ON o.customer_number = c.numero_cartao
       WHERE c.id_cliente = $1
         AND (TRIM(c.nome) LIKE '% %')
         AND NOT EXISTS (SELECT 1 FROM acessos ax WHERE ax.cliente_id = c.id_cliente AND ax.tipo_acesso = 'entrada' GROUP BY ax.cliente_id, ax.data_acesso::date HAVING COUNT(*) > 3)
         AND (COALESCE(POSITION('_del' IN c.numero_cartao), 0) = 0)
       GROUP BY c.id_cliente, c.nome, c.numero_cartao, c.status, c.online, c.bloqueado, c.numero_entradas, c.limite_entradas, o.email, o.mobile_number, o.sex, o.entry_date, o.nif, o.status, o.customer_number`,
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
    client_id: await cfg("ekwanza_client_id", process.env.EKWANZA_CLIENT_ID || ""),
    client_secret: await cfg("ekwanza_client_secret", process.env.EKWANZA_CLIENT_SECRET || ""),
    resource: await cfg("ekwanza_resource", process.env.EKWANZA_RESOURCE || ""),
  });
  const resp = await fetch("https://login.microsoftonline.com/auth.appypay.co.ao/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const data = await resp.json();
  return data.access_token;
}

// ─── Payments ──────────────────────────────────────────────────────────────

app.get("/api/v1/payments", requireAuth, async (req, res) => {
  try {
    const where = [];
    const params = [];

    if (req.query.status) {
      where.push("p.status = $" + (params.length + 1));
      params.push(req.query.status);
    }
    if (req.query.customer_name) {
      where.push("(LOWER(p.code) LIKE $" + (params.length + 1) + " OR p.customer_id::text LIKE $" + (params.length + 1) + ")");
      params.push("%" + req.query.customer_name.toLowerCase() + "%");
    }
    if (req.query.date_from) {
      where.push("p.created_at >= $" + (params.length + 1));
      params.push(req.query.date_from);
    }
    if (req.query.date_to) {
      where.push("p.created_at <= $" + (params.length + 1));
      params.push(req.query.date_to);
    }
    if (req.query.min_amount) {
      where.push("p.amount >= $" + (params.length + 1));
      params.push(parseFloat(req.query.min_amount));
    }
    if (req.query.max_amount) {
      where.push("p.amount <= $" + (params.length + 1));
      params.push(parseFloat(req.query.max_amount));
    }

    const whereClause = where.length > 0 ? "WHERE " + where.join(" AND ") : "";
    const result = await pool.query(
      `SELECT p.* FROM payments p
       ${whereClause} ORDER BY p.id DESC LIMIT 200`, params
    );
    
    const total = await pool.query("SELECT COUNT(*) as cnt FROM payments p " + whereClause, params);
    const sum = await pool.query("SELECT COALESCE(SUM(p.amount), 0) as total FROM payments p " + whereClause, params);
    const byStatus = await pool.query(
      "SELECT p.status, COUNT(*) as cnt, COALESCE(SUM(p.amount), 0) as total FROM payments p " + whereClause + " GROUP BY p.status", params
    );

    res.json({ 
      data: result.rows, 
      total: parseInt(total.rows[0].cnt),
      sum: parseFloat(sum.rows[0].total),
      byStatus: byStatus.rows
    });
  } catch (err) {
    res.json({ data: [], total: 0, sum: 0, byStatus: [] });
  }
});

// ─── Plans ─────────────────────────────────────────────────────────────────

app.get("/api/v1/plans", requireAuth, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM plans ORDER BY id DESC");
    res.json({ data: result.rows, total: result.rows.length });
  } catch (err) {
    res.json({ data: [], total: 0 });
  }
});

// ─── Cademi (plataforma de cursos) ───────────────────────────────────────────
// Docs: https://ajuda.cademi.com.br/configuracoes/api
// Auth: header Authorization: <api-key> | Limite: 2 req/seg

let _cademiLastCall = 0;
async function cademiFetch(path, options = {}) {
  const base = (await cfg("cademi_api_url", CADEMI_API_URL)).replace(/\/$/, "");
  const key = await cfg("cademi_api_key", CADEMI_API_KEY);
  if (!key) {
    return { success: false, error: "Cademi não configurado (Integrações > Configurar)" };
  }
  // Throttle: máx 2 req/seg
  const wait = 550 - (Date.now() - _cademiLastCall);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  _cademiLastCall = Date.now();
  try {
    const resp = await fetch(`${base}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, ...(options.headers || {}) },
    });
    const data = await resp.json();
    if (!resp.ok || data.success === false) {
      return { success: false, error: data.msg || `HTTP ${resp.status}` };
    }
    return data;
  } catch (err) {
    return { success: false, error: err.message };
  }
}

app.get("/api/v1/cademi/health", requireAuth, async (req, res) => {
  const r = await cademiFetch("/produto");
  if (r.success) {
    res.json({ connected: true, message: "Conexão Cademi operacional", products: r.data?.produto?.length ?? 0 });
  } else {
    res.json({ connected: false, message: r.error || "Erro ao conectar Cademi" });
  }
});

app.get("/api/v1/ovg/health", requireAuth, async (req, res) => {
  try {
    const user = await cfg("ovg_username", OVG_USERNAME);
    const pass = await cfg("ovg_password", OVG_PASSWORD);
    if (!user || !pass) {
      return res.json({ data: { connected: false, message: "Credenciais OVG em falta (Integrações > Configurar)" } });
    }
    const count = await qNum("SELECT COUNT(*) as cnt FROM ovg_members");
    let lastSync = null;
    try {
      const r = await pool.query("SELECT MAX(synced_at) as m FROM ovg_members");
      lastSync = r.rows[0]?.m || null;
    } catch {}
    res.json({ data: { connected: count > 0, message: count > 0 ? `${count} sócios sincronizados` : "Sem sócios sincronizados", details: lastSync } });
  } catch (err) {
    res.json({ data: { connected: false, message: err.message } });
  }
});

app.get("/api/v1/pay4all/health", requireAuth, async (req, res) => {
  try {
    const token = await getEkwanzaToken();
    const count = await qNum("SELECT COUNT(*) as cnt FROM payments");
    res.json({ data: { connected: !!token, message: token ? `Ekwanza OK · ${count} transações` : "Falha de autenticação Ekwanza" } });
  } catch (err) {
    res.json({ data: { connected: false, message: err.message } });
  }
});

app.get("/api/v1/cademi/products", requireAuth, async (req, res) => {
  const r = await cademiFetch("/produto");
  if (!r.success) return res.status(502).json({ error: r.error });
  res.json({ data: r.data?.produto || [], total: (r.data?.produto || []).length });
});

app.get("/api/v1/cademi/users", requireAuth, async (req, res) => {
  // Primeira página (150 por página); ?all=1 segue o cursor até ao fim
  const all = req.query.all === "1";
  let users = [];
  let next = "/usuario?usuario_email_id_doc=";
  do {
    const r = await cademiFetch(next.startsWith("http") ? next.replace(CADEMI_API_URL, "") : next);
    if (!r.success) return res.status(502).json({ error: r.error });
    users = users.concat(r.data?.usuario || []);
    next = r.data?.paginator?.next_page_url || null;
  } while (all && next);
  res.json({ data: users, total: users.length });
});

app.get("/api/v1/cademi/users/:id", requireAuth, async (req, res) => {
  const r = await cademiFetch(`/usuario/${encodeURIComponent(req.params.id)}`);
  if (!r.success) return res.status(502).json({ error: r.error });
  res.json({ data: r.data?.usuario || null });
});

app.get("/api/v1/cademi/users/:id/access", requireAuth, async (req, res) => {
  const r = await cademiFetch(`/usuario/acesso/${encodeURIComponent(req.params.id)}`);
  if (!r.success) return res.status(502).json({ error: r.error });
  res.json({ data: r.data || null });
});

app.get("/api/v1/cademi/users/:id/progress/:productId", requireAuth, async (req, res) => {
  const r = await cademiFetch(`/usuario/progresso_por_produto/${encodeURIComponent(req.params.id)}/${encodeURIComponent(req.params.productId)}`);
  if (!r.success) return res.status(502).json({ error: r.error });
  res.json({ data: r.data?.progresso || null });
});

app.get("/api/v1/cademi/tags", requireAuth, async (req, res) => {
  const r = await cademiFetch("/tag");
  if (!r.success) return res.status(502).json({ error: r.error });
  res.json({ data: r.data?.itens || [], total: (r.data?.itens || []).length });
});

app.get("/api/v1/cademi/products/:id/lessons", requireAuth, async (req, res) => {
  const r = await cademiFetch(`/item/lista_por_produto/${encodeURIComponent(req.params.id)}`);
  if (!r.success) return res.status(502).json({ error: r.error });
  res.json({ data: r.data?.itens || [], total: (r.data?.itens || []).length });
});

// Sync: grava cademi_id nos customers por email
app.post("/api/v1/cademi/sync", requireAuth, async (req, res) => {
  const r = await cademiFetch("/usuario?usuario_email_id_doc=");
  if (!r.success) return res.status(502).json({ error: r.error });
  const users = r.data?.usuario || [];
  let matched = 0;
  for (const u of users) {
    if (!u.email) continue;
    try {
      const upd = await pool.query(
        "UPDATE customers SET cademi_id = $1 WHERE LOWER(email) = LOWER($2)",
        [String(u.id), u.email]
      );
      if (upd.rowCount > 0) matched++;
    } catch {}
  }
  res.json({ ok: true, cademiUsers: users.length, matched });
});

// Webhook recetor (configurar URL no painel Cademi: /api/v1/webhooks/cademi)
app.post("/api/v1/webhooks/cademi", async (req, res) => {
  try {
    const { event_type, event } = req.body || {};
    console.log(`[CADEMI WEBHOOK] ${event_type}`, event?.usuario?.email || "");
    // Liga aluno ao cliente por email quando houver evento de usuário
    const email = event?.usuario?.email;
    const cademiId = event?.usuario?.id;
    if (email && cademiId) {
      await pool.query(
        "UPDATE customers SET cademi_id = $1 WHERE LOWER(email) = LOWER($2)",
        [String(cademiId), email]
      ).catch(() => {});
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Dashboard (dados reais do Neon) ────────────────────────────────────────

// Cache do estado Cademi (a API tem limite de 2 req/seg)
let _cademiCache = { at: 0, data: null };
async function getCademiStatus() {
  if (Date.now() - _cademiCache.at < 60000 && _cademiCache.data) return _cademiCache.data;
  const r = await cademiFetch("/produto");
  _cademiCache = {
    at: Date.now(),
    data: r.success
      ? { connected: true, products: r.data?.produto?.length ?? 0 }
      : { connected: false, error: r.error || "Não configurado" },
  };
  return _cademiCache.data;
}

async function qNum(sql, params = [], fallback = 0) {
  try {
    const r = await pool.query(sql, params);
    return parseFloat(r.rows[0]?.cnt ?? r.rows[0]?.total ?? fallback);
  } catch { return fallback; }
}

async function getIntegrationsLive() {
  const [ovgCount, ovgSync, payCount, paySync, leadCount, cademi, cademiKey] = await Promise.all([
    qNum("SELECT COUNT(*) as cnt FROM ovg_members"),
    (async () => { try { const r = await pool.query("SELECT MAX(synced_at) as m FROM ovg_members"); return r.rows[0]?.m || null; } catch { return null; } })(),
    qNum("SELECT COUNT(*) as cnt FROM payments"),
    (async () => { try { const r = await pool.query("SELECT MAX(created_at) as m FROM payments"); return r.rows[0]?.m || null; } catch { return null; } })(),
    qNum("SELECT COUNT(*) as cnt FROM leads"),
    getCademiStatus(),
    cfg("cademi_api_key", CADEMI_API_KEY),
  ]);
  const now = new Date().toISOString();
  return [
    { id: "ovg", name: "OVG", status: ovgCount > 0 ? "operacional" : "atencao", lastSyncAt: ovgSync, errorCount: 0, createdAt: now, updatedAt: now },
    { id: "pay4all", name: "Pay4All", status: payCount > 0 ? "operacional" : "atencao", lastSyncAt: paySync, errorCount: 0, createdAt: now, updatedAt: now },
    { id: "cademi", name: "Cademi", status: !cademiKey ? "inativo" : (cademi.connected ? "operacional" : "atencao"), lastSyncAt: cademi.connected ? now : null, errorCount: 0, createdAt: now, updatedAt: now },
    { id: "whatsapp", name: "WhatsApp", status: "inativo", lastSyncAt: null, errorCount: 0, createdAt: now, updatedAt: now },
    { id: "website", name: "Website", status: leadCount > 0 ? "operacional" : "atencao", lastSyncAt: null, errorCount: 0, createdAt: now, updatedAt: now },
  ];
}

app.get("/api/v1/dashboard/stats", requireAuth, async (req, res) => {
  try {
    const [totalCustomers, activeCustomers, totalLeads, revenue30d, pendingPayments, latePayments, integrations] = await Promise.all([
      qNum(`SELECT COUNT(*) as cnt FROM clientes WHERE ${isMember("clientes")} AND ${notDeleted("clientes")}`),
      // Activo = status ativo E sócio (não funcionário) E com pelo menos 1 acesso na catraca
      qNum(`SELECT COUNT(DISTINCT c.id_cliente) as cnt FROM clientes c WHERE LOWER(c.status) = 'ativo' AND ${isMember("c")} AND ${notDeleted("c")} AND EXISTS (SELECT 1 FROM acessos a WHERE a.cliente_id = c.id_cliente)`),
      qNum("SELECT COUNT(*) as cnt FROM leads"),
      qNum("SELECT COALESCE(SUM(amount),0) as total FROM payments WHERE LOWER(status::text) = 'confirmado' AND created_at >= NOW() - INTERVAL '30 days'"),
      qNum("SELECT COUNT(*) as cnt FROM payments WHERE LOWER(status::text) = 'pendente'"),
      qNum("SELECT COUNT(*) as cnt FROM payments WHERE LOWER(status::text) = 'em_atraso'"),
      getIntegrationsLive(),
    ]);
    let leadsByStatus = [];
    try {
      const r = await pool.query("SELECT status, COUNT(*) as count FROM leads GROUP BY status");
      leadsByStatus = r.rows;
    } catch {}
    res.json({
      data: {
        overview: { totalCustomers, activeCustomers, totalLeads, revenueLast30Days: revenue30d, pendingPayments, latePayments },
        leadsByStatus,
        integrations: integrations.map(i => ({ name: i.name, status: i.status, lastSyncAt: i.lastSyncAt })),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/v1/dashboard/charts", requireAuth, async (req, res) => {
  try {
    let revenueByMonth = [];
    try {
      const r = await pool.query(
        `SELECT to_char(date_trunc('week', created_at), 'DD/MM') as month, COALESCE(SUM(amount),0) as value
         FROM payments WHERE LOWER(status::text) = 'confirmado' AND created_at >= NOW() - INTERVAL '56 days'
         GROUP BY 1 ORDER BY MIN(created_at)`
      );
      revenueByMonth = r.rows.map(x => ({ month: x.month, value: parseFloat(x.value) }));
    } catch {}
    let leadsBySource = [];
    try {
      const r = await pool.query("SELECT source, COUNT(*) as count FROM leads GROUP BY source");
      leadsBySource = r.rows;
    } catch {}
    let paymentMethods = [];
    try {
      const r = await pool.query("SELECT method, COUNT(*) as count FROM payments GROUP BY method");
      paymentMethods = r.rows;
    } catch {}
    const [confirmed, total] = await Promise.all([
      qNum("SELECT COUNT(*) as cnt FROM payments WHERE LOWER(status::text) = 'confirmado'"),
      qNum("SELECT COUNT(*) as cnt FROM payments"),
    ]);
    res.json({
      data: {
        revenueByMonth,
        leadsBySource,
        conversionRate: total > 0 ? Math.round((confirmed / total) * 100) : 0,
        paymentMethods,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/v1/integrations", requireAuth, async (req, res) => {
  try {
    const list = await getIntegrationsLive();
    res.json({ data: list, total: list.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Audit log (feed de actividade real) ────────────────────────────────────

app.get("/api/v1/audit-logs", requireAuth, async (req, res) => {
  try {
    const events = [];
    try {
      const r = await pool.query("SELECT DISTINCT ON (source) id, synced_at, records_synced, source FROM sync_log ORDER BY source, id DESC");
      r.rows.forEach(s => events.push({
        id: `sync-${s.id}`, actor: "Sistema",
        action: `Última sincronização ${s.source || ''}: ${s.records_synced ?? 0} registos`,
        entity: s.source || 'sync', entityId: null, createdAt: s.synced_at,
      }));
    } catch {}
    try {
      const r = await pool.query("SELECT id, code, amount, status, created_at FROM payments ORDER BY created_at DESC LIMIT 50");
      r.rows.forEach(p => events.push({
        id: `pay-${p.id}`, actor: "Pay4All",
        action: `Pagamento ${p.status}: ${p.amount} Kz`,
        entity: "payment", entityId: p.code, createdAt: p.created_at,
      }));
    } catch {}
    try {
      const r = await pool.query("SELECT id_cliente, nome, data_atualizacao FROM clientes WHERE bloqueado = true ORDER BY data_atualizacao DESC LIMIT 20");
      r.rows.forEach(c => events.push({
        id: `blk-${c.id_cliente}`, actor: "Sistema",
        action: `Conta bloqueada: ${c.nome}`,
        entity: "customer", entityId: String(c.id_cliente), createdAt: c.data_atualizacao,
      }));
    } catch {}
    events.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const entity = req.query.entity;
    const filtered = entity ? events.filter(e => e.entity === entity) : events;
    res.json({ data: filtered.slice(0, 100), total: filtered.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Automations ────────────────────────────────────────────────────────────

const mapAutomation = (r) => ({
  id: r.id, name: r.name, trigger: r.trigger, action: r.action, active: r.active,
  runCount: r.run_count ?? 0, lastRunAt: r.last_run_at || null,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

app.get("/api/v1/automations", requireAuth, async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM automations ORDER BY created_at DESC");
    res.json({ data: r.rows.map(mapAutomation), total: r.rows.length });
  } catch (err) {
    res.json({ data: [], total: 0 });
  }
});

app.post("/api/v1/automations", requireAuth, async (req, res) => {
  try {
    const { name, trigger, action } = req.body;
    if (!name || !trigger || !action) return res.status(400).json({ error: "name, trigger e action são obrigatórios" });
    const r = await pool.query(
      "INSERT INTO automations (name, trigger, action) VALUES ($1, $2, $3) RETURNING *",
      [name, trigger, action]
    );
    res.status(201).json({ data: mapAutomation(r.rows[0]) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/v1/automations/:id", requireAuth, async (req, res) => {
  try {
    const fields = [];
    const params = [];
    for (const k of ["name", "trigger", "action", "active"]) {
      if (req.body[k] !== undefined) { fields.push(`${k} = $${params.length + 1}`); params.push(req.body[k]); }
    }
    if (fields.length === 0) return res.status(400).json({ error: "Nada para atualizar" });
    fields.push("updated_at = NOW()");
    params.push(req.params.id);
    const r = await pool.query(`UPDATE automations SET ${fields.join(", ")} WHERE id = $${params.length} RETURNING *`, params);
    if (r.rows.length === 0) return res.status(404).json({ error: "Automação não encontrada" });
    res.json({ data: mapAutomation(r.rows[0]) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/v1/automations/:id", requireAuth, async (req, res) => {
  try {
    const r = await pool.query("DELETE FROM automations WHERE id = $1", [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: "Automação não encontrada" });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/v1/automations/:id/toggle", requireAuth, async (req, res) => {
  try {
    const r = await pool.query("UPDATE automations SET active = NOT active, updated_at = NOW() WHERE id = $1 RETURNING *", [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: "Automação não encontrada" });
    res.json({ data: mapAutomation(r.rows[0]) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/v1/plans", requireAuth, async (req, res) => {
  try {
    const { name, description, price, periodicity, duration, active, ovg_plan_id } = req.body;
    if (!name) return res.status(400).json({ error: "Nome é obrigatório" });
    const result = await pool.query(
      `INSERT INTO plans (name, description, price, periodicity, duration, active, ovg_plan_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, description || null, price || 0, periodicity || 'mensal', duration || null, active !== false, ovg_plan_id || null]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/v1/plans/:id", requireAuth, async (req, res) => {
  try {
    const { name, description, price, periodicity, duration, active, ovg_plan_id } = req.body;
    const fields = [];
    const params = [];
    if (name !== undefined) { fields.push("name = $" + (params.length + 1)); params.push(name); }
    if (description !== undefined) { fields.push("description = $" + (params.length + 1)); params.push(description); }
    if (price !== undefined) { fields.push("price = $" + (params.length + 1)); params.push(price); }
    if (periodicity !== undefined) { fields.push("periodicity = $" + (params.length + 1)); params.push(periodicity); }
    if (duration !== undefined) { fields.push("duration = $" + (params.length + 1)); params.push(duration); }
    if (active !== undefined) { fields.push("active = $" + (params.length + 1)); params.push(active); }
    if (ovg_plan_id !== undefined) { fields.push("ovg_plan_id = $" + (params.length + 1)); params.push(ovg_plan_id); }
    if (fields.length === 0) return res.status(400).json({ error: "Nada para atualizar" });
    fields.push("updated_at = NOW()");
    params.push(req.params.id);
    const result = await pool.query(
      `UPDATE plans SET ${fields.join(", ")} WHERE id = $${params.length} RETURNING *`, params
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Plano não encontrado" });
    res.json({ data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/v1/plans/:id", requireAuth, async (req, res) => {
  try {
    const result = await pool.query("DELETE FROM plans WHERE id = $1 RETURNING id", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Plano não encontrado" });
    res.json({ ok: true, id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Subscriptions ─────────────────────────────────────────────────────────

app.get("/api/v1/subscriptions", requireAuth, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM subscriptions ORDER BY id DESC LIMIT 100");
    res.json({ data: result.rows, total: result.rows.length });
  } catch (err) {
    res.json({ data: [], total: 0 });
  }
});

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

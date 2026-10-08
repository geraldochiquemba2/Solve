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
  // Fase 2 BDs: o CRM (Cademi) usa CRM_DATABASE_URL (BD nova).
  // DATABASE_URL mantém a do ginásio (projeto antigo) — intocada.
  // Filtra channel_binding (Neon) como em packages/db — o driver pg não o suporta.
  connectionString: (process.env.CRM_DATABASE_URL || process.env.DATABASE_URL || "")
    .replace("&channel_binding=require", "")
    .replace("channel_binding=require&", ""),
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

const API_KEY = process.env.API_KEY || "";
const JWT_SECRET = process.env.JWT_SECRET || "";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h";
const SALT_ROUNDS = 10;

// SEGURANÇA: em produção o servidor recusa arrancar sem segredos.
// (Antes aceitava chaves públicas conhecidas — qualquer pessoa entrava.)
if (process.env.NODE_ENV === "production" && (!API_KEY || !JWT_SECRET)) {
  console.error("[segurança] API_KEY e JWT_SECRET são obrigatórios em produção. A recusar arranque.");
  process.exit(1);
}
if (!API_KEY || !JWT_SECRET) {
  console.warn("[segurança] API_KEY/JWT_SECRET em falta: a usar modo dev local inseguro");
}
// Chave das máquinas do ginásio (edge_agent.py, sync_crm.py, sync_ovg.py):
// por defeito igual à API_KEY; os scripts do PC enviam `X-API-Key: <valor>`.
const EDGE_API_KEY = process.env.EDGE_API_KEY || API_KEY;
// Diagnóstico de arranque: visível nos logs do Render (só nomes/host, sem valores).
const _DB_SRC = process.env.CRM_DATABASE_URL ? "CRM_DATABASE_URL" : (process.env.DATABASE_URL ? "DATABASE_URL" : "nenhuma");
const _DB_HOST = ((_DB_SRC === "CRM_DATABASE_URL" ? process.env.CRM_DATABASE_URL : process.env.DATABASE_URL) || "").replace(/\?.*$/, "").split("@")[1]?.split(/[/:]/)[0] || "?";
console.log(`[boot] NODE_ENV=${process.env.NODE_ENV || "?"}` +
  ` API_KEY=${API_KEY ? "ok" : "EM FALTA"} JWT_SECRET=${JWT_SECRET ? "ok" : "EM FALTA"}` +
  ` EDGE_API_KEY=${EDGE_API_KEY ? "ok" : "EM FALTA"} DB=${_DB_SRC}@${_DB_HOST}`);

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
  // Prioridade: env do servidor (Render) > tabela settings (fallback local/UI)
  const e = (envVal ?? "").toString().trim();
  if (e) return e;
  const v = await getSetting(key);
  return (v ?? "").toString().trim();
}

// REGRA CRM (isMember): funcionário = nome único (sem espaço) OU >3 entradas
// no mesmo dia → oculto das contagens e listas em todo o CRM. Sócios têm
// nome completo e ≤3 entradas/dia. Alias da tabela clientes como argumento.
const isMember = (alias) => `(TRIM(${alias}.nome) LIKE '% %' AND NOT EXISTS (SELECT 1 FROM acessos ax WHERE ax.cliente_id = ${alias}.id_cliente AND ax.tipo_acesso = 'entrada' GROUP BY ax.cliente_id, ax.data_acesso::date HAVING COUNT(*) > 3))`;
// Registos apagados têm numero_cartao com sufixo _del → ocultar também.
const notDeleted = (alias) => `(COALESCE(POSITION('_del' IN ${alias}.numero_cartao), 0) = 0)`;

function apiKeyMatches(provided, expected) {
  if (typeof provided !== "string" || !expected) return false;
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// VULN-16: cookies sem dependências (o EventSource do browser envia o cookie
// httpOnly automaticamente, por isso a chave já não precisa de ir no URL).
function parseCookies(req) {
  const out = {};
  const h = req.headers?.cookie;
  if (!h) return out;
  for (const part of h.split(";")) {
    const i = part.indexOf("=");
    if (i > 0) {
      try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); }
      catch { out[part.slice(0, i).trim()] = part.slice(i + 1).trim(); }
    }
  }
  return out;
}

// ─── CSRF (double-submit assinado) ────────────────────────────────────────
// Só estão expostos os pedidos autenticados EXCLUSIVAMENTE pelo cookie `token`:
// um `Authorization: Bearer` ou um `X-API-Key` exigem preflight CORS, que a
// allowlist de origens recusa. O par (cookie legível + header) é assinado com o
// JWT_SECRET para que um subdomínio irmão não consiga injetar o cookie e
// montar o ataque de "cookie injection" do double-submit puro.
const CSRF_COOKIE = "csrf";
const CSRF_HEADER = "x-csrf-token";
const CSRF_MAX_AGE = 24 * 60 * 60 * 1000;

function csrfMac(raw) {
  return crypto.createHmac("sha256", JWT_SECRET).update(raw).digest("base64url");
}

function issueCsrfToken() {
  const raw = crypto.randomBytes(32).toString("base64url");
  return `${raw}.${csrfMac(raw)}`;
}

function csrfCookieOptions() {
  return {
    httpOnly: false, // tem de ser legível pelo browser para voltar no header
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: CSRF_MAX_AGE,
  };
}

function verifyCsrfToken(value) {
  if (typeof value !== "string" || !JWT_SECRET) return false;
  const cut = value.lastIndexOf(".");
  if (cut <= 0) return false;
  const esperado = csrfMac(value.slice(0, cut));
  const recebido = value.slice(cut + 1);
  if (recebido.length !== esperado.length) return false;
  return crypto.timingSafeEqual(Buffer.from(recebido), Buffer.from(esperado));
}

// Métodos seguros não mudam estado e ficam de fora (ex.: o GET de perfil que o
// widget do Cademi faz na própria origem).
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function csrfGuard(req) {
  if (SAFE_METHODS.has(req.method)) return true;
  const header = req.headers[CSRF_HEADER];
  const cookie = parseCookies(req)[CSRF_COOKIE];
  if (typeof header !== "string" || !header || header !== cookie) return false;
  return verifyCsrfToken(header);
}

// ─── Epoch de sessão (revogação após alteração de password) ───────────────
// O JWT é stateless: sem isto, um token roubado continuava válido até às 24h
// depois de o dono mudar a password. Guardamos um contador de sessão na
// tabela `settings` (que já existe — sem migração) e pomos-lo no JWT no login.
// O requireAuth compara o valor do token com o atual.
const SESSION_EPOCH_TTL_MS = 30 * 1000;
const _sessionEpochCache = new Map();

async function getSessionEpoch(userId) {
  const cached = _sessionEpochCache.get(userId);
  const now = Date.now();
  if (cached && now - cached.at < SESSION_EPOCH_TTL_MS) return cached.epoch;
  const row = await pool.query("SELECT value FROM settings WHERE key = $1", [`session_epoch_${userId}`]);
  const epoch = String(row.rows[0]?.value ?? "");
  _sessionEpochCache.set(userId, { epoch, at: now });
  return epoch;
}

async function rotateSessionEpoch(userId) {
  const epoch = crypto.randomBytes(16).toString("hex");
  await pool.query(
    `INSERT INTO settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    [`session_epoch_${userId}`, epoch]
  );
  _sessionEpochCache.set(userId, { epoch, at: Date.now() });
  return epoch;
}

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  let token;
  let viaCookie = false;
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else {
    token = parseCookies(req).token;
    viaCookie = Boolean(token);
  }
  if (!token) {
    // VULN-16: chave só via header (nunca ?api_key= no URL — vaza em logs).
    const key = req.headers["x-api-key"];
    if (apiKeyMatches(key, API_KEY)) {
      // Paridade com apps/api: máquina autenticada, sem JWT de utilizador.
      // requireRole bloqueia este userId nas rotas de gestão.
      req.user = { userId: "api-key", role: "administrador", email: "" };
      return next();
    }
    return res.status(401).json({ error: "Token de autenticação necessário" });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Isolamento portal-cliente: tokens role=cliente não valem nas rotas staff.
    if (decoded && decoded.role === "cliente") {
      return res.status(403).json({ error: "Sem permissão para esta acção" });
    }
    // Uma sessão por cookie num pedido que muda estado tem de provar que vem do
    // nosso frontend (header CSRF assinado). Bearer/API-Key não são forjáveis a
    // partir de outro site e ficam de fora para não partir clientes legítimos.
    if (viaCookie && !csrfGuard(req)) {
      audit(req, "auth.csrf_rejected", { details: { method: req.method, path: String(req.path || "").slice(0, 100) } });
      return res.status(403).json({ error: "Token CSRF em falta ou inválido. Recarrega a página." });
    }
    // Revogação: o token tem de ter sido emitido com o epoch de sessão atual.
    // Tokens antigos (sem `se`) só passam enquanto o epoch continuar vazio.
    const epochAtual = await getSessionEpoch(decoded.userId);
    if (String(decoded.se ?? "") !== epochAtual) {
      audit(req, "auth.session_revoked", { actorId: decoded.userId, details: { motivo: "password_alterada" } });
      return res.status(401).json({ error: "Sessão invalidada. Faz login de novo." });
    }
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }
}

// Auth das máquinas do ginásio (só chave via header, sem JWT): sync_crm.py,
// sync_ovg.py, edge_agent.py enviam `X-API-Key: <API_KEY>`. Sem chave → 401.
function requireEdgeAuth(req, res, next) {
  const key = req.headers["x-api-key"] || req.headers["x-edge-key"];
  if (apiKeyMatches(key, EDGE_API_KEY)) return next();
  return res.status(401).json({ error: "Chave de máquina inválida" });
}

// Auditoria de acesso negado com throttle: uma página que consulta a cada
// 5 min e leva 403 não pode encher a audit_logs. Máx. 1 registo por
// utilizador+rota por minuto.
const _denyAuditAt = new Map();
function auditDenied(req, action, opts = {}) {
  const who = opts.actorId ?? (req.user && req.user.userId) ?? "?";
  const rota = String(req.path || "").slice(0, 80);
  const key = `${action}:${who}:${rota}`;
  const now = Date.now();
  if ((_denyAuditAt.get(key) || 0) > now - 60000) return;
  _denyAuditAt.set(key, now);
  if (_denyAuditAt.size > 2000) _denyAuditAt.clear();
  audit(req, action, opts);
}

function requireRole(...allowed) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Não autenticado" });
    // Chave de máquina (userId api-key) vale como admin para ingestão, mas
    // nunca para gestão: rotas admin exigem JWT de utilizador com papel.
    if (req.user.userId === "api-key" || !allowed.includes(req.user.role)) {
      auditDenied(req, "auth.access_denied", {
        actor: req.user.name || "sistema",
        actorId: req.user.userId,
        details: {
          papel: req.user.role,
          permitidos: allowed,
          metodo: req.method,
          path: String(req.path || "").slice(0, 120),
        },
      });
      return res.status(403).json({ error: "Sem permissão para esta acção" });
    }
    next();
  };
}
const requireAdmin = requireRole("administrador");
const requireManager = requireRole("administrador", "gestor");
const requireFinance = requireRole("administrador", "gestor", "financeiro");

// ─── Painel /admin: sessão verificada no servidor ───────────────────────────
// O CRM é uma SPA: o browser decide as rotas e o servidor entrega sempre o
// mesmo index.html, por isso sem esta guarda qualquer visitante recebia o HTML
// do backoffice (os dados já vêm de /api/v1, mas a página é um activo
// administrativo). Aqui só é entregue a quem tem sessão de staff válida —
// exactamente as mesmas regras de requireAuth (papel, epoch de sessão).
function isAdminPath(p) {
  return p === "/admin" || p.startsWith("/admin/");
}

async function adminPageGuard(req, res, next) {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  if (!isAdminPath(req.path)) return next();

  const negar = (motivo, status) => {
    auditDenied(req, "admin.page_denied", {
      details: { motivo, metodo: req.method, path: String(req.path).slice(0, 120) },
    });
    res.setHeader("Cache-Control", "no-store");
    if (status === 302) return res.redirect(302, "/login");
    return res.status(status).send("403 - Sem permissão para esta área");
  };

  const token = parseCookies(req).token;
  if (!token) return negar("sem_sessao", 302);
  if (!JWT_SECRET) return negar("servidor_sem_segredo", 302);

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    return negar("token_invalido_ou_expirado", 302);
  }
  if (!decoded || decoded.role === "cliente") return negar("papel_sem_permissao", 403);

  try {
    const epochAtual = await getSessionEpoch(decoded.userId);
    if (String(decoded.se ?? "") !== epochAtual) return negar("sessao_revogada", 302);
  } catch {
    return negar("sessao_indisponivel", 302);
  }

  // O HTML do painel nunca fica em cache (contém sessão/app em estado inicial).
  res.setHeader("Cache-Control", "no-store");
  next();
}

const app = express();
app.disable("x-powered-by"); // VULN-15: não anunciar framework.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// SEGURANÇA: cabeçalhos mínimos (sem helmet para não adicionar dependências).
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

// Rate-limit simples em memória (sem dependências): 200 req/min por IP no
// geral; 20/min em auth/OTP/edge; 60/min em webhooks.
const _hits = new Map();
function rateLimit(maxPerMin) {
  return (req, res, next) => {
    const now = Date.now();
    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    const key = `${maxPerMin}:${ip}`;
    const arr = (_hits.get(key) || []).filter((t) => now - t < 60000);
    if (arr.length >= maxPerMin) {
      return res.status(429).json({ error: "Demasiados pedidos. Tente mais tarde" });
    }
    arr.push(now);
    _hits.set(key, arr);
    // Limpeza ocasional para não crescer sem limite.
    if (_hits.size > 5000) _hits.clear();
    next();
  };
}
setInterval(() => _hits.clear(), 5 * 60 * 1000).unref?.();

// Limite por alvo e não só por IP. Um atacante a rodar de vários IPs não pode
// massificar pedidos de recuperação contra a mesma conta (ou martelar um login
// só num cliente). Sem chave (pedido sem email) deixa passar: quem não dá um
// alvo não consegue usar isto para enumerar.
const _hitsByKey = new Map();
function rateLimitBy(maxCount, windowMs, keyFn, message) {
  return (req, res, next) => {
    const key = keyFn(req);
    if (!key) return next();
    const now = Date.now();
    const arr = (_hitsByKey.get(key) || []).filter((t) => now - t < windowMs);
    if (arr.length >= maxCount) {
      return res.status(429).json({ error: message || "Demasiados pedidos. Tente mais tarde" });
    }
    arr.push(now);
    _hitsByKey.set(key, arr);
    if (_hitsByKey.size > 5000) _hitsByKey.clear();
    next();
  };
}
setInterval(() => _hitsByKey.clear(), 10 * 60 * 1000).unref?.();

// Limites das leituras públicas do widget Cademi (histórico, acessos, nome).
//
// Estes endpoints não exigem JWT — o aluno prova a posse com o email/telefone
// que acabou de escrever — por isso precisam de dois travões:
//
//  * por IP, contra recolha em massa a partir de uma máquina;
//  * por conta, contra martelar o histórico de uma vítima específica a partir
//    de IPs diferentes (é o vector que o limite por IP não apanha).
//
// Dimensionado a partir do consumo real do widget (num checkout chega a ~5
// chamadas por endpoint, sem polling): 15 por 15 min por conta dão margem para
// recarregar a página ou repetir o clique em "Pagar" sem partir o fluxo, e
// limitam um atacante a 15 leituras por trimestre de hora sobre um alvo.
// Nota honesta: um limite por conta NÃO impede enumerar muitos e-mails
// diferentes (cada um tem a sua quota). Isso só se fecha comfactor adicional
// de posse (sessão do aluno ou link por e-mail) — o que exige decisão do dono.
const STUDENT_LOOKUP = { perIpPerMin: 30, perAccount: 15, windowMs: 15 * 60 * 1000 };

function studentLookupLimit() {
  return [
    rateLimit(STUDENT_LOOKUP.perIpPerMin),
    rateLimitBy(
      STUDENT_LOOKUP.perAccount,
      STUDENT_LOOKUP.windowMs,
      (req) => {
        const email = String(req.query?.email || "").trim().toLowerCase();
        const digits = String(req.query?.phone || "").replace(/\D/g, "").slice(-9);
        const raw = email || digits;
        if (!raw) return null; // sem chave o request segue para o 400 de validação
        // o endpoint entra na chave para não gastar a quota de outro
        const endpoint = String(req.path || req.originalUrl || "").split("?")[0];
        return `student_lookup:${endpoint}:${raw}`;
      },
      "Demasiadas consultas. Aguarde um momento e tente de novo."
    ),
  ];
}

// Hash descartável para igualar o tempo de resposta quando a conta não existe.
// Sem isto, "email inexistente" respondia em microssegundos e "email existente
// com password errada" demorava um bcrypt — a diferença denunciava que emails
// estão registados. A primeira chamada paga a geração do dummy, que só torna a
// resposta mais lenta (o sentido seguro).
let _dummyHashPromise = null;
function dummyPasswordHash() {
  if (!_dummyHashPromise) {
    _dummyHashPromise = bcrypt.hash(crypto.randomBytes(24).toString("hex"), SALT_ROUNDS);
  }
  return _dummyHashPromise;
}

// ─── Registo de eventos de segurança ──────────────────────────────────────
// A tabela `audit_logs` existia no schema mas nunca era escrita, por isso não
// havia rasto de tentativas de intrusão. Aqui registamos os eventos de
// segurança sem PII, sem tokens e sem passwords: o email de quem tenta entrar
// entra apenas como hash truncado, o que permite correlacionar ataques à mesma
// conta sem guardar o endereço. É fire-and-forget — um log nunca pode fazer
// falhar um pedido.
function audit(req, action, { actor, actorId, entity, entityId, details } = {}) {
  try {
    const ip = String(req?.ip || req?.socket?.remoteAddress || "").slice(0, 50) || null;
    pool.query(
      `INSERT INTO audit_logs (actor, actor_id, action, entity, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        String(actor ?? "sistema").slice(0, 255),
        actorId ?? null,
        String(action).slice(0, 255),
        entity === undefined ? null : String(entity).slice(0, 100),
        entityId ?? null,
        details === undefined ? null : JSON.stringify(details),
        ip,
      ]
    ).catch(() => {});
  } catch {}
}

// Referência a uma conta sem guardar o email: hash SHA-256 truncado.
function emailRef(email) {
  if (!email) return null;
  return crypto.createHash("sha256").update(String(email).trim().toLowerCase()).digest("hex").slice(0, 16);
}

const CORS_ORIGIN = process.env.CORS_ORIGIN || process.env.APP_URL || "http://localhost:5173,https://solve-sqoh.onrender.com,https://brunosamora.cademi.com.br";
app.use(cors({
  origin: CORS_ORIGIN.split(",").map(s => s.trim()).filter(Boolean),
  credentials: true,
}));
app.use(express.json({ limit: "100kb",
  // Guarda o corpo raw para verificação HMAC do webhook WiPay (a doc exige
  // assinar o payload raw, não o JSON re-serializado).
  verify: (req, _res, buf) => { if (req.path === "/webhooks/wipay") req.rawBody = buf; },
}));
app.use(rateLimit(200));

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Diagnóstico TEMPORÁRIO (remover após whitelist): IP público de saída do Render.
// Se a OVG bloquear por IP, este é o IP a autorizar no lado deles.
app.get("/api/v1/debug/egress-ip", requireAuth, async (_req, res) => {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    try {
      const r = await fetch("https://api.ipify.org?format=json", { signal: ctrl.signal });
      res.json(await r.json());
    } finally { clearTimeout(timer); }
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// ─── Diagnóstico /db-* REMOVIDO (segurança, Set/2026) ───────────────────────
// Expunha SELECT * de clientes/acessos/terminais e a lista de tabelas a
// qualquer visitante, sem login. Quem precisar de diagnóstico usa a BD
// (Neon) com credenciais próprias ou logs do Render. Mantém-se 410 Gone
// para não confundir com "rota inexistente".
for (const p of ["/api/v1/db-acessos", "/api/v1/db-clientes", "/api/v1/db-terminais", "/api/v1/db-tables"]) {
  app.get(p, (_req, res) => res.status(410).json({ error: "Diagnóstico removido por segurança" }));
}

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
// Webhook-created payments may arrive without a known customer
pool.query(`ALTER TABLE payments ALTER COLUMN customer_id DROP NOT NULL`).catch(() => {});
// Integração externa (ex.: Supabase/Fit 90): idempotência por external_id
pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS external_id varchar(100)`).catch(() => {});
pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS leads_external_id_idx ON leads (external_id) WHERE external_id IS NOT NULL`).catch(() => {});
// Seguimento de leads: histórico de contactos + campos da ficha
pool.query(`CREATE TABLE IF NOT EXISTS lead_contacts (
  id UUID PRIMARY KEY, lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES users(id) ON DELETE SET NULL, staff_name VARCHAR(255),
  canal VARCHAR(20) NOT NULL, resultado VARCHAR(50) NOT NULL,
  proximo_passo VARCHAR(50), proximo_contato DATE, observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`).catch(() => {});
pool.query(`CREATE INDEX IF NOT EXISTS lead_contacts_lead_idx ON lead_contacts (lead_id)`).catch(() => {});
pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(50)`).catch(() => {});
pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS produto_interesse VARCHAR(255)`).catch(() => {});
pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS proximo_contato DATE`).catch(() => {});
pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS motivo_perda VARCHAR(255)`).catch(() => {});
// Equipa: contador de acessos por utilizador (quem acedeu mais)
pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0`).catch(() => {});
// Leads da landing são permanentes — passam a viver no funil; sem cleanup.
// Settings table (definições do workspace)
pool.query(`CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
)`).catch(() => {});
// Códigos promocionais — mesmos tipos do schema drizzle (packages/db). As duas
// fontes têm de criar tabelas idênticas: se divergirem, o `drizzle-kit push` e o
// standalone brigam pela forma das colunas e os inserts falham.
const PROMO_TYPE_DDL = `DO $$
   BEGIN
     CREATE TYPE promo_type AS ENUM('percent','fixed');
   EXCEPTION WHEN duplicate_object THEN NULL;
   END $$`;

const PROMO_CODES_DDL = `CREATE TABLE IF NOT EXISTS promo_codes (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
     code varchar(50) NOT NULL UNIQUE,
     type promo_type NOT NULL DEFAULT 'percent',
     value integer NOT NULL,
     min_amount integer,
     max_discount integer,
     applies_to varchar(20) NOT NULL DEFAULT 'all',
     plan_ids jsonb,
     usage_limit integer,
     used_count integer NOT NULL DEFAULT 0,
     per_user boolean NOT NULL DEFAULT true,
     active boolean NOT NULL DEFAULT true,
     starts_at timestamp,
     expires_at timestamp,
     created_by uuid REFERENCES users(id),
     created_at timestamp NOT NULL DEFAULT now(),
     updated_at timestamp NOT NULL DEFAULT now()
   )`;

const PROMO_USAGES_DDL = `CREATE TABLE IF NOT EXISTS promo_usages (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
     promo_id uuid NOT NULL REFERENCES promo_codes(id) ON DELETE cascade,
     user_id uuid REFERENCES users(id),
     customer_id uuid REFERENCES customers(id),
     user_key varchar(255),
     email varchar(255),
     phone varchar(50),
     payment_code varchar(50),
     amount_before integer,
     amount_after integer,
     discount_applied integer,
     used_at timestamp NOT NULL DEFAULT now()
   )`;

const PROMO_DDL = [
  PROMO_TYPE_DDL,
  PROMO_CODES_DDL,
  PROMO_USAGES_DDL,
  // Tabelas criadas pela migração 0004 (sem user_key) — a coluna é obrigatória
  // para o limite de "um uso por utilizador".
  `ALTER TABLE promo_usages ADD COLUMN IF NOT EXISTS user_key varchar(255)`,
  `CREATE INDEX IF NOT EXISTS idx_promo_usages_promo_id ON promo_usages(promo_id)`,
  `CREATE INDEX IF NOT EXISTS idx_promo_usages_email_phone ON promo_usages(email, phone)`,
  `CREATE INDEX IF NOT EXISTS idx_promo_usages_user_key ON promo_usages(promo_id, user_key)`,
];

// Forma antiga (primeiro deploy): ids SERIAL/INT, created_by INT,
// customer_id TEXT e promo_usages sem user_id. Nessa forma a criação de códigos
// nunca chegou a funcionar — converte-se para uuid com md5 determinístico (o
// mesmo md5 dos dois lados mantém promo_usages.promo_id ligado a
// promo_codes.id). As colunas da forma antiga são lidas do information_schema:
// o que não existir vira NULL e só se guardam referências a users/customers que
// existem de facto, para nunca violar FKs.
async function repairLegacyPromoSchema() {
  const info = await pool.query(
    `SELECT table_name, column_name, data_type
       FROM information_schema.columns
      WHERE table_name IN ('promo_codes', 'promo_usages')`
  );
  if (!info.rows.length) return; // tabelas ainda não existem
  const dtype = (table, column) =>
    info.rows.find((r) => r.table_name === table && r.column_name === column)?.data_type;
  const isText = (t) => t === "text" || t === "character varying";
  const codesId = dtype("promo_codes", "id");
  const usagesId = dtype("promo_usages", "id");
  const codesLegacy = Boolean(codesId) && codesId !== "uuid";
  const usagesLegacy = Boolean(usagesId) && usagesId !== "uuid";
  if (!codesLegacy && !usagesLegacy) return;

  const UUID_RE = "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$";
  const idToUuid = (table, column) =>
    dtype(table, column) === "uuid" ? `l."${column}"` : `md5(l."${column}"::text)::uuid`;
  // users(id)/customers(id): só uuid que exista na tabela. Ids inteiros da
  // forma antiga não têm equivalente -> NULL (um md5 inventado violava a FK).
  const fkRef = (table, column, target) => {
    const t = dtype(table, column);
    if (t === "uuid") {
      return `CASE WHEN EXISTS (SELECT 1 FROM ${target} x WHERE x.id = l."${column}") THEN l."${column}" ELSE NULL END`;
    }
    if (isText(t)) {
      return `CASE WHEN l."${column}" ~* '${UUID_RE}' AND EXISTS (SELECT 1 FROM ${target} x WHERE x.id = l."${column}"::uuid) THEN l."${column}"::uuid ELSE NULL END`;
    }
    return `NULL::uuid`; // ausente, integer ou serial
  };
  const num = (table, column, fallback) =>
    dtype(table, column) ? `l."${column}"::integer` : fallback;
  const txt = (table, column, len, fallback) =>
    dtype(table, column) ? `LEFT(l."${column}"::text, ${len})` : fallback;
  const bool = (table, column, fallback) =>
    dtype(table, column) ? `l."${column}"::boolean` : fallback;
  const stamp = (table, column) =>
    dtype(table, column) ? `COALESCE(l."${column}", now())` : `now()`;

  const codesCols = [
    ["id", idToUuid("promo_codes", "id")],
    ["code", txt("promo_codes", "code", 50, "NULL")],
    ["type", (() => {
      const t = dtype("promo_codes", "type");
      if (isText(t)) return `CASE WHEN lower(l.type) IN ('percent','fixed') THEN lower(l.type)::promo_type ELSE 'percent'::promo_type END`;
      if (t) return `l.type::promo_type`; // já é o enum
      return `'percent'::promo_type`;
    })()],
    ["value", num("promo_codes", "value", "0")],
    ["min_amount", num("promo_codes", "min_amount", "NULL")],
    ["max_discount", num("promo_codes", "max_discount", "NULL")],
    ["applies_to", txt("promo_codes", "applies_to", 20, "'all'")],
    ["plan_ids", (() => {
      const t = dtype("promo_codes", "plan_ids");
      if (t === "jsonb") return `l.plan_ids`;
      if (isText(t)) return `CASE WHEN l.plan_ids ~ '^\\s*[\\[{]' THEN l.plan_ids::jsonb ELSE NULL END`;
      return `NULL`;
    })()],
    ["usage_limit", num("promo_codes", "usage_limit", "NULL")],
    ["used_count", num("promo_codes", "used_count", "0")],
    ["per_user", bool("promo_codes", "per_user", "true")],
    ["active", bool("promo_codes", "active", "true")],
    ["starts_at", dtype("promo_codes", "starts_at") ? `l.starts_at` : `NULL`],
    ["expires_at", dtype("promo_codes", "expires_at") ? `l.expires_at` : `NULL`],
    ["created_by", fkRef("promo_codes", "created_by", "users")],
    ["created_at", stamp("promo_codes", "created_at")],
    ["updated_at", stamp("promo_codes", "updated_at")],
  ];

  const usagesCols = [
    ["id", idToUuid("promo_usages", "id")],
    ["promo_id", idToUuid("promo_usages", "promo_id")],
    ["user_id", fkRef("promo_usages", "user_id", "users")],
    ["customer_id", fkRef("promo_usages", "customer_id", "customers")],
    ["user_key", txt("promo_usages", "user_key", 255, "NULL")],
    ["email", txt("promo_usages", "email", 255, "NULL")],
    ["phone", txt("promo_usages", "phone", 50, "NULL")],
    ["payment_code", txt("promo_usages", "payment_code", 50, "NULL")],
    ["amount_before", num("promo_usages", "amount_before", "NULL")],
    ["amount_after", num("promo_usages", "amount_after", "NULL")],
    ["discount_applied", num("promo_usages", "discount_applied", "NULL")],
    ["used_at", stamp("promo_usages", "used_at")],
  ];

  const insertFrom = (table, pairs, where) =>
    `INSERT INTO ${table} (${pairs.map(([c]) => `"${c}"`).join(", ")})
     SELECT ${pairs.map(([c, e]) => `${e} AS "${c}"`).join(", ")}
       FROM ${table}_legacy l${where ? `\n      WHERE ${where}` : ""}`;

  // Só usos de códigos que sobreviveram à conversão (IDs hórfãos ficam de fora).
  const promoRef = idToUuid("promo_usages", "promo_id");
  const usagesWhere = `l.promo_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM promo_codes c WHERE c.id = ${promoRef})`;

  console.log(
    "[PROMOS] a converter forma antiga para uuid:",
    [codesLegacy ? `promo_codes.id:${codesId}` : null, usagesLegacy ? `promo_usages.id:${usagesId}` : null]
      .filter(Boolean).join(", ")
  );

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (codesLegacy) {
      await client.query(`ALTER TABLE promo_codes RENAME TO promo_codes_legacy`);
      await client.query(PROMO_CODES_DDL);
      await client.query(insertFrom("promo_codes", codesCols));
    }
    if (usagesLegacy) {
      await client.query(`ALTER TABLE promo_usages RENAME TO promo_usages_legacy`);
      await client.query(PROMO_USAGES_DDL);
      await client.query(insertFrom("promo_usages", usagesCols, usagesWhere));
    }
    if (usagesLegacy) await client.query(`DROP TABLE IF EXISTS promo_usages_legacy`);
    if (codesLegacy) await client.query(`DROP TABLE IF EXISTS promo_codes_legacy`);
    await client.query("COMMIT");
    console.log("[PROMOS] conversão para uuid concluída");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

let promoSchemaReady = null;
function ensurePromoSchema() {
  if (!promoSchemaReady) {
    promoSchemaReady = (async () => {
      // O enum primeiro (a conversão e as tabelas usam-no) e a conversão antes
      // dos CREATE INDEX: os índices têm de nascer nas tabelas já novas.
      await pool.query(PROMO_TYPE_DDL);
      await repairLegacyPromoSchema();
      for (const stmt of PROMO_DDL.slice(1)) await pool.query(stmt);
    })().catch((err) => {
      console.error("[PROMOS] schema:", err.message);
      promoSchemaReady = null;
      throw err;
    });
  }
  return promoSchemaReady;
}
ensurePromoSchema().catch(() => {});

// ─── Settings ───────────────────────────────────────────────────────────────

// Chaves que nunca saem em claro pela API (devolve true/false = existe ou não)
const SECRET_RE = /secret|password|token|api[_-]?key/i;

// GET também é gestão: devolve a configuração (inclui chaves/segredos
// mascarados) e a mesma barreira de escrita já existente em PUT.
app.get("/api/v1/settings", requireAuth, requireManager, async (req, res) => {
  try {
    const r = await pool.query("SELECT key, value FROM settings WHERE key NOT LIKE 'password\\_reset\\_%' ESCAPE '\\'");
    const data = {};
    r.rows.forEach(row => {
      data[row.key] = SECRET_RE.test(row.key) ? !!row.value : row.value;
    });
    res.json({ data });
  } catch (err) {
    res.json({ data: {} });
  }
});

app.put("/api/v1/settings", rateLimit(40), requireAuth, requireManager, async (req, res) => {
  try {
    const settings = req.body?.settings || req.body || {};
    for (const [key, value] of Object.entries(settings)) {
      if (key.startsWith("password_reset_")) continue;
      // Segredo vazio = manter o guardado (nunca apagar por omissão)
      if (SECRET_RE.test(key) && (value === "" || value === null || value === undefined)) continue;
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
    // Auditoria com as CHAVES alteradas (nunca os valores — podem ser segredos).
    audit(req, "settings.updated", {
      actorId: req.user?.userId,
      entity: "settings",
      details: { chaves: Object.keys(settings).slice(0, 50) },
    });
    res.json({ message: "Definições guardadas" });
  } catch (err) {
    console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

// SEGURANÇA: só as máquinas do ginásio (X-API-Key). Antes aceitava qualquer
// POST da internet e escrevia acessos falsos.
app.post("/api/v1/access/sync", requireEdgeAuth, async (req, res) => {
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
    console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

// ─── OVG Sync: PC envia membros OVG ────────────────────────────────────────
// SEGURANÇA: só as máquinas do ginásio (X-API-Key).
app.post("/api/v1/access/ovg-sync", requireEdgeAuth, async (req, res) => {
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
    console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

// OVG Sync status (só staff logado)
app.get("/api/v1/access/ovg-status", requireAuth, async (req, res) => {
  try {
    const count = await pool.query("SELECT COUNT(*) as cnt FROM ovg_members");
    const last = await pool.query("SELECT MAX(synced_at) as last_sync FROM ovg_members");
    res.json({ total: parseInt(count.rows[0].cnt), lastSync: last.rows[0].last_sync });
  } catch (err) {
    console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
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
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" },
    body: JSON.stringify({ username: user, password: pass }),
  });
  const body = await resp.text();
  // SEGURANÇA: logs mínimos — nunca despejar corpo da resposta (pode ter tokens).
  if (!resp.ok) throw new Error(`OVG login failed: ${resp.status}`);
  const data = JSON.parse(body);
  const token = data.token || data.Token || data.access_token;
  if (!token) throw new Error("OVG: no token in response");
  return token;
}

async function ovgGetMembers(token) {
  const base = await cfg("ovg_api_url", OVG_API_URL);
  const club = await cfg("ovg_club_code", OVG_CLUB_CODE);
  const url = `${base}/ListOfCustomersDataDetailed/${club}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" },
  });
  const body = await resp.text();
  if (!resp.ok) throw new Error(`OVG members failed: ${resp.status}`);
  const data = JSON.parse(body);
  return data.clients_data || data.data?.clients_data || [];
}

app.post("/api/v1/access/ovg-reseed", requireAuth, requireManager, async (req, res) => {
  // On-demand (zona de Clientes no CRM): sem polling de fundo (cota Neon).
  // Aceita Bearer (login) ou X-API-Key (frontend/turnstile).
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
    console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

// Sync status endpoint (só staff logado)
app.get("/api/v1/access/sync-status", requireAuth, async (req, res) => {
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
    console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

// ─── Stats ──────────────────────────────────────────────────────────────────

// Quem ficou "preso" (online=true sem movimento hoje, ex. após a meia-noite)
// é marcado como fora. Só toca em quem NÃO tem movimentos hoje — seguro
// para correr em qualquer leitura.
async function midnightReset() {
  try {
    await pool.query(
      `UPDATE clientes SET online = false WHERE online = true AND id_cliente NOT IN (
         SELECT DISTINCT cliente_id FROM acessos WHERE data_acesso::date = CURRENT_DATE
       )`
    );
  } catch {}
}

// Quem está dentro AGORA: última movimentação de hoje é entrada
// (não usa a flag online, que dessincroniza quando passam sem picar)
async function countInsideNow() {
  try {
    const r = await pool.query(
      `SELECT COUNT(*) as cnt FROM (
         SELECT DISTINCT ON (a.cliente_id) a.cliente_id, a.tipo_acesso
         FROM acessos a JOIN clientes c ON a.cliente_id = c.id_cliente
         WHERE a.data_acesso::date = CURRENT_DATE
           AND ${isMember("c")} AND ${notDeleted("c")}
         ORDER BY a.cliente_id, a.id_acesso DESC
       ) t WHERE t.tipo_acesso = 'entrada'`
    );
    return parseInt(r.rows[0].cnt);
  } catch { return 0; }
}

app.post("/api/v1/access/midnight-reset", requireAuth, async (req, res) => {
  try {
    const r = await pool.query(
      `UPDATE clientes SET online = false WHERE online = true AND id_cliente NOT IN (
         SELECT DISTINCT cliente_id FROM acessos WHERE data_acesso::date = CURRENT_DATE
       )`
    );
    res.json({ ok: true, checkedOut: r.rowCount });
  } catch (err) {
    console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

app.get("/api/v1/access/stats", requireAuth, async (req, res) => {
  try {
    await midnightReset();
    const M = isMember("c");
    const ND = notDeleted("c");
    const E = "a.tipo_acesso = 'entrada'";
    const totalResult = await pool.query(`SELECT COUNT(*) as cnt FROM acessos a JOIN clientes c ON a.cliente_id = c.id_cliente WHERE ${M} AND ${ND} AND ${E}`);
    const todayResult = await pool.query(`SELECT COUNT(*) as cnt FROM acessos a JOIN clientes c ON a.cliente_id = c.id_cliente WHERE ${M} AND ${ND} AND ${E} AND a.data_acesso::date = CURRENT_DATE`);
    const authorizedToday = await pool.query(`SELECT COUNT(*) as cnt FROM acessos a JOIN clientes c ON a.cliente_id = c.id_cliente WHERE ${M} AND ${ND} AND ${E} AND a.data_acesso::date = CURRENT_DATE AND LOWER(a.resultado) = 'autorizado'`);
    const deniedToday = await pool.query(`SELECT COUNT(*) as cnt FROM acessos a JOIN clientes c ON a.cliente_id = c.id_cliente WHERE ${M} AND ${ND} AND ${E} AND a.data_acesso::date = CURRENT_DATE AND LOWER(a.resultado) != 'autorizado'`);
    const uniqueClients = await pool.query(`SELECT COUNT(DISTINCT a.cliente_id) as cnt FROM acessos a JOIN clientes c ON a.cliente_id = c.id_cliente WHERE ${M} AND ${ND} AND ${E}`);
    const insideNow = await countInsideNow();
    const onlineNow = insideNow;
    const recentAccesses = await pool.query(
      `SELECT a.id_acesso, a.cliente_id, c.nome as cliente_nome, a.data_acesso::text, a.hora_acesso,
              a.tipo_acesso, a.resultado, a.motivo
       FROM acessos a JOIN clientes c ON a.cliente_id = c.id_cliente
       WHERE ${M} AND ${ND}
       ORDER BY a.id_acesso DESC LIMIT 10`
    );

    res.json({
      data: {
        clients: { total: parseInt(uniqueClients.rows[0].cnt), active: insideNow, online: onlineNow, blocked: 0 },
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
    console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
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
    console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

// ─── Terminal Status ──────────────────────────────────────────────────────────

app.get("/api/v1/terminal/status", requireAuth, async (req, res) => {
  try {
    await midnightReset();
    const recentResult = await pool.query(
      "SELECT MAX(data_acesso || ' ' || hora_acesso) as last_sync FROM acessos"
    );
    const lastSync = recentResult.rows[0]?.last_sync;
    const isOnline = lastSync && (Date.now() - new Date(lastSync).getTime()) < 30 * 60 * 1000;

    const onlineClients = await countInsideNow();

    res.json({
      data: {
        nome_terminal: "Solve Access",
        online: isOnline,
        ip: "192.168.1.182",
        porta: 8080,
        modelo: "ZKTeco",
        tipo: "Entrada",
        lastSync: lastSync,
        onlineClients: onlineClients,
      },
    });
  } catch (err) {
    console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

// ─── Terminal Unlock ───────────────────────────────────────────────────────
// SEGURANÇA: só staff logado. Abre a catraca física — nunca público.
app.post("/api/v1/terminal/unlock", requireAuth, async (req, res) => {
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
      // SEGURANÇA: falha reportada como falha (antes dizia ok:true e enganava).
      res.status(502).json({ ok: false, error: "Catraca inalcançável. Verificar PC do ginásio." });
    }
  } catch (err) {
    console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

// ─── Clients ────────────────────────────────────────────────────────────────

app.get("/api/v1/access/clients", requireAuth, async (req, res) => {
  try {
    await midnightReset();
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
    console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

// ─── Customers (legacy endpoint for frontend compatibility) ─────────────────

app.get("/api/v1/customers", requireAuth, async (req, res) => {
  try {
    await midnightReset();
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
    // Fase Cademi-CRM: sem tabelas do ginásio -> lista da tabela CRM customers
    try {
      const fb = await pool.query(
        `SELECT c.id::text AS id, c.name,
          COALESCE(c.joined_at, c.created_at)::text AS "joinedAt",
          c.created_at::text AS "createdAt", c.updated_at::text AS "updatedAt",
          c.email, c.phone, c.gender, NULL AS "entryDate", c.nif, c.state,
          c.state AS client_status, false AS online, false AS bloqueado,
          CASE WHEN sl.t = 0 THEN NULL ELSE sl.t - sl.d END AS numero_entradas,
          CASE WHEN sl.t = 0 THEN NULL ELSE sl.t END AS limite_entradas,
          COALESCE(c.company,'') AS company, p.name AS "planName",
          s.end_date::text AS "subscriptionEnd", c.code,
          c.ovg_id AS "ovgId", c.cademi_id AS "cademiId", c.lead_id::text AS "leadId"
         FROM customers c
         LEFT JOIN LATERAL (SELECT * FROM subscriptions WHERE customer_id = c.id ORDER BY start_date DESC LIMIT 1) s ON true
         LEFT JOIN plans p ON p.id = s.plan_id
         LEFT JOIN LATERAL (SELECT COALESCE(SUM(lessons_total), 0) AS t, COALESCE(SUM(lessons_done), 0) AS d FROM subscriptions WHERE customer_id = c.id) sl ON true
         ORDER BY c.name ASC`
      );
      res.json({ data: fb.rows, total: fb.rows.length });
    } catch (e2) {
      console.error("[CUSTOMERS LIST] Error:", e2.message);
      res.status(500).json({ error: "Erro a ler clientes. Ver logs do servidor." });
    }
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
    // Fase Cademi-CRM: fallback à tabela CRM customers (uuid)
    try {
      const fb = await pool.query(
        `SELECT c.id::text AS id, c.name,
          COALESCE(c.joined_at, c.created_at)::text AS "joinedAt",
          c.email, c.phone, c.gender, NULL AS "entryDate", c.nif, c.state,
          c.state AS client_status, false AS online, false AS bloqueado,
          NULL AS numero_entradas, NULL AS limite_entradas,
          COALESCE(c.company,'') AS company
         FROM customers c WHERE c.id::text = $1 LIMIT 1`,
        [String(req.params.id)]
      );
      if (fb.rows.length === 0) return res.status(404).json({ error: "Cliente não encontrado" });
      res.json({ data: fb.rows[0] });
    } catch (e2) {
      console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
    }
  }
});

app.post("/api/v1/customers/import-dates", requireAuth, requireManager, async (req, res) => {
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
    console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

// ─── Auth: Login ────────────────────────────────────────────────────────────

app.post("/api/v1/auth/login", rateLimit(20), async (req, res) => {
  try {
    // SEGURANÇA: sem segredo não há sessão — mensagem clara em vez de 500 críptico.
    if (!JWT_SECRET) {
      console.error("[AUTH LOGIN] JWT_SECRET em falta no ambiente");
      return res.status(500).json({ error: "Servidor sem JWT_SECRET configurado. Ver docs/tecnica/10-SEGURANCA.md" });
    }
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
      // Custo de bcrypt equivalente ao de uma conta real, para não revelar pelo
      // tempo que o email não existe.
      await bcrypt.compare(password, await dummyPasswordHash());
      audit(req, "auth.login_failed", { details: { reason: "conta_desconhecida", email_hash: emailRef(email) } });
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    if (user.active === false) {
      audit(req, "auth.login_failed", { actorId: user.id, details: { reason: "conta_desactivada" } });
      return res.status(403).json({ error: "Conta desactivada" });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      audit(req, "auth.login_failed", { actorId: user.id, details: { reason: "password_incorrecta", email_hash: emailRef(email) } });
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    const payload = { userId: user.id, role: user.role, email: user.email, name: user.name, se: await getSessionEpoch(user.id) };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000,
      path: "/",
    });

    const csrfToken = issueCsrfToken();
    res.cookie(CSRF_COOKIE, csrfToken, csrfCookieOptions());

    await pool.query("UPDATE users SET last_login_at = NOW(), login_count = COALESCE(login_count, 0) + 1 WHERE id = $1", [user.id]);
    // Este handler não tem acesso ao indicador de meio de sessão (está dentro
    // de requireAuth): o login emite cookie httpOnly E devolve bearer.
    audit(req, "auth.login_ok", { actorId: user.id, details: { role: user.role, via: "senha" } });

    res.json({
      token,
      csrfToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error("[AUTH LOGIN] Error:", err.message);
    res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

// ─── Auth: Register ─────────────────────────────────────────────────────────

app.post("/api/v1/auth/register", rateLimit(20), async (req, res) => {
  try {
    if (!JWT_SECRET) {
      console.error("[AUTH REGISTER] JWT_SECRET em falta no ambiente");
      return res.status(500).json({ error: "Servidor sem JWT_SECRET configurado. Ver docs/tecnica/10-SEGURANCA.md" });
    }
    const { name, email, password, role, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Nome, email e password são obrigatórios" });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: "Password deve ter pelo menos 8 caracteres" });
    }
    // SEGURANÇA: auto-registo público nunca cria administrador/gestor.
    const PUBLIC_ROLES = ["comercial", "financeiro", "operacional"];
    const userRole = PUBLIC_ROLES.includes(role) ? role : "comercial";

    const existing = await pool.query("SELECT id FROM users WHERE LOWER(email) = LOWER($1)", [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Email já registado" });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await pool.query(
      "INSERT INTO users (name, email, password_hash, role, phone) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role",
      [name, email, passwordHash, userRole, phone || null]
    );
    const user = result.rows[0];

    const payload = { userId: user.id, role: user.role, email: user.email, name: user.name, se: await getSessionEpoch(user.id) };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.status(201).json({ token, user });
  } catch (err) {
    console.error("[AUTH REGISTER] Error:", err.message);
    res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

// ─── Auth: Logout ───────────────────────────────────────────────────────────

app.post("/api/v1/auth/logout", (_req, res) => {
  res.clearCookie("token", {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
  res.clearCookie(CSRF_COOKIE, { ...csrfCookieOptions(), maxAge: undefined });
  res.json({ message: "Sessão terminada" });
});

// ─── Auth: Forgot Password ──────────────────────────────────────────────────

app.post("/api/v1/auth/forgot-password",
  rateLimit(20),
  // 5 pedidos por conta por 15 min: trava a inundação de "esqueci-me a senha"
  // vinda de vários IPs sem bloquear quem precisa de recuperar-se depressa.
  rateLimitBy(5, 15 * 60 * 1000, (req) => String(req.body?.email || "").trim().toLowerCase() || null,
    "Demasiados pedidos de recuperação para esta conta. Tente dentro de alguns minutos."),
  async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email é obrigatório" });

    const result = await pool.query("SELECT id FROM users WHERE LOWER(email) = LOWER($1)", [email]);
    if (result.rows.length > 0) {
      const user = result.rows[0];
      const resetToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      // Só a hash do token vai para a BD: um dump/leak de `settings` não dá
      // acesso a nenhuma conta enquanto o link estiver vivo.
      await pool.query(
        `INSERT INTO settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [`password_reset_${user.id}`, JSON.stringify({ tokenHash: hashResetToken(resetToken), expiresAt: expiresAt.toISOString() })]
      );
// SEGURANÇA: token nunca vai para logs. Em produção enviar por email
        // (fornecedor SMTP); o link expira em 1h e é de uso único.
        // O email também não é registado: a linha em `settings` identifica o
        // pedido sem expor dados pessoais nos logs.
        audit(req, "auth.password_reset_requested", { actorId: user.id, details: { email_hash: emailRef(email) } });
        if (process.env.NODE_ENV !== "production") {
          console.log(`[PASSWORD RESET] pedido registado (chave ${`password_reset_${user.id}`.slice(0, 25)}..., ver BD local)`);
        }
    }

    res.json({ message: "Se o email existir, receberá um link de recuperação" });
  } catch (err) {
    console.error("[AUTH FORGOT] Error:", err.message);
    console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

// ─── Auth: Reset Password ───────────────────────────────────────────────────

function hashResetToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

app.post("/api/v1/auth/reset-password", rateLimit(20), async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: "Token e password são obrigatórios" });
    // VULN-17: password mínima também no reset.
    if (String(password).length < 8) {
      return res.status(400).json({ error: "Password deve ter pelo menos 8 caracteres" });
    }

    const presented = hashResetToken(token);
    const result = await pool.query("SELECT key, value FROM settings WHERE key LIKE 'password_reset_%'");
    let resetEntry = null;
    for (const row of result.rows) {
      try {
        const data = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
        // `tokenHash` é o caminho normal; a comparação com `token` em texto
        // claro só serve para pedidos pendentes criados antes do endurecimento.
        const bate = data?.tokenHash
          ? data.tokenHash === presented
          : typeof data?.token === "string" && hashResetToken(data.token) === presented;
        if (bate) { resetEntry = { key: row.key, data }; break; }
      } catch {}
    }

    if (!resetEntry) return res.status(400).json({ error: "Token inválido ou expirado" });
    if (new Date(resetEntry.data.expiresAt) < new Date()) return res.status(400).json({ error: "Token inválido ou expirado" });

    const userId = resetEntry.key.replace("password_reset_", "");
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await pool.query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [passwordHash, userId]);
    await pool.query("DELETE FROM settings WHERE key = $1", [resetEntry.key]);
    // Todas as sessões abertas (JWTs já emitidos) deixam de valer: quem roubar
    // um token antes da troca perde o acesso assim que o pedido é concluído.
    await rotateSessionEpoch(userId);
    audit(req, "auth.password_changed", { actorId: userId, details: { sessoes_revogadas: true } });

    res.json({ message: "Password atualizada com sucesso" });
  } catch (err) {
    console.error("[AUTH RESET] Error:", err.message);
    console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

// ─── SSE: Payment Updates ────────────────────────────────────────────────────

const paymentSSEClients = new Set();

app.get("/api/v1/payments/stream", requireAuth, (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
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
// SEGURANÇA (Set/2026): um callback HTTP nunca é confiável sozinho.
//  1. valida formato (400 em lixo); 2. nunca CRIA pagamentos;
//  3. só muda estado com confirmação server-side (consulta GPO à É-kwanza);
//     sem confirmação, regista em metadata e mantém "pendente".
app.post("/webhooks/ekwanza", rateLimit(60), async (req, res) => {
  try {
    const body = req.body || {};

    const merchantTransactionId =
      body.merchantTransactionId ?? body.merchant_transaction_id ?? body.code ?? body.reference ?? null;
    const ekwanzaTransactionId =
      body.ekwanzaTransactionId ?? body.ekwanza_transaction_id ?? body.transactionId ?? null;
    const operationStatus = body.operationStatus ?? body.operation_status ?? null;
    const operationData = body.operationData ?? body.data ?? null;

    if (typeof merchantTransactionId !== "string" || !merchantTransactionId || merchantTransactionId.length > 100) {
      return res.status(400).json({ error: "Callback inválido" });
    }
    const statusMap = { 1: "confirmado", 3: "rejeitado", 4: "rejeitado", 5: "rejeitado" };
    if (!Object.hasOwn(statusMap, Number(operationStatus))) {
      console.log(`[EKWANZA-WEBHOOK] status desconhecido para ${merchantTransactionId} — ignorado`);
      return res.status(400).json({ error: "Callback inválido" });
    }

    const cur = await pool.query("SELECT id, status, amount, metadata FROM payments WHERE code = $1", [merchantTransactionId]);
    if (cur.rows.length === 0) {
      // Nunca criar pagamento por callback — responde ok sem enumerar.
      audit(req, "payment.webhook_unknown_code", { details: { provedor: "ekwanza" } });
      return res.json({ received: true });
    }
    const payment = cur.rows[0];
    const meta = typeof payment.metadata === "string"
      ? JSON.parse(payment.metadata || "{}") : (payment.metadata || {});
    if (meta.cancelled_by_user) {
      return res.json({ received: true, ignored: true });
    }
    if (operationData?.amount != null && Number(operationData.amount) !== Number(payment.amount)) {
      meta.ekwanza_unverified_callback = { reason: "amount_mismatch", at: new Date().toISOString() };
      audit(req, "payment.webhook_unverified", { entity: "payment", entityId: payment.id, details: { provedor: "ekwanza", motivo: "amount_mismatch" } });
      await pool.query("UPDATE payments SET metadata = $1, updated_at = NOW() WHERE id = $2", [JSON.stringify(meta), payment.id]);
      return res.json({ received: true, verified: false });
    }

    // Confirmação autoritativa junto da É-kwanza (fonte da verdade).
    let authoritativeSuccess = null;
    try {
      const token = await getEkwanzaToken();
      const gpoUrl = (await cfg("ekwanza_gpo_url", process.env.EKWANZA_GPO_URL || "https://gwy-api.appypay.co.ao/v2.0")).replace(/\/$/, "");
      const cr = await fetch(`${gpoUrl}/charges?merchantTransactionId=${encodeURIComponent(merchantTransactionId)}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "User-Agent": "Mozilla/5.0" },
      });
      if (cr.ok) {
        const cj = await cr.json().catch(() => null);
        const ch = cj?.payments?.[0];
        if (ch?.status) authoritativeSuccess = String(ch.status).toLowerCase() === "success";
      }
    } catch (e) {
      console.log(`[EKWANZA-WEBHOOK] confirmação falhou para ${merchantTransactionId}: ${e.message}`);
    }

    if (authoritativeSuccess === null) {
      meta.ekwanza_unverified_callback = { reason: "no_authoritative_confirmation", at: new Date().toISOString() };
      audit(req, "payment.webhook_unverified", { entity: "payment", entityId: payment.id, details: { provedor: "ekwanza", motivo: "sem_confirmacao_oficial" } });
      await pool.query("UPDATE payments SET metadata = $1, updated_at = NOW() WHERE id = $2", [JSON.stringify(meta), payment.id]);
      return res.json({ received: true, verified: false });
    }

    // A API oficial é a fonte da verdade. Um callback que pede "confirmado" quando a
    // É-kwanza responde que a carga NÃO teve sucesso nunca pode marcar o pagamento como
    // pago: registamos a divergência e deixamos o pagamento por resolver (novo callback
    // ou reconciliação manual) em vez de forjar um estado que o provedor não confirmou.
    if (!authoritativeSuccess && Number(operationStatus) === 1) {
      meta.ekwanza_unverified_callback = {
        reason: "confirmed_callback_without_authoritative_confirmation",
        operation_status: Number(operationStatus),
        at: new Date().toISOString(),
      };
      await pool.query("UPDATE payments SET metadata = $1, updated_at = NOW() WHERE id = $2", [JSON.stringify(meta), payment.id]);
      console.log(`[EKWANZA-WEBHOOK] divergência (callback=confirmado, oficial=não-sucedido) para ${merchantTransactionId} — pagamento mantido por resolver`);
      audit(req, "payment.webhook_unverified", { entity: "payment", entityId: payment.id, details: { provedor: "ekwanza", motivo: "confirmado_sem_confirmacao_oficial", operation_status: Number(operationStatus) } });
      return res.json({ received: true, verified: false });
    }

    // Só a confirmação oficial produz "confirmado". Tudo o que a É-kwanza recusou é
    // "rejeitado" — o operationStatus do callback nunca escolhe o estado final.
    const mappedStatus = authoritativeSuccess ? "confirmado" : "rejeitado";
    if (mappedStatus === "confirmado") {
      await pool.query(
        `UPDATE payments SET status = 'confirmado', ekwanza_operation_code = $1, paid_at = NOW(), reconciled_at = NOW(), updated_at = NOW() WHERE code = $2`,
        [ekwanzaTransactionId || null, merchantTransactionId]
      );
    } else {
      await pool.query(
        `UPDATE payments SET status = $1, ekwanza_operation_code = $2, updated_at = NOW() WHERE code = $3`,
        [mappedStatus, ekwanzaTransactionId || null, merchantTransactionId]
      );
    }
    broadcastPaymentUpdate({ type: "payment_updated", code: merchantTransactionId, status: mappedStatus });
    if (mappedStatus === "confirmado") setImmediate(() => sendCademiDelivery(merchantTransactionId));

    res.json({ received: true, verified: true });
  } catch (err) {
    console.error("[EKWANZA-WEBHOOK] Erro:", err.message);
    console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
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

// ─── WiPay (gateway novo; fluxo 100% hospedado) ─────────────────────────────
// Docs: https://developer.wipay.ao/ — token scope=payment (1h) / scope=signature
// (24h, chave HMAC dos callbacks). Criar pagamento devolve 303 com a página
// hospedada (location); o cliente escolhe o método e paga lá.
const WIPAY_HOST = "https://api.wipay.ao";
const _wipayTok = {};
async function getWipayToken(scope) {
  const c = _wipayTok[scope];
  if (c && Date.now() < c.exp) return c.tok;
  const cid = String(await cfg("wipay_client_id", process.env.WIPAY_CLIENT_ID || "")).trim();
  const sec = String(await cfg("wipay_client_secret", process.env.WIPAY_CLIENT_SECRET || "")).trim();
  if (!cid || !sec) throw new Error("WiPay por configurar (wipay_client_id/secret)");
  const r = await fetch(`${WIPAY_HOST}/v1/credentials/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ grant_type: "client_credentials", client_id: cid, client_secret: sec, scope }),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.access_token) throw new Error(`WiPay token falhou: ${r.status}`);
  _wipayTok[scope] = { tok: j.access_token, exp: Date.now() + ((j.expires_in || 3600) - 120) * 1000 };
  return _wipayTok[scope].tok;
}
async function wipayReady() {
  try { await getWipayToken("payment"); return true; }
  catch { return false; }
}
function wipayBase() {
  return (process.env.FRONTEND_URL || "https://solve-sqoh.onrender.com").replace(/\/$/, "");
}
// Estado WiPay -> interno. accepted=confirmado; falhas explicitas=rejeitado;
// resto (requested/...) mantem pendente.
function mapWipayStatus(s) {
  const v = String(s || "").toLowerCase();
  if (["accepted", "success", "successful", "paid", "completed"].includes(v)) return "confirmado";
  if (["rejected", "failed", "fail", "cancelled", "canceled", "expired", "error"].includes(v)) return "rejeitado";
  return null;
}
async function applyWipayConfirm(code, wipayId) {
  const tok = await getWipayToken("payment");
  const r = await fetch(`${WIPAY_HOST}/v1/hosts/payments/${encodeURIComponent(wipayId)}`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${tok}` },
  });
  if (!r.ok) return null;
  const j = await r.json().catch(() => null);
  const mapped = mapWipayStatus(j?.status);
  if (!mapped) return j?.status || null;
  if (mapped === "confirmado") {
    await pool.query("UPDATE payments SET status='confirmado', paid_at=NOW(), reconciled_at=NOW(), updated_at=NOW() WHERE code=$1 AND status='pendente'", [code]);
  } else {
    await pool.query("UPDATE payments SET status='rejeitado', updated_at=NOW() WHERE code=$1 AND status='pendente'", [code]);
  }
  broadcastPaymentUpdate({ type: "payment_updated", code, status: mapped });
  console.log(`[WIPAY] ${code}: pendente -> ${mapped} (status: ${j?.status})`);
  if (mapped === "confirmado") setImmediate(() => sendCademiDelivery(code));
  return mapped;
}
// ─── return_url: allowlist de origens (anti open-redirect) ──────────────────
// O return_url do checkout vira success_url/failure_url na WiPay: depois de
// pagar, o aluno é redirecionado para lá. Sem validação, qualquer endpoint
// público permitia escolher um destino arbitrário (open redirect + phishing
// logo após um pagamento genuine).
// Só aceitamos origens explicitamente autorizadas. As origens da própria
// aplicação entram sozinhas; a origem da página do Cademi onde o widget vive
// tem de ser declarada em RETURN_URL_ALLOWED_ORIGINS pelo operador.
// Se a origem não estiver na lista, ignoramos o return_url: a WiPay usa a
// página de retorno por omissão e o pagamento continua a concluir-se — não
// se perde dinheiro, só deixa de haver redireccionamento para a origem pedida.
const RETURN_URL_MAX = 300;
let _returnUrlAviso = false;
function origensPermitidasReturnUrl() {
  const bruto = [
    process.env.RETURN_URL_ALLOWED_ORIGINS,
    process.env.FRONTEND_URL,
    process.env.CORS_ORIGIN,
    process.env.APP_URL,
    process.env.RENDER_EXTERNAL_URL,
  ].filter(Boolean).join(",");
  const set = new Set();
  for (const parte of bruto.split(/[,\s]+/)) {
    const p = parte.trim();
    if (!p) continue;
    try { set.add(new URL(p).origin.toLowerCase()); } catch { /* entrada inválida: ignorada */ }
  }
  if (!set.size && !_returnUrlAviso) {
    _returnUrlAviso = true;
    console.warn("[PAYMENTS] sem origens de return_url autorizadas: return_url sera sempre ignorado (defeito por omissão seguro). Defina RETURN_URL_ALLOWED_ORIGINS para repor o redireccionamento apos pagamento.");
  }
  return set;
}
function sanitizarReturnUrl(valor) {
  if (typeof valor !== "string" || !valor.trim()) return null;
  const candidatas = origensPermitidasReturnUrl();
  if (!candidatas.size) return null;
  let u;
  try { u = new URL(valor.trim()); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (!candidatas.has(u.origin.toLowerCase())) return null;
  const s = u.href;
  return s.length > RETURN_URL_MAX ? null : s;
}
// Cria pagamento WiPay e guarda id + URL hospedada nos metadata.
// return_url (opcional, ex. página Cademi onde o widget vive): a WiPay
// redireciona para lá após sucesso/falha. Sem ele, fica na página WiPay
// (evita arrastar o aluno para o CRM em caso de erro).
async function fireWipayCharge({ code, amt, customer_phone, description, return_url }) {
  try {
    const tok = await getWipayToken("payment");
    const phone = String(customer_phone || "").replace(/\D/g, "");
    const base = wipayBase();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 45000);
    let loc = null;
    try {
      const resp = await fetch(`${WIPAY_HOST}/v1/hosts/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${tok}` },
        body: JSON.stringify({
          amount: Number(amt).toFixed(2), currency: "aoa",
          customer: phone, reference_id: code,
          ...(return_url ? { success_url: return_url, failure_url: return_url } : {}),
          callback_url: `${base}/webhooks/wipay`,
        }),
        signal: ctrl.signal,
        redirect: "manual",
      });
      loc = resp.headers.get("location");
      if (resp.status !== 303 || !loc) {
        const txt = await resp.text().catch(() => "");
        throw new Error(`WiPay criar falhou: ${resp.status} ${txt.slice(0, 150)}`);
      }
    } finally { clearTimeout(timer); }
    const wid = (loc.match(/[?&]id=([^&]+)/) || [])[1] || null;
    const cur = await pool.query("SELECT metadata FROM payments WHERE code = $1", [code]);
    let meta = {};
    try {
      const cm = cur.rows[0]?.metadata;
      meta = typeof cm === "string" ? JSON.parse(cm) : (cm || {});
    } catch {}
    meta.wipay_id = wid;
    meta.hosted_url = loc;
    meta.phone = phone || meta.phone || null;
    meta.description = description || meta.description || null;
    delete meta.ekwanza_error;
    await pool.query("UPDATE payments SET metadata = $1 WHERE code = $2", [JSON.stringify(meta), code]);
    broadcastPaymentUpdate({ type: "payment_updated", code, status: "pendente", hosted_url: loc });
    console.log(`[WIPAY] ${code}: pagamento ${wid} -> ${loc.slice(0, 60)}...`);
    return { ok: true, id: wid, hosted_url: loc };
  } catch (e) {
    console.error(`[WIPAY] ${code}:`, e.message);
    try {
      const cur = await pool.query("SELECT metadata FROM payments WHERE code = $1", [code]);
      let meta = {};
      try {
        const cm = cur.rows[0]?.metadata;
        meta = typeof cm === "string" ? JSON.parse(cm) : (cm || {});
      } catch {}
      meta.ekwanza_error = String(e.message).slice(0, 300);
      meta.ekwanza_error_at = new Date().toISOString();
      await pool.query("UPDATE payments SET metadata = $1 WHERE code = $2", [JSON.stringify(meta), code]);
    } catch {}
    return { ok: false, error: e.message };
  }
}

// Webhook WiPay: confirmação autoritativa via GET (igual ao padrão É-kwanza).
// A assinatura HMAC (chave = token scope=signature) é verificada quando o
// header `signature` vem; sem ele, confirma-se na mesma pelo estado oficial.
app.post("/webhooks/wipay", rateLimit(60), async (req, res) => {
  try {
    const { id, reference_id, status } = req.body || {};
    if (!reference_id && !id) return res.json({ received: true, verified: false });
    const prow = await pool.query(
      "SELECT code, metadata FROM payments WHERE code = $1 OR metadata->>'wipay_id' = $2 LIMIT 1",
      [reference_id || null, id || null]
    );
    if (!prow.rows.length) return res.json({ received: true, verified: false });
    const code = prow.rows[0].code;
    let meta = {};
    try {
      const cm = prow.rows[0].metadata;
      meta = typeof cm === "string" ? JSON.parse(cm) : (cm || {});
    } catch {}
    const wid = meta.wipay_id || id;
    if (!wid) return res.json({ received: true, verified: false });
    try {
      const signKey = await getWipayToken("signature");
      const sig = req.headers["signature"];
      if (sig && req.rawBody) {
        const h = crypto.createHmac("sha256", signKey).update(req.rawBody).digest("hex");
        if (h !== String(sig)) console.log(`[WIPAY-WEBHOOK] ${code}: assinatura divergente (segue p/ confirmação oficial)`);
        else console.log(`[WIPAY-WEBHOOK] ${code}: assinatura OK`);
      }
    } catch {}
    const mapped = await applyWipayConfirm(code, wid);
    return res.json({ received: true, verified: !!mapped, status: mapped || status || null });
  } catch (err) {
    console.error("[WIPAY-WEBHOOK] Erro:", err.message);
    res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

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
       ${whereClause} ORDER BY p.created_at DESC, p.id DESC LIMIT 200`, params
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
    console.error("[PAYMENTS LIST] Error:", err.message);
    res.status(500).json({ error: "Erro a ler pagamentos. Ver logs do servidor." });
  }
});

// Histórico do aluno (widget Cademi): por email e/ou telefone.
// PÚBLICO (widget corre sem JWT): a posse prova-se pelo email/telefone que o
// aluno acabou de escrever + rate-limit por IP e por conta.
//
// SEGURANÇA: só se devolve o que o widget consome de facto (code, status,
// amount, method, reference_code, entity, produto, hosted_url). Ficam de fora o
// código da transacção no É-kwanza e as datas — dados que o browser do aluno
// nunca usa e que, num endpoint público, só servem para alimentar recolha de
// dados de outros clientes.
app.get("/api/v1/payments/minha-historico", studentLookupLimit(), async (req, res) => {
  try {
    const email = String(req.query.email || "").toLowerCase().trim();
    const digits = String(req.query.phone || "").replace(/\D/g, "").slice(-9);
    if (!email && !digits) return res.status(400).json({ error: "email ou phone obrigatório" });
    const conds = [], params = [];
    if (email) { conds.push(`LOWER(COALESCE(p.metadata->>'email','')) = $${params.length + 1}`); params.push(email); }
    if (digits) { conds.push(`RIGHT(REGEXP_REPLACE(COALESCE(p.metadata->>'phone',''), '[^0-9]', '', 'g'), 9) = $${params.length + 1}`); params.push(digits); }
    const r = await pool.query(
      `SELECT p.code, p.amount, p.method, p.status, p.reference_code, p.entity,
              p.metadata->>'cademi_produto' AS cademi_produto, p.metadata->>'hosted_url' AS hosted_url
       FROM payments p WHERE (${conds.join(" OR ")}) ORDER BY p.created_at DESC LIMIT 20`, params);
    // e-mail só como hash: permite ver quem foi consultado sem guardar o endereço.
    audit(req, "student.history_viewed", {
      entity: "payment", entityId: null,
      details: { email_hash: emailRef(email), por_telefone: !email, resultados: r.rows.length },
    });
    res.json({ data: r.rows });
  } catch (err) {
    console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

// Cancelar pagamento pendente (aluno). Só o próprio (confere email/telefone).
// PÚBLICO (widget sem JWT): a posse prova-se pelo email/telefone do metadata + rate-limit.
app.post("/api/v1/payments/:code/cancel", rateLimit(30), async (req, res) => {
  try {
    const code = String(req.params.code);
    const email = String(req.body?.email || "").toLowerCase().trim();
    const digits = String(req.body?.phone || "").replace(/\D/g, "").slice(-9);
    const pr = await pool.query("SELECT * FROM payments WHERE code = $1", [code]);
    if (pr.rows.length === 0) return res.status(404).json({ error: "Pagamento não encontrado" });
    const payment = pr.rows[0];
    if (payment.status !== "pendente") return res.status(400).json({ error: `Só pendentes (estado: ${payment.status})` });
    let meta = {};
    try { meta = typeof payment.metadata === "string" ? JSON.parse(payment.metadata) : (payment.metadata || {}); } catch {}
    const metaEmail = String(meta.email || "").toLowerCase();
    const metaDigits = String(meta.phone || "").replace(/\D/g, "").slice(-9);
    const mine = (email && metaEmail && email === metaEmail) || (digits && metaDigits && digits === metaDigits);
    if (!mine) return res.status(403).json({ error: "Não é o teu pagamento" });
    meta.cancelled_by_user = true;
    meta.cancelled_at = new Date().toISOString();
    await pool.query("UPDATE payments SET status = 'rejeitado', metadata = $1, updated_at = NOW() WHERE code = $2 AND status = 'pendente'",
      [JSON.stringify(meta), code]);
    broadcastPaymentUpdate({ type: "payment_updated", code, status: "rejeitado" });
    console.log(`[PAYMENTS] ${code}: cancelado pelo aluno`);
    res.json({ ok: true, code });
  } catch (err) {
    console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

// Tem acesso ativo a este conteúdo? (trava pagar duas vezes — widget e CRM)
async function cademiActiveAccess(email, produtoSlug) {
  try {
    if (!email || !produtoSlug) return null;
    const u = await cademiFetch("/usuario?usuario_email_id_doc=" + encodeURIComponent(email));
    const users = u.data?.usuario || [];
    const found = users.find(x => String(x.email || "").toLowerCase() === String(email).toLowerCase());
    if (!found?.id) return null;
    const a = await cademiFetch(`/usuario/acesso/${encodeURIComponent(found.id)}`);
    const now = Date.now();
    for (const ac of (a.data?.acesso || [])) {
      const pn = String(ac.produto?.nome || "").toLowerCase().trim();
      const slug = slugify(ac.produto?.nome || "");
      if (!pn) continue;
      // Igualdade estrita: "teste" NÃO bloqueia "teste2".
      if (slug !== produtoSlug && pn !== produtoSlug) continue;
      const fim = ac.encerra_em ? new Date(ac.encerra_em).getTime() : null;
      const active = !ac.encerrado && (ac.duracao_tipo === "vitalicio" || !fim || fim > now);
      if (active) return ac.produto?.nome || produtoSlug;
    }
  } catch {}
  return null;
}

// Estado do acesso a um conteúdo: 'active' | 'expired' | 'none' | 'unknown'.
// 'unknown' = Cademi inacessível ou aluno fora da 1ª página da busca (a busca
// /usuario não filtra por email) → fail-open: nunca bloqueia venda por dúvida.
async function cademiAccessState(email, produtoSlug) {
  try {
    if (!email || !produtoSlug) return 'unknown';
    const sl = String(produtoSlug).trim();
    const u = await cademiFetch("/usuario?usuario_email_id_doc=" + encodeURIComponent(email));
    const users = u.data?.usuario || [];
    const found = users.find(x => String(x.email || "").toLowerCase() === String(email).toLowerCase());
    if (!found?.id) return 'unknown';
    const a = await cademiFetch(`/usuario/acesso/${encodeURIComponent(found.id)}`);
    let seen = false;
    const now = Date.now();
    for (const ac of (a.data?.acesso || [])) {
      const pn = String(ac.produto?.nome || "").toLowerCase().trim();
      const slug = slugify(ac.produto?.nome || "");
      if (!pn) continue;
      if (slug !== sl && pn !== sl.toLowerCase()) continue;
      seen = true;
      const fim = ac.encerra_em ? new Date(ac.encerra_em).getTime() : null;
      if (!ac.encerrado && (ac.duracao_tipo === "vitalicio" || !fim || fim > now)) return 'active';
    }
    return seen ? 'expired' : 'none';
  } catch { return 'unknown'; }
}

// Normaliza telefone AO: tira espaços, +, 00 e prefixo 244 → 9XXXXXXXX.
function normPhone(p) {
  let d = String(p || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("244") && d.length > 9) d = d.slice(3);
  return d;
}

// ─── Códigos promocionais ───────────────────────────────────────────────────
// Chave de identidade do utilizador (email > telefone normalizado).
function promoUserKey({ email, phone } = {}) {
  const e = String(email || "").trim().toLowerCase();
  if (e) return e;
  const p = normPhone(phone);
  if (p) return p;
  return null;
}

// Calcula desconto/valor final. type: "percent" | "fixed".
function computePromoDiscount({ base, promo } = {}) {
  const amount = Number(base);
  const out = { discount: 0, final: amount };
  if (!promo || !Number.isFinite(amount) || amount <= 0) return out;
  const value = Number(promo.value);
  if (!Number.isFinite(value) || value < 0) return out;
  let discount = String(promo.type).toLowerCase() === "fixed"
    ? value
    : Math.floor((amount * value) / 100);
  if (discount > amount) discount = amount;
  if (discount < 0) discount = 0;
  out.discount = discount;
  out.final = amount - discount;
  return out;
}

// Valida um código promocional para um contexto de compra.
// Devolve { valid, reason?, promo?, discount?, original?, final? }.
async function validatePromo({ code, base, email, phone, cademiProduto, planIds } = {}) {
  const normalized = String(code || "").trim().toUpperCase();
  if (!normalized) return { valid: false, reason: "Código em branco" };
  try {
    const found = await pool.query("SELECT * FROM promo_codes WHERE UPPER(code) = $1", [normalized]);
    const promo = found.rows[0];
    if (!promo) return { valid: false, reason: "Código inexistente" };
    if (!promo.active) return { valid: false, reason: "Código inativo" };
    const now = Date.now();
    if (promo.starts_at && now < new Date(promo.starts_at).getTime()) {
      return { valid: false, reason: "Código ainda não é válido" };
    }
    if (promo.expires_at && now > new Date(promo.expires_at).getTime()) {
      return { valid: false, reason: "Código expirado" };
    }
    const amount = Number(base);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { valid: false, reason: "Valor inválido" };
    }
    if (promo.min_amount != null && amount < Number(promo.min_amount)) {
      return { valid: false, reason: `Compra mínima de ${promo.min_amount} Kz` };
    }
    // Âmbito
    const appliesTo = String(promo.applies_to || "all").toLowerCase();
    if (appliesTo !== "all") {
      let list = promo.plan_ids;
      if (typeof list === "string") { try { list = JSON.parse(list); } catch { list = []; } }
      const allowed = Array.isArray(list) ? list.map(String) : [];
      const ctx = [cademiProduto, ...(Array.isArray(planIds) ? planIds : planIds ? [planIds] : [])]
        .filter(Boolean).map(String);
      if (!ctx.some((c) => allowed.includes(c))) {
        return { valid: false, reason: "Código não aplicável a este item" };
      }
    }
    const key = promoUserKey({ email, phone });
    // Uso único por utilizador (conta apenas pagamentos não falhados)
    if (promo.per_user && key) {
      const used = await pool.query(
        `SELECT 1 FROM promo_usages u
           JOIN payments p ON p.code = u.payment_code
          WHERE u.promo_id = $1 AND u.user_key = $2
            AND p.status NOT IN ('rejeitado','expirado','cancelado')
          LIMIT 1`,
        [promo.id, key]
      );
      if (used.rows.length) return { valid: false, reason: "Já utilizou este código" };
    }
    // Limite global
    if (promo.usage_limit != null) {
      const cnt = await pool.query(
        `SELECT COUNT(*)::int AS n FROM promo_usages u
           JOIN payments p ON p.code = u.payment_code
          WHERE u.promo_id = $1
            AND p.status NOT IN ('rejeitado','expirado','cancelado')`,
        [promo.id]
      );
      if ((cnt.rows[0]?.n || 0) >= Number(promo.usage_limit)) {
        return { valid: false, reason: "Código esgotado" };
      }
    }
    const { discount, final } = computePromoDiscount({ base: amount, promo });
    if (promo.max_discount != null && discount > Number(promo.max_discount)) {
      const capped = Number(promo.max_discount);
      return { valid: true, promo, discount: capped, original: amount, final: amount - capped };
    }
    return { valid: true, promo, discount, original: amount, final };
  } catch (e) {
    return { valid: false, reason: "Erro ao validar código" };
  }
}

// Grava o erro É-kwanza nos metadados (visível para diagnóstico, sem bloquear).
async function saveEkwanzaError(code, msg) {
  try {
    const cur = await pool.query("SELECT metadata FROM payments WHERE code = $1", [code]);
    let meta = {};
    try {
      const cm = cur.rows[0]?.metadata;
      meta = typeof cm === "string" ? JSON.parse(cm) : (cm || {});
    } catch {}
    meta.ekwanza_error = String(msg).slice(0, 300);
    meta.ekwanza_error_at = new Date().toISOString();
    await pool.query("UPDATE payments SET metadata = $1 WHERE code = $2", [JSON.stringify(meta), code]);
  } catch {}
}

// Dispara cobrança (GPO_) ou referência (REF_) na É-kwanza. Reutilizado pelo
// POST /payments (background) e pelo check-status (regenerar referência).
async function fireEkwanzaCharge({ code, paymentId, amt, m, customer_phone, description }) {
  const isRef = m === "referencia";
  const methodKey = isRef ? "ekwanza_ref_payment_method" : "ekwanza_gpo_payment_method";
  const methodEnv = isRef ? process.env.EKWANZA_REF_PAYMENT_METHOD : process.env.EKWANZA_GPO_PAYMENT_METHOD;
  const methodId = String(await cfg(methodKey, methodEnv || "")).trim();
  const methodPrefix = isRef ? "REF" : "GPO";
  if (!methodId) {
    const msg = `Método ${methodPrefix} por configurar (${methodKey})`;
    console.error(`[PAYMENTS] ${code}: ${msg}`);
    await saveEkwanzaError(code, msg);
    return { ok: false, error: msg };
  }
  const applyStatus = async (rawStatus) => {
    // Mapeia resposta síncrona GPO (case-insensitive) para estado interno.
    const s = String(rawStatus || "").toLowerCase();
    let mapped = null;
    if (["success", "successful", "paid", "confirmado", "completed"].includes(s)) mapped = "confirmado";
    else if (["failed", "fail", "cancelled", "canceled", "expired", "rejected", "error"].includes(s)) mapped = "rejeitado";
    if (!mapped) return;
    try {
      if (mapped === "confirmado") {
        await pool.query(
          "UPDATE payments SET status='confirmado', paid_at=NOW(), reconciled_at=NOW(), updated_at=NOW() WHERE code=$1 AND status='pendente'",
          [code]
        );
      } else {
        await pool.query(
          "UPDATE payments SET status='rejeitado', updated_at=NOW() WHERE code=$1 AND status='pendente'",
          [code]
        );
      }
      broadcastPaymentUpdate({ type: "payment_updated", code, status: mapped });
      console.log(`[PAYMENTS] ${code}: pendente -> ${mapped} (resposta GPO: ${rawStatus})`);
      if (mapped === "confirmado") {
        const dr = await sendCademiDelivery(code);
        if (!dr.ok) console.log(`[CADEMI] ${code}: ${dr.skipped}`);
      }
    } catch {}
  };
  const linkCharge = async (chargeId) => {
    if (!chargeId || !paymentId || chargeId === "00000000-0000-0000-0000-000000000000") return;
    try {
      await pool.query("UPDATE payments SET ekwanza_code = $1 WHERE id = $2", [chargeId, paymentId]);
    } catch {}
  };
  // Guarda entidade + número de referência. Faz MERGE para não apagar email/nome/produto.
  const applyReference = async (ref) => {
    const refNumber = ref?.referenceNumber || ref?.reference_number || null;
    if (!refNumber) return false;
    try {
      const dueDate = ref?.dueDate || ref?.due_date || null;
      const entity = ref?.entity || null;
      const cur = await pool.query("SELECT metadata FROM payments WHERE code = $1", [code]);
      let curMeta = {};
      try {
        const cm = cur.rows[0]?.metadata;
        curMeta = typeof cm === "string" ? JSON.parse(cm) : (cm || {});
      } catch {}
      const meta = { ...curMeta, phone: customer_phone || curMeta.phone || null, description: description || curMeta.description || null, dueDate };
      delete meta.ekwanza_error;
      await pool.query(
        "UPDATE payments SET reference_code = $1, entity = COALESCE($2, entity), metadata = $3 WHERE code = $4",
        [String(refNumber), entity, JSON.stringify(meta), code]
      );
      broadcastPaymentUpdate({ type: "payment_updated", code, status: "pendente", reference: String(refNumber), entity });
      console.log(`[PAYMENTS] ${code}: referência ${refNumber} entidade ${entity || "-"}`);
      return true;
    } catch (e) { console.error("[PAYMENTS] Falha a gravar referência:", e.message); return false; }
  };
  const recoverCharge = async (token) => {
    // O POST pode processar no servidor mesmo sem resposta: recuperar pelo TXID
    try {
      const gpoUrl = (await cfg("ekwanza_gpo_url", process.env.EKWANZA_GPO_URL || "https://gwy-api.appypay.co.ao/v2.0")).replace(/\/$/, "");
      const chk = await fetch(`${gpoUrl}/charges?merchantTransactionId=${encodeURIComponent(code)}`, {
        headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0", Authorization: `Bearer ${token}` },
      });
      const chkJson = await chk.json();
      const found = (chkJson.payments || [])[0];
      if (found?.id) await linkCharge(found.id);
      await applyReference(found?.reference || null);
      return found || null;
    } catch { return null; }
  };
  try {
    const token = await getEkwanzaToken();
    const gpoUrl = (await cfg("ekwanza_gpo_url", process.env.EKWANZA_GPO_URL || "https://gwy-api.appypay.co.ao/v2.0")).replace(/\/$/, "");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 45000);
    try {
      const cResp = await fetch(`${gpoUrl}/charges`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json", Accept: "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: amt, currency: "AOA", description: description || `Pagamento ${code}`,
          merchantTransactionId: code,
          paymentMethod: `${methodPrefix}_${methodId}`,
          options: {
            MerchantIdentifier: await cfg("ekwanza_account_number", process.env.EKWANZA_ACCOUNT_NUMBER || ""),
            // REF usa a chave GPR, Express (GPO) usa a chave GPO (folha E+ do comerciante).
            ApiKey: isRef
              ? await cfg("ekwanza_gpr_api_key", process.env.EKWANZA_GPR_API_KEY || process.env.EKWANZA_GPO_API_KEY || "")
              : await cfg("ekwanza_gpo_api_key", process.env.EKWANZA_GPO_API_KEY || ""),
          },
                ...(isRef ? {} : (customer_phone ? { paymentInfo: { phoneNumber: customer_phone } } : {})),
        }),
        signal: ctrl.signal,
      });
      const charge = await cResp.json().catch(() => null);
      if (charge?.id) await linkCharge(charge.id);
      // Referência (entidade + número) pode vir na resposta síncrona.
      await applyReference(charge?.responseStatus?.reference || charge?.reference || null);
      // A resposta síncrona já pode trazer o estado final — aplica-o.
      const syncStatus =
        charge?.status ||
        charge?.responseStatus?.status ||
        (charge?.responseStatus?.successful === true ? "Success" : null) ||
        (charge?.responseStatus?.success === true ? "Success" : null);
      if (syncStatus) await applyStatus(syncStatus);
      if (!cResp.ok) {
        const msg = `É-kwanza recusou (${cResp.status}): ${JSON.stringify(charge).slice(0, 200)}`;
        console.error(`[PAYMENTS] ${code}: ${msg}`);
        await saveEkwanzaError(code, msg);
        await recoverCharge(token);
        return { ok: false, error: msg };
      }
      if (!charge?.id) await recoverCharge(token);
      broadcastPaymentUpdate({ type: "payment_updated", code, status: "pendente", ekwanza_sent: true });
      return { ok: true };
    } finally { clearTimeout(timer); }
  } catch (e) {
    console.error(`[PAYMENTS] ${code}: falha no disparo:`, e.message);
    await saveEkwanzaError(code, e.message);
    try {
      const token = await getEkwanzaToken().catch(() => null);
      if (token) await recoverCharge(token);
    } catch {}
    return { ok: false, error: e.message };
  }
}

// Criar pagamento: regista como pendente e responde DE IMEDIATO (<300ms).
// A cobrança Ekwanza corre em background (fire-and-forget) para o modal
// fechar sem esperar pelo OAuth + POST GPO (10-45s).
// PÚBLICO (widget Cademi sem JWT): validado por montante/telefone + regra 1 pendente + rate-limit.
// O preço é revalidado no servidor contra settings@cademi_entregas (anti-tamper do widget).
app.post("/api/v1/payments", rateLimit(30), async (req, res) => {
  try {
    const { amount, method, customer_id, customer_phone: raw_phone, customer_email, customer_name, cademi_produto, description, reference_code, return_url } = req.body || {};
    const promo_code = req.body?.promo_code || req.body?.promoCode || null;
    let amt = parseFloat(amount);
    if (!amt || amt <= 0) return res.status(400).json({ error: "Montante inválido" });
    // Preço oficial do conteúdo (se configurado): bloqueia underpay via widget adulterado.
    let officialPreco = null;
    if (cademi_produto) {
      try {
        const srow = await pool.query("SELECT value FROM settings WHERE key = 'cademi_entregas'").catch(() => null);
        let manual = srow?.rows?.[0]?.value ?? [];
        if (typeof manual === "string") { try { manual = JSON.parse(manual); } catch { manual = []; } }
        const found = (Array.isArray(manual) ? manual : []).find(o => String(o?.id || "").toLowerCase() === String(cademi_produto).toLowerCase());
        const preco = found?.preco != null && found.preco !== "" ? Number(found.preco) : null;
        if (preco != null && Number.isFinite(preco) && preco > 0) officialPreco = preco;
      } catch {}
    }
    // Código promocional (opcional) — o servidor é autoritativo no valor final.
    let promoApplied = null;
    let autoConfirm = false;
    if (promo_code) {
      await ensurePromoSchema();
      const base = officialPreco != null ? officialPreco : amt;
      const v = await validatePromo({ code: promo_code, base, email: customer_email, phone: raw_phone, cademiProduto: cademi_produto });
      if (!v.valid) return res.status(400).json({ error: v.reason || "Código promocional inválido", promo_invalid: true });
      promoApplied = { code: String(promo_code).trim().toUpperCase(), code_id: v.promo.id, original: v.original, discount: v.discount, final: v.final, type: v.promo.type, value: Number(v.promo.value) };
      amt = v.final;
      if (amt <= 0) { amt = 0; autoConfirm = true; }
    } else if (officialPreco != null && amt < officialPreco) {
      return res.status(400).json({ error: `Montante abaixo do preço (${officialPreco} Kz)` });
    }
    const m = method || "mcx_express";
    const customer_phone = normPhone(raw_phone) || null;
    // Sem número: segue se houver página hospedada (WiPay) — o método e o número
    // escolhem-se na página seguinte. Só exige número quando for preciso
    // disparar push Express direto (É-kwanza, sem WiPay).
    if (m === "mcx_express" && (!customer_phone || customer_phone.length !== 9) && !(await wipayReady())) {
      return res.status(400).json({ error: "Número Express inválido (usa 9XXXXXXXX)" });
    }
    const code = "SC" + Date.now().toString(36).toUpperCase();
    // Autónomo: liga ao cliente pelo telefone (para o envio Cademi ter email).
    let linkedId = customer_id || null;
    if (!linkedId && customer_phone) {
      try {
        const digits = String(customer_phone).replace(/\D/g, "").slice(-9);
        const found = await pool.query(
          "SELECT id FROM customers WHERE REPLACE(REPLACE(REPLACE(COALESCE(phone,''),'+',''), ' ', ''), '-', '') LIKE $1 ORDER BY created_at DESC LIMIT 1",
          [`%${digits}`]
        );
        if (found.rows[0]) linkedId = found.rows[0].id;
      } catch {}
    }
    // Alerta: email do formulário difere do cliente ligado pelo telefone
    // (ex. familiar pagou no Express). A entrega Cademi usa sempre o email
    // do formulário — este log permite detetar casos semelhantes no futuro.
    try {
      const formEm = String(customer_email || "").toLowerCase().trim();
      if (linkedId && formEm) {
        const lr = await pool.query("SELECT email FROM customers WHERE id = $1", [linkedId]);
        const linkEm = String(lr.rows[0]?.email || "").toLowerCase().trim();
        if (linkEm && linkEm !== formEm) {
          console.log(`[PAYMENTS] ${code}: email do formulario != email do cliente ligado - entrega vai para o formulario`);
        }
      }
    } catch {}
    // Regra: 1 pagamento pendente de cada vez por aluno (email ou telefone).
    if (customer_email || customer_phone) {
      const em = String(customer_email || "").toLowerCase().trim();
      const dg = String(customer_phone || "").replace(/\D/g, "").slice(-9);
      const chk = await pool.query(
        `SELECT code FROM payments WHERE status = 'pendente' AND (expires_at IS NULL OR expires_at > NOW()) AND (
          ($1 <> '' AND LOWER(COALESCE(metadata->>'email','')) = $1) OR
          ($2 <> '' AND RIGHT(REGEXP_REPLACE(COALESCE(metadata->>'phone',''), '[^0-9]', '', 'g'), 9) = $2)
        ) LIMIT 1`, [em, dg]);
      if (chk.rows[0]) return res.status(409).json({ error: `Já tens um pagamento pendente (${chk.rows[0].code}). Paga ou cancela antes de gerar outro.`, code: chk.rows[0].code });
    }
    // Trava: conteúdo com acesso ativo não se paga de novo.
    if (customer_email && cademi_produto) {
      const has = await cademiActiveAccess(String(customer_email), String(cademi_produto));
      if (has) return res.status(409).json({ error: `Já tens acesso ativo a este conteúdo (${has}).` });
    }
    // Trava: já pago sem acesso? Não deixa pagar 2x pelo mesmo conteúdo.
    // (Com acesso expirado permite renovar; em dúvida ('unknown') deixa passar.)
    if (customer_email && cademi_produto) {
      try {
        const em2 = String(customer_email).toLowerCase().trim();
        const sl2 = String(cademi_produto).trim();
        const paid = await pool.query(
          `SELECT code, COALESCE(metadata->>'cademi_produto','') AS prod FROM payments
           WHERE status = 'confirmado' AND LOWER(COALESCE(metadata->>'email','')) = $1`, [em2]);
        const dup = paid.rows.find(r => slugify(r.prod) === slugify(sl2));
        if (dup) {
          const st = await cademiAccessState(String(customer_email), sl2);
          if (st === 'active' || st === 'none') {
            return res.status(409).json({ error: `Este conteúdo já foi pago (${dup.code}) — o acesso está a ativar. Faz logout e entra de novo; se não aparecer, fala connosco.`, code: dup.code });
          }
        }
      } catch (e2) { console.error("[PAYMENTS] trava pago-sem-acesso:", e2.message); }
    }
    const metaObj = { phone: customer_phone || null, email: customer_email || null, name: customer_name || null, cademi_produto: cademi_produto || null, description: description || null };
    if (promoApplied) metaObj.promo = promoApplied;
    const initialStatus = autoConfirm ? "confirmado" : "pendente";
    const r = await pool.query(
      `INSERT INTO payments (code, customer_id, amount, method, status, reference_code, metadata, paid_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, ${autoConfirm ? "NOW()" : "NULL"}, NOW() + INTERVAL '24 hours') RETURNING *`,
      [code, linkedId, amt, m, initialStatus, reference_code || code, JSON.stringify(metaObj)]
    );
    const payment = r.rows[0];
    // Registo de utilização do código (serializado por linha do código).
    if (promoApplied) {
      try {
        const userKey = promoUserKey({ email: customer_email, phone: customer_phone });
        await pool.query(
          `INSERT INTO promo_usages (promo_id, user_key, customer_id, email, phone, payment_code, amount_before, amount_after, discount_applied)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [promoApplied.code_id, userKey, linkedId, customer_email || null, customer_phone || null, code, promoApplied.original, promoApplied.final, promoApplied.discount]
        );
        await pool.query("UPDATE promo_codes SET used_count = used_count + 1, updated_at = NOW() WHERE id = $1", [promoApplied.code_id]);
      } catch (e) { console.error("[PROMO] registo de uso:", e.message); }
    }
    // Resposta imediata — o frontend fecha o modal aqui.
    broadcastPaymentUpdate({ type: "payment_created", code, status: initialStatus });
    res.status(201).json({ data: payment });

    // Promo que cobre a totalidade: confirma sem gateway e entrega já o conteúdo.
    if (autoConfirm) {
      setImmediate(async () => {
        try {
          const dr = await sendCademiDelivery(code);
          if (!dr.ok) console.log(`[CADEMI] ${code}: ${dr.skipped || ""}`);
        } catch (e) { console.error("[PAYMENTS] bg auto-confirm:", e.message); }
      });
      return;
    }

    // Background: dispara cobrança/referência sem bloquear a resposta.
    // - mcx_express + telefone → WiPay (página hospedada) se configurado,
    //   senão cobrança push É-kwanza (GPO_...) como antes.
    // - referencia → gera entidade + número de referência (REF_...).
    const wipay = m === "mcx_express" && await wipayReady();
    if ((m === "mcx_express" && (customer_phone || wipay)) || m === "referencia") {
      const bg = { code, paymentId: payment.id, amt, m, customer_phone: customer_phone || null, description: description || null, return_url: sanitizarReturnUrl(return_url) };
      setImmediate(async () => {
        try {
          if (m === "mcx_express" && await wipayReady()) {
            const r = await fireWipayCharge(bg);
            if (!r.ok) console.error("[PAYMENTS] bg wipay:", r.error);
          } else {
            await fireEkwanzaCharge(bg);
          }
        } catch (e) { console.error("[PAYMENTS] bg:", e.message); }
      });
    }
  } catch (err) {
    if (!res.headersSent) console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

// ─── Códigos promocionais (CRUD + validação) ─────────────────────────────────
// Alfabeto sem 0/O/1/I: o código tem de poder ser ditado ao telefone.
const PROMO_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generatePromoCode(prefix = "FIT") {
  let out = "";
  for (let i = 0; i < 8; i++) out += PROMO_CODE_ALPHABET[crypto.randomInt(PROMO_CODE_ALPHABET.length)];
  return `${prefix}-${out}`;
}

// Usos que contam (só pagamentos não falhados/cancelados): é o número que o
// admin vê na lista e o que trava o limite global do código.
const PROMO_ACTIVE_USAGE_SQL = `
  SELECT u.promo_id, COUNT(*)::int AS n
    FROM promo_usages u
    JOIN payments p ON p.code = u.payment_code
   WHERE p.status NOT IN ('rejeitado', 'expirado', 'cancelado')
   GROUP BY u.promo_id`;

// Aceita "2026-10-08T12:00" (datetime-local) ou ISO completo. Devolve null em
// branco; lança erro em data inválida (o chamador responde 400).
function promoDate(value, field) {
  if (value === undefined || value === null || value === "") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error(`DATA_INVALIDA:${field}`);
  return d.toISOString();
}

function promoBool(value, fallback) {
  if (value === undefined) return fallback;
  return !!value;
}

app.get("/api/v1/promos", requireAuth, requireManager, async (req, res) => {
  try {
    await ensurePromoSchema();
    const result = await pool.query("SELECT * FROM promo_codes ORDER BY created_at DESC");
    const counts = await pool.query(PROMO_ACTIVE_USAGE_SQL);
    const byId = new Map(counts.rows.map((r) => [String(r.promo_id), Number(r.n)]));
    const data = result.rows.map((row) => ({ ...row, usage_count: byId.get(String(row.id)) ?? 0 }));
    res.json({ data, total: data.length });
  } catch (err) {
    console.error("[PROMOS LIST]", err.message);
    // Só para administradores: o motivo da falha (BD/esquema) fica visível no
    // CRM em vez de obrigar a abrir os logs do Render.
    const details = req.user?.role === "administrador" ? { details: err.message } : {};
    res.status(500).json({ error: "Erro a listar códigos.", ...details });
  }
});

app.get("/api/v1/promos/:id/usages", requireAuth, requireManager, async (req, res) => {
  try {
    await ensurePromoSchema();
    const promo = await pool.query("SELECT id FROM promo_codes WHERE id = $1", [req.params.id]);
    if (!promo.rows[0]) return res.status(404).json({ error: "Código não encontrado" });
    const r = await pool.query(
      `SELECT u.id, u.user_key, u.email, u.phone, u.payment_code, u.discount_applied,
              u.amount_before, u.amount_after, u.used_at,
              p.status AS payment_status, p.amount AS payment_amount, c.name AS customer_name
         FROM promo_usages u
         LEFT JOIN payments p ON p.code = u.payment_code
         LEFT JOIN customers c ON c.id = u.customer_id
        WHERE u.promo_id = $1
        ORDER BY u.used_at DESC
        LIMIT 200`,
      [req.params.id]
    );
    res.json({ data: r.rows, total: r.rows.length });
  } catch (err) {
    console.error("[PROMOS USAGES]", err.message);
    res.status(500).json({ error: "Erro a ler usos do código." });
  }
});

app.post("/api/v1/promos", requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensurePromoSchema();
    const b = req.body || {};
    const type = String(b.type || "percent").toLowerCase() === "fixed" ? "fixed" : "percent";
    const value = Number(b.value);
    if (!Number.isFinite(value) || value < 0) return res.status(400).json({ error: "Valor inválido" });
    if (type === "percent" && value > 100) return res.status(400).json({ error: "Percentagem máxima é 100" });
    const appliesTo = String(b.applies_to || "all").toLowerCase() === "plans" ? "plans" : "all";
    const planIds = b.plan_ids != null ? (Array.isArray(b.plan_ids) ? b.plan_ids : String(b.plan_ids).split(",").map(s => s.trim()).filter(Boolean)) : null;
    const startsAt = promoDate(b.starts_at, "starts_at");
    const expiresAt = promoDate(b.expires_at, "expires_at");
    if (startsAt && expiresAt && new Date(expiresAt).getTime() <= new Date(startsAt).getTime()) {
      return res.status(400).json({ error: "A expiração tem de ser posterior ao início" });
    }

    // Sem código (ou `generate`) → o servidor gera um aleatório único.
    const explicit = String(b.code || "").trim().toUpperCase();
    const wantsGenerated = !explicit || b.generate === true;
    const attempts = wantsGenerated ? 5 : 1;
    let duplicate = false;

    for (let i = 0; i < attempts; i++) {
      const code = wantsGenerated ? generatePromoCode() : explicit;
      try {
        const r = await pool.query(
          `INSERT INTO promo_codes (code, type, value, min_amount, max_discount, applies_to, plan_ids, usage_limit, per_user, active, starts_at, expires_at, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
          [code, type, Math.round(value),
           b.min_amount != null && b.min_amount !== "" ? Math.round(Number(b.min_amount)) : null,
           b.max_discount != null && b.max_discount !== "" ? Math.round(Number(b.max_discount)) : null,
           appliesTo, JSON.stringify(planIds),
           b.usage_limit != null && b.usage_limit !== "" ? Math.round(Number(b.usage_limit)) : null,
           promoBool(b.per_user, true), promoBool(b.active, true),
           startsAt, expiresAt, req.user?.id || null]
        );
        return res.status(201).json({ data: r.rows[0] });
      } catch (err) {
        if (!String(err.message || "").includes("duplicate key")) throw err;
        duplicate = true;
      }
    }
    if (duplicate) return res.status(409).json({ error: "Já existe um código com esse nome." });
    res.status(500).json({ error: "Erro a criar código." });
  } catch (err) {
    if (String(err.message || "").startsWith("DATA_INVALIDA:")) {
      return res.status(400).json({ error: "Data inválida" });
    }
    console.error("[PROMOS CREATE]", err.message);
    res.status(500).json({ error: "Erro a criar código." });
  }
});

app.patch("/api/v1/promos/:id/toggle", requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensurePromoSchema();
    const r = await pool.query(
      "UPDATE promo_codes SET active = NOT active, updated_at = NOW() WHERE id = $1 RETURNING *",
      [req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: "Código não encontrado" });
    res.json({ data: r.rows[0] });
  } catch (err) {
    console.error("[PROMOS TOGGLE]", err.message);
    res.status(500).json({ error: "Erro a alternar código." });
  }
});

app.delete("/api/v1/promos/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensurePromoSchema();
    // promo_usages apaga em cascade; o histórico de pagamentos mantém metadata.promo.
    const r = await pool.query("DELETE FROM promo_codes WHERE id = $1 RETURNING id", [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: "Código não encontrado" });
    res.status(204).end();
  } catch (err) {
    console.error("[PROMOS DELETE]", err.message);
    res.status(500).json({ error: "Erro a apagar código." });
  }
});

app.patch("/api/v1/promos/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensurePromoSchema();
    const b = req.body || {};
    const fields = [];
    const vals = [];
    const push = (col, val) => { vals.push(val); fields.push(`${col} = $${vals.length}`); };
    if (b.code !== undefined) push("code", String(b.code).trim().toUpperCase());
    if (b.type !== undefined) push("type", String(b.type).toLowerCase() === "fixed" ? "fixed" : "percent");
    if (b.value !== undefined) push("value", Math.round(Number(b.value)));
    if (b.min_amount !== undefined) push("min_amount", b.min_amount === null ? null : Math.round(Number(b.min_amount)));
    if (b.max_discount !== undefined) push("max_discount", b.max_discount === null ? null : Math.round(Number(b.max_discount)));
    if (b.applies_to !== undefined) push("applies_to", String(b.applies_to).toLowerCase() === "plans" ? "plans" : "all");
    if (b.plan_ids !== undefined) push("plan_ids", JSON.stringify(b.plan_ids || []));
    if (b.usage_limit !== undefined) push("usage_limit", b.usage_limit === null ? null : Math.round(Number(b.usage_limit)));
    if (b.per_user !== undefined) push("per_user", !!b.per_user);
    if (b.active !== undefined) push("active", !!b.active);
    if (b.starts_at !== undefined) push("starts_at", promoDate(b.starts_at, "starts_at"));
    if (b.expires_at !== undefined) push("expires_at", promoDate(b.expires_at, "expires_at"));
    if (!fields.length) return res.status(400).json({ error: "Nada para atualizar" });
    fields.push("updated_at = NOW()");
    vals.push(req.params.id);
    const r = await pool.query(`UPDATE promo_codes SET ${fields.join(", ")} WHERE id = $${vals.length} RETURNING *`, vals);
    if (!r.rows[0]) return res.status(404).json({ error: "Código não encontrado" });
    res.json({ data: r.rows[0] });
  } catch (err) {
    if (String(err.message || "").startsWith("DATA_INVALIDA:")) {
      return res.status(400).json({ error: "Data inválida" });
    }
    if (String(err.message || "").includes("duplicate key")) {
      return res.status(409).json({ error: "Já existe um código com esse nome." });
    }
    console.error("[PROMOS UPDATE]", err.message);
    res.status(500).json({ error: "Erro a atualizar código." });
  }
});

app.post("/api/v1/promos/validate", rateLimit(60), async (req, res) => {
  try {
    await ensurePromoSchema();
    const { code, amount, email, phone, cademi_produto, plan_ids } = req.body || {};
    const v = await validatePromo({ code, base: Number(amount), email, phone, cademiProduto: cademi_produto, planIds: plan_ids });
    if (!v.valid) return res.json({ valid: false, reason: v.reason });
    res.json({ valid: true, discount: v.discount, original: v.original, final: v.final, type: v.promo.type, value: Number(v.promo.value) });
  } catch (err) {
    console.error("[PROMOS VALIDATE]", err.message);
    res.status(500).json({ valid: false, reason: "Erro ao validar código" });
  }
});

// ─── Plans ─────────────────────────────────────────────────────────────────

app.get("/api/v1/plans", requireAuth, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM plans ORDER BY id DESC");
    res.json({ data: result.rows, total: result.rows.length });
  } catch (err) {
    console.error("[PLANS LIST] Error:", err.message);
    res.status(500).json({ error: "Erro a ler planos. Ver logs do servidor." });
  }
});

// ─── Cademi (plataforma de cursos) ───────────────────────────────────────────
// Docs: https://ajuda.cademi.com.br/configuracoes/api
// Auth: header Authorization: <api-key> | Limite: 2 req/seg

let _cademiLastCall = 0;
async function cademiFetch(path, options = {}) {
  let base = (await cfg("cademi_api_url", CADEMI_API_URL)).replace(/\/$/, "");
  // Normaliza: garante exatamente um sufixo /api/v1 (o .env traz sem,
  // a tabela settings traz com — ambos têm de funcionar).
  base = base.replace(/\/api\/v1$/, "") + "/api/v1";
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
      headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36", Authorization: `Bearer ${key}`, ...(options.headers || {}) },
    });
    const data = await resp.json();
    if (!resp.ok || data.success === false) {
      return { success: false, error: data.msg || `HTTP ${resp.status}` };
    }
    return data;
  } catch (err) {
    console.error("[CADEMI]", err?.message || err);
    return { success: false, error: "Falha de rede ao contactar a Cademi" };
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

// Editar aluno (nome, email, doc, celular)
app.put("/api/v1/cademi/users/:id", requireAuth, async (req, res) => {
  const { nome, email, doc, celular } = req.body || {};
  const body = {};
  if (nome !== undefined) body.nome = nome;
  if (email !== undefined) body.email = email;
  if (doc !== undefined) body.doc = doc;
  if (celular !== undefined) body.celular = celular;
  if (Object.keys(body).length === 0) return res.status(400).json({ error: "Nada para atualizar" });
  const r = await cademiFetch(`/usuario/update/${encodeURIComponent(req.params.id)}`, { method: "POST", body: JSON.stringify(body) });
  if (!r.success) return res.status(502).json({ error: r.error });
  res.json({ data: r.data?.usuario || r.data || null });
});

// Adicionar tag ao aluno
app.post("/api/v1/cademi/users/:id/tags", requireAuth, async (req, res) => {
  const { tag_id } = req.body || {};
  if (!tag_id) return res.status(400).json({ error: "tag_id é obrigatório" });
  const r = await cademiFetch("/usuario/adicionar_tag", { method: "POST", body: JSON.stringify({ usuario_id: Number(req.params.id), tag_id: Number(tag_id) }) });
  if (!r.success) return res.status(502).json({ error: r.error });
  res.json({ data: r.data || null });
});

// Remover tag do aluno
app.delete("/api/v1/cademi/users/:id/tags/:tagId", requireAuth, async (req, res) => {
  const r = await cademiFetch("/usuario/remover_tag", { method: "POST", body: JSON.stringify({ usuario_id: Number(req.params.id), tag_id: Number(req.params.tagId) }) });
  if (!r.success) return res.status(502).json({ error: r.error });
  res.json({ data: r.data || null });
});

// Controlo de pagamentos por aluno: cruza Cademi × pagamentos do CRM.
// Devolve por email: total pago, nº pagos/pendentes e último pagamento.
app.get("/api/v1/cademi/alunos-cobranca", requireAuth, async (req, res) => {
  try {
    const r = await cademiFetch("/usuario?usuario_email_id_doc=");
    if (!r.success) return res.status(502).json({ error: r.error });
    const users = r.data?.usuario || [];
    const agg = await pool.query(`
      SELECT LOWER(COALESCE(p.metadata->>'email','')) AS email,
        COUNT(*) FILTER (WHERE p.status = 'confirmado') AS pagos,
        COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'confirmado'), 0) AS total_pago,
        COUNT(*) FILTER (WHERE p.status = 'pendente') AS pendentes
      FROM payments p
      WHERE COALESCE(p.metadata->>'email','') <> ''
      GROUP BY 1`);
    const last = await pool.query(`
      SELECT DISTINCT ON (LOWER(COALESCE(p.metadata->>'email',''))) LOWER(COALESCE(p.metadata->>'email','')) AS email,
        p.status AS ultimo_status, p.amount AS ultimo_valor, p.created_at AS ultima_data, p.code AS ultimo_code
      FROM payments p
      WHERE COALESCE(p.metadata->>'email','') <> ''
      ORDER BY 1, p.created_at DESC`);
    const byEmail = {};
    agg.rows.forEach(a => { byEmail[a.email] = { pagos: Number(a.pagos), total_pago: Number(a.total_pago), pendentes: Number(a.pendentes) }; });
    last.rows.forEach(l => { (byEmail[l.email] = byEmail[l.email] || { pagos: 0, total_pago: 0, pendentes: 0 }).ultimo = { status: l.ultimo_status, valor: Number(l.ultimo_valor), data: l.ultima_data, code: l.ultimo_code }; });
    const data = users.map(u => {
      const em = String(u.email || "").toLowerCase();
      const c = byEmail[em] || { pagos: 0, total_pago: 0, pendentes: 0 };
      const estado = c.pendentes > 0 ? "pendente" : (c.pagos > 0 ? "em_dia" : "sem_registo");
      return { cademi_id: u.id, nome: u.nome, email: u.email, celular: u.celular || null, ...c, estado };
    });
    res.json({ data, total: data.length });
  } catch (err) {
    console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

// Sync Cademi → CRM: cria/atualiza customers + subscriptions + payments (confirmado)
// para alunos com acesso ativo. Idempotente: re-correr não duplica (code único).
// Alimenta o "Controlo de pagamentos" (/cademi/alunos-cobranca cruza por metadata.email).
app.post("/api/v1/cademi/sync", requireAuth, requireManager, async (req, res) => {
  try {
    const r = await cademiFetch("/usuario?usuario_email_id_doc=");
    if (!r.success) return res.status(502).json({ error: r.error });
    const users = r.data?.usuario || [];
    const plansR = await pool.query("SELECT id, name, price FROM plans WHERE active = true");
    const planByName = {};
    plansR.rows.forEach(p => { planByName[String(p.name).toLowerCase()] = p; });
    // Preços fonte da verdade: settings "Preços por conteúdo" (ecrã Cademi no CRM).
    // Chave = slug (ex: samorafit-workout). Fallback = plans.price.
    let settingsPrices = {};
    try {
      const srow = await pool.query("SELECT value FROM settings WHERE key = 'cademi_entregas'").catch(() => null);
      let manual = (srow && srow.rows && srow.rows[0] && srow.rows[0].value) ?? [];
      if (typeof manual === "string") { try { manual = JSON.parse(manual); } catch { manual = []; } }
      (Array.isArray(manual) ? manual : []).forEach(o => {
        if (o && o.id !== undefined && o.preco !== undefined && o.preco !== null && o.preco !== "") {
          settingsPrices[String(o.id).toLowerCase()] = Number(o.preco);
        }
      });
    } catch {}
    let created = 0, updated = 0, subs = 0, pays = 0;
    const errors = [];
    // Total de aulas por produto (cache): evita 1 chamada por acesso.
    const lessonsCache = {};
    for (const u of users) {
      try {
        const email = String(u.email || "").trim();
        if (!email) continue;
        const cr = await pool.query("SELECT id FROM customers WHERE LOWER(email) = LOWER($1) LIMIT 1", [email]);
        let customerId;
        if (cr.rows.length > 0) {
          customerId = cr.rows[0].id;
          await pool.query(
            "UPDATE customers SET name = $1, phone = COALESCE($2, phone), cademi_id = $3, updated_at = NOW() WHERE id = $4",
            [u.nome || "Aluno Cademi", u.celular || null, String(u.id), customerId]);
          updated++;
        } else {
          const code = "CL-" + Date.now().toString(36).toUpperCase() + "-" + String(u.id);
          // Entrada real: 1º acesso na Cademi (comecou_em) ou criação da conta — nunca NOW() do import.
          const joinedReal = u.comecou_em || u.criado_em || null;
          const ins = await pool.query(
            `INSERT INTO customers (id, code, name, email, phone, cademi_id, state, joined_at, created_at, updated_at)
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, COALESCE($7, NOW()), NOW(), NOW()) RETURNING id`,
            [code, u.nome || "Aluno Cademi", email, u.celular || null, String(u.id), u.ultimo_acesso_em ? "activo" : "inactivo", joinedReal]);
          customerId = ins.rows[0].id;
          created++;
        }
        // Enriquece género/telefone via espelho OVG (a Cademi não tem género).
        // Só preenche vazios; corre no sync manual (custo irrisório, sem polling).
        try {
          const digits = String(u.celular || '').replace(/\D/g, '').slice(-9);
          const om = await pool.query(
            `SELECT sex, mobile_number FROM ovg_members
             WHERE sex IN ('M','F') AND (LOWER(email) = LOWER($1)
               OR ($2 <> '' AND RIGHT(REGEXP_REPLACE(COALESCE(mobile_number,''), '[^0-9]', '', 'g'), 9) = $2))
             LIMIT 1`,
            [email, digits]);
          if (om.rows.length > 0) {
            await pool.query(
              `UPDATE customers SET gender = COALESCE(gender, $1), phone = COALESCE(phone, $2), updated_at = NOW() WHERE id = $3`,
              [om.rows[0].sex, om.rows[0].mobile_number, customerId]);
          }
        } catch {}
        // Acessos ativos na Cademi = pagantes -> subscription + payment confirmado
        let acessos = [];
        try {
          const ar = await cademiFetch(`/usuario/acesso/${encodeURIComponent(u.id)}`);
          acessos = ((ar && ar.data && ar.data.acesso) || []).filter(x =>
            !x.encerrado && (!x.encerra_em || new Date(x.encerra_em) > new Date()));
        } catch {}
        for (const x of acessos) {
          const prodName = String((x.produto && x.produto.nome) || "").trim();
          const plan = planByName[prodName.toLowerCase()];
          if (!plan) continue;
          // Preço do pagamento: ecrã "Preços por conteúdo". Os PLANOS são negócio
          // à parte (ginásio, geridos na página Planos) e o sync NUNCA lhes toca —
          // o match por nome serve só para pendurar a subscription no plano certo.
          const slug = slugify(prodName);
          const amount = settingsPrices[slug] !== undefined ? settingsPrices[slug] : (Number(plan.price) || 0);
          const start = x.comecou_em ? new Date(x.comecou_em) : new Date();
          const end = x.encerra_em ? new Date(x.encerra_em) : null;
          const ex = await pool.query(
            "SELECT id FROM subscriptions WHERE customer_id = $1 AND plan_id = $2 AND start_date = $3 LIMIT 1",
            [customerId, plan.id, start]);
          let subId = ex.rows[0] && ex.rows[0].id;
          if (!subId) {
            const si = await pool.query(
              `INSERT INTO subscriptions (id, customer_id, plan_id, start_date, end_date, active, created_at, updated_at)
               VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW()) RETURNING id`,
              [customerId, plan.id, start, end]);
            subId = si.rows[0].id;
            subs++;
          }
          const payCode = `CADEMI-${u.id}-${x.produto.id}`;
          const pr = await pool.query(
            `INSERT INTO payments (id, code, customer_id, subscription_id, amount, method, status, paid_at, reconciled_at, metadata, created_at, updated_at)
             VALUES (gen_random_uuid(), $1, $2, $3, $4, 'cademi_import', 'confirmado', $5, NOW(), $6, NOW(), NOW())
             ON CONFLICT (code) DO NOTHING`,
            [payCode, customerId, subId, amount, start,
             JSON.stringify({ email, cademi_user_id: u.id, cademi_produto: prodName, imported: true })]);
          if (pr.rowCount > 0) pays++;
          // Aulas em falta: progresso (completas) + total de itens do produto -> subscription.
          // A lista Clientes lê daqui (zero chamadas extra por linha).
          try {
            let lt = lessonsCache[plan.id];
            if (lt === undefined) {
              try {
                const lr = await cademiFetch(`/item/lista_por_produto/${encodeURIComponent(x.produto.id)}`);
                const itens = (lr && lr.data && lr.data.itens) || [];
                lt = Array.isArray(itens) ? itens.length : 0;
              } catch { lt = 0; }
              lessonsCache[plan.id] = lt;
            }
            let done = 0;
            try {
              const pg = await cademiFetch(`/usuario/progresso_por_produto/${encodeURIComponent(u.id)}/${encodeURIComponent(x.produto.id)}`);
              // Raw Cademi: data.progresso.completas (a rota /progress/:id/:pid desembrulha; aqui é direto)
              const pgd = (pg && pg.data && (pg.data.progresso || pg.data)) || {};
              done = Number(pgd.completas) || 0;
            } catch {}
            await pool.query("UPDATE subscriptions SET lessons_total = $1, lessons_done = $2, updated_at = NOW() WHERE id = $3", [lt, done, subId]);
          } catch {}
        }
      } catch (e) { errors.push(`${u.email || u.id}: ${e.message}`); }
    }
    res.json({ ok: true, cademiUsers: users.length, created, updated, subscriptions: subs, payments: pays, errors: errors.slice(0, 10) });
  } catch (err) {
    console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

// ─── Cademi: acesso ao curso após pagamento confirmado ─────────────────────
// Docs: api-docs.cademi.com.br — POST /api/v1/entrega/enviar
// body: { codigo, status: "aprovado", produto_id, cliente_nome, cliente_email, token }
// Config (tabela settings, editável no CRM > Academia):
//   cademi_auto_delivery = "1"  +  cademi_produto_id = "<id do produto/entrega>"
async function sendCademiDelivery(paymentCode, force = false) {
  try {
    const auto = String(await cfg("cademi_auto_delivery", "")).trim();
    const defProduto = String(await cfg("cademi_produto_id", "")).trim();
    const pr = await pool.query("SELECT * FROM payments WHERE code = $1", [paymentCode]);
    if (pr.rows.length === 0) return { ok: false, skipped: "pagamento inexistente" };
    const payment = pr.rows[0];
    if (payment.status !== "confirmado") return { ok: false, skipped: `estado ${payment.status}` };
    let meta = {};
    try { meta = typeof payment.metadata === "string" ? JSON.parse(payment.metadata) : (payment.metadata || {}); } catch {}
    if (meta.cademi_delivery === "sent" && !force) return { ok: false, skipped: "já enviado" };
    // Entrega do pagamento (seletor) ou padrão da Academia.
    const produtoId = String(meta.cademi_produto || defProduto).trim();
    if (auto !== "1" || !produtoId) return { ok: false, skipped: "cademi_auto_delivery/produto por configurar (Academia)" };
    // Nome + email: a metadata (formulário desta compra) tem PRIORIDADE — o
    // customer_id vem do telefone (pode ser de outra pessoa, ex. familiar que
    // pagou no Express) e nunca pode substituir o aluno desta compra.
    // customers/OVG só como recurso quando a metadata não traz email/nome.
    let nome = meta.name || null, email = meta.email || null, phone = meta.phone || null;
    if ((!email || !nome) && payment.customer_id) {
      try {
        const cr = await pool.query("SELECT name, email, phone FROM customers WHERE id = $1", [payment.customer_id]);
        if (cr.rows[0]) { email = email || cr.rows[0].email; nome = nome || cr.rows[0].name; phone = phone || cr.rows[0].phone; }
      } catch {}
    }
    if (!email && phone) {
      try {
        const digits = String(phone).replace(/\D/g, "").slice(-9);
        const or = await pool.query("SELECT email, name FROM ovg_members WHERE mobile_number LIKE $1 LIMIT 1", [`%${digits}`]);
        if (or.rows[0]?.email) { email = or.rows[0].email; nome = nome || or.rows[0].name; }
      } catch {}
    }
    if (!email) return { ok: false, skipped: "sem email (preenche no cliente e reenvia)" };
    const r = await cademiFetch("/entrega/enviar", {
      method: "POST",
      // Sem campo "token" no corpo: a auth é só o header Bearer.
      // produto_id = slug da entrega Customizada (ex. "samorafit-workout").
      body: JSON.stringify({
        codigo: payment.code, status: "aprovado", produto_id: produtoId,
        cliente_nome: nome || email, cliente_email: email,
      }),
    });
    if (!r.success) return { ok: false, skipped: `Cademi: ${r.error}` };
    // Guarda a resposta crua da Cademi (truncada) para diagnóstico.
    try { meta.cademi_resp = JSON.stringify(r.data ?? r).slice(0, 500); } catch {}
    // Verificação: a entrega só conta como "sent" se o acesso existir mesmo na
    // Cademi (a API pode responder sucesso sem criar acesso — ex. slug errado
    // ou regra de entrega inativa). Sem acesso confirmado, marca
    // "sent_unverified" para permitir nova tentativa e sinalizar no admin.
    let verified = false, acessosCount = 0;
    try {
      const u = await cademiFetch("/usuario?usuario_email_id_doc=" + encodeURIComponent(email));
      const users = u.data?.usuario || [];
      const found = users.find(x => String(x.email || "").toLowerCase() === String(email).toLowerCase());
      if (found?.id) {
        const a = await cademiFetch(`/usuario/acesso/${encodeURIComponent(found.id)}`);
        const acessos = a.data?.acesso || [];
        acessosCount = acessos.length;
        verified = acessos.some(ac => {
          if (ac.encerrado) return false;
          const slug = slugify(ac.produto?.nome);
          return slug === produtoId || String(ac.produto?.id ?? "") === produtoId;
        });
      }
    } catch (e) { console.error(`[CADEMI] ${payment.code}: falha a verificar acesso:`, e.message); }
    meta.cademi_verified = verified;
    meta.cademi_acessos = acessosCount;
    meta.cademi_checked_at = new Date().toISOString();
    meta.cademi_delivery_at = new Date().toISOString();
    if (verified) {
      meta.cademi_delivery = "sent";
    } else {
      meta.cademi_delivery = "sent_unverified";
    }
    await pool.query("UPDATE payments SET metadata = $1 WHERE code = $2", [JSON.stringify(meta), payment.code]);
    console.log(`[CADEMI] Acesso enviado: ${payment.code} →  (produto ${produtoId}) verificado=${verified} acessos=${acessosCount}`);
    if (!verified) return { ok: false, skipped: "entrega aceite pela Cademi mas acesso não confirmado (ver painel Cademi > Vendas e a regra de entrega)" };
    return { ok: true, email };
  } catch (e) { return { ok: false, skipped: e.message }; }
}

// Lista de entregas Cademi (slugs reais).
// 1) slugs derivados dos produtos reais da API (/produto → nome → slug)
// 2) fundidos com a lista manual em settings@cademi_entregas (traz nome bonito + preço)
function slugify(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// Catálogo SamoraFit Workout: só os planos de duração, por ordem crescente de meses
// (1, 3, 6, 12). Mesma regra e mesma ordem da página da Academia (catalogoWorkout em
// apps/web/src/App.tsx) — a lista que o CRM mostra e a que o widget de pagamento
// oferece têm de ser a mesma, por isso a curadoria vive aqui, no servidor.
// A Cademi escreve o nome com acento ("SamoraFit Workout- 1 Mês") e o slug com hífen
// ("samorafit-workout-1-mes"): a duração lê-se pelo número que antecede "mes", sem
// acentos e com qualquer separador pelo caminho. Ficam de fora o "Time Filmes" e o
// "SamoraFit Workout" genérico de 100 Kz.
const DURACAO_WORKOUT = [
  [/(^|\D)1(\D*)mes(es)?\b/, 1],
  [/(^|\D)3(\D*)mes(es)?\b/, 3],
  [/(^|\D)6(\D*)mes(es)?\b/, 6],
  [/(^|\D)12(\D*)mes(es)?\b/, 12],
];
function catalogoWorkout(lista) {
  const duracao = (o) => {
    const alvo = `${o?.id || ""} ${o?.nome || ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (!/samora?fit[-\s]?workout/.test(alvo)) return -1;
    return DURACAO_WORKOUT.find(([re]) => re.test(alvo))?.[1] ?? -1;
  };
  return lista.filter((o) => duracao(o) >= 0).sort((a, b) => duracao(a) - duracao(b));
}
app.get("/api/v1/cademi/entregas", rateLimit(60), async (req, res) => {
  try {
    const byId = new Map();
    // Manual primeiro (tem preço).
    try {
      const srow = await pool.query("SELECT value FROM settings WHERE key = 'cademi_entregas'").catch(() => null);
      let manual = srow?.rows?.[0]?.value ?? [];
      if (typeof manual === "string") { try { manual = JSON.parse(manual); } catch { manual = []; } }
      (Array.isArray(manual) ? manual : []).forEach(o => { if (o?.id) byId.set(o.id, { id: o.id, nome: o.nome || o.id, ...(o.preco ? { preco: o.preco } : {}) }); });
    } catch {}
    // Produtos reais da Cademi (aparecem automaticamente ao criar).
    try {
      const pr = await cademiFetch("/produto");
      (pr.data?.produto || []).forEach(p => {
        const slug = slugify(p.nome);
        if (slug && !byId.has(slug)) byId.set(slug, { id: slug, nome: p.nome });
      });
    } catch {}
    let list = [...byId.values()];
    if (list.length === 0) {
      const def = String(await cfg("cademi_produto_id", "samorafit-workout")).trim() || "samorafit-workout";
      list = [{ id: def, nome: "SamoraFit Workout" }];
    }
    // Só os planos de duração, pela mesma ordem do CRM.
    res.json({ data: catalogoWorkout(list) });
  } catch (err) {
    console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

// Nome do aluno na Cademi pelo email (para o widget pré-preencher).
// PÚBLICO (widget sem JWT): só devolve nome por email exato + rate-limit.
app.get("/api/v1/cademi/nome", studentLookupLimit(), async (req, res) => {
  try {
    const email = String(req.query.email || "").trim();
    if (!email || email.indexOf("@") < 0) return res.status(400).json({ error: "email inválido" });
    audit(req, "student.name_lookup", { details: { email_hash: emailRef(email) } });
    // 1) Cademi primeiro (nome oficial do aluno)
    try {
      const r = await cademiFetch("/usuario?usuario_email_id_doc=" + encodeURIComponent(email));
      const users = r.data?.usuario || [];
      const found = users.find(u => String(u.email || "").toLowerCase() === email.toLowerCase());
      if (found?.nome) return res.json({ data: { nome: found.nome, fonte: "cademi" } });
    } catch {}
    // 2) Fallback: base local (customers / ovg_members)
    try {
      const cr = await pool.query("SELECT name FROM customers WHERE LOWER(email) = LOWER($1) LIMIT 1", [email]);
      if (cr.rows[0]?.name) return res.json({ data: { nome: cr.rows[0].name, fonte: "crm" } });
      const or = await pool.query("SELECT name FROM ovg_members WHERE LOWER(email) = LOWER($1) LIMIT 1", [email]);
      if (or.rows[0]?.name) return res.json({ data: { nome: or.rows[0].name, fonte: "ovg" } });
} catch {}
  // Email desconhecido responde 200 com objecto vazio, igual ao encontrado sem
  // nome. Um 404 aqui era um oráculo de enumeração: bastava comparar o status
  // para saber que emails são clientes. O widget não olha para o status (só
  // para `data.nome`), por isso o comportamento no browser é idêntico.
  res.json({ data: {} });
  } catch (err) {
  console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

// Acessos do aluno na Cademi por email (produto + validade) — para o widget.
// PÚBLICO (widget sem JWT): só os acessos do próprio email + rate-limit.
app.get("/api/v1/cademi/acesso", studentLookupLimit(), async (req, res) => {
  try {
    const email = String(req.query.email || "").trim();
    if (!email || email.indexOf("@") < 0) return res.status(400).json({ error: "email inválido" });
    audit(req, "student.access_viewed", { details: { email_hash: emailRef(email) } });
    const u = await cademiFetch("/usuario?usuario_email_id_doc=" + encodeURIComponent(email));
    const users = u.data?.usuario || [];
    // Sem fallback: email inexistente = sem acessos (nunca os do 1º da lista).
    const found = users.find(x => String(x.email || "").toLowerCase() === email.toLowerCase());
    if (!found?.id) return res.json({ data: [] });
    const a = await cademiFetch(`/usuario/acesso/${encodeURIComponent(found.id)}`);
    const acessos = a.data?.acesso || [];
    const now = Date.now();
    const data = acessos.map(ac => {
      const fim = ac.encerra_em ? new Date(ac.encerra_em).getTime() : null;
      return {
        produto_id: ac.produto?.id ?? null,
        produto_nome: ac.produto?.nome || "",
        comecou_em: ac.comecou_em || null,
        encerra_em: ac.encerra_em || null,
        vitalicio: ac.duracao_tipo === "vitalicio" || !fim,
        encerrado: !!ac.encerrado,
        dias: fim ? Math.max(0, Math.ceil((fim - now) / 86400000)) : null,
      };
    });
    res.json({ data });
  } catch (err) {
    console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

// Manual: (re)enviar acesso à Cademi — backfill e teste (?force=1 reenvia mesmo se já enviado)
app.post("/api/v1/payments/:code/cademi-delivery", requireAuth, async (req, res) => {
  const r = await sendCademiDelivery(req.params.code, req.query.force === "1");
  if (r.ok) return res.json({ ok: true, email: r.email });
  res.status(400).json({ ok: false, error: r.skipped });
});

// Webhook recetor (configurar URL no painel Cademi: /api/v1/webhooks/cademi)
app.post("/api/v1/webhooks/cademi", rateLimit(60), async (req, res) => {
  try {
    const { event_type, event } = req.body || {};
    // SEGURANÇA: valida formato antes de tocar na BD (só liga cademi_id por
    // email válido; nunca mexe em pagamentos por este webhook).
    if (event_type != null && typeof event_type !== "string") {
      return res.status(400).json({ error: "Callback inválido" });
    }
    const email = event?.usuario?.email;
    const cademiId = event?.usuario?.id;
    if (email && cademiId && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
      await pool.query(
        "UPDATE customers SET cademi_id = $1 WHERE LOWER(email) = LOWER($2)",
        [String(cademiId).slice(0, 100), String(email).slice(0, 255)]
      ).catch(() => {});
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
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

// Fase Cademi-CRM: tenta a query do ginásio; sem as tabelas-espelho cai para a tabela CRM.
async function qNumGymOrCrm(gymSql, crmSql, params = []) {
  try {
    const r = await pool.query(gymSql, params);
    return parseFloat(r.rows[0]?.cnt ?? 0);
  } catch {
    return qNum(crmSql, params, 0);
  }
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
      // Fase Cademi-CRM: sem tabelas do ginásio, conta a tabela CRM customers
      qNumGymOrCrm(
        `SELECT COUNT(*) as cnt FROM clientes WHERE ${isMember("clientes")} AND ${notDeleted("clientes")}`,
        `SELECT COUNT(*) as cnt FROM customers`),
      // Activo = status ativo E sócio (não funcionário) E com pelo menos 1 acesso na catraca
      qNumGymOrCrm(
        `SELECT COUNT(DISTINCT c.id_cliente) as cnt FROM clientes c WHERE LOWER(c.status) = 'ativo' AND ${isMember("c")} AND ${notDeleted("c")} AND EXISTS (SELECT 1 FROM acessos a WHERE a.cliente_id = c.id_cliente)`,
        `SELECT COUNT(*) as cnt FROM customers WHERE state = 'activo'`),
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
    console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
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
      const r = await pool.query("SELECT method, COUNT(*) as count, COALESCE(SUM(amount),0) as total FROM payments GROUP BY method");
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
    console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

app.get("/api/v1/integrations", requireAuth, async (req, res) => {
  try {
    const list = await getIntegrationsLive();
    res.json({ data: list, total: list.length });
  } catch (err) {
    console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

// ─── Audit log (feed de actividade real) ────────────────────────────────────

app.get("/api/v1/audit-logs", requireAuth, requireManager, async (req, res) => {
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
    console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
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
    console.error("[AUTOMATIONS LIST] Error:", err.message);
    res.status(500).json({ error: "Erro a ler automações. Ver logs do servidor." });
  }
});

app.post("/api/v1/automations", requireAuth, requireManager, async (req, res) => {
  try {
    const { name, trigger, action } = req.body;
    if (!name || !trigger || !action) return res.status(400).json({ error: "name, trigger e action são obrigatórios" });
    const r = await pool.query(
      "INSERT INTO automations (name, trigger, action) VALUES ($1, $2, $3) RETURNING *",
      [name, trigger, action]
    );
    res.status(201).json({ data: mapAutomation(r.rows[0]) });
  } catch (err) {
    console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

app.patch("/api/v1/automations/:id", requireAuth, requireManager, async (req, res) => {
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
    console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

app.delete("/api/v1/automations/:id", requireAuth, requireManager, async (req, res) => {
  try {
    const r = await pool.query("DELETE FROM automations WHERE id = $1", [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: "Automação não encontrada" });
    res.status(204).end();
  } catch (err) {
    console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

app.patch("/api/v1/automations/:id/toggle", requireAuth, requireManager, async (req, res) => {
  try {
    const r = await pool.query("UPDATE automations SET active = NOT active, updated_at = NOW() WHERE id = $1 RETURNING *", [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: "Automação não encontrada" });
    res.json({ data: mapAutomation(r.rows[0]) });
  } catch (err) {
    console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

// ─── Users (adaptive: works with whatever columns exist) ────────────────────

async function usersColumns() {
  try {
    const r = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'");
    return new Set(r.rows.map(x => x.column_name));
  } catch { return new Set(["id", "name", "email"]); }
}

app.get("/api/v1/users", requireAuth, async (req, res) => {
  try {
    const cols = await usersColumns();
    const sel = ["id", "name", "email", "role", "active", "created_at", "phone", "last_login_at", "login_count"].filter(c => cols.has(c));
    const r = await pool.query(`SELECT ${sel.join(", ")} FROM users ORDER BY created_at DESC`);
    const data = r.rows.map(u => ({
      id: u.id, name: u.name, email: u.email, phone: u.phone || null,
      role: u.role || 'Operacional', active: u.active !== false,
      createdAt: u.created_at || null, lastLoginAt: u.last_login_at || null,
      loginCount: u.login_count ?? 0,
    }));
    res.json({ data, total: data.length });
  } catch (err) {
    console.error("[USERS LIST] Error:", err.message);
    res.status(500).json({ error: "Erro a ler utilizadores. Ver logs do servidor." });
  }
});

app.post("/api/v1/users/invite", rateLimit(10), requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, email, role, phone, password } = req.body;
    if (!name || (!email && !phone)) return res.status(400).json({ error: "Nome e email ou número são obrigatórios" });
    // VULN-05/06: papel válido obrigatório (só admin chega aqui). Aceita qualquer capitalização.
    const INVITE_ROLES = ["administrador", "gestor", "comercial", "financeiro", "operacional"];
    const roleNorm = String(role || "comercial").toLowerCase();
    if (!INVITE_ROLES.includes(roleNorm)) {
      return res.status(400).json({ error: "Papel inválido" });
    }
    const phoneNorm = phone ? String(phone).trim() : null;
    // Sem email gera-se um interno único a partir do número (login faz-se pelo número).
    const emailNorm = email ? String(email).trim() : `${String(phoneNorm).replace(/\D/g, "")}@equipa.crm`;
    const dupE = await pool.query("SELECT id FROM users WHERE email = $1", [emailNorm]);
    if (dupE.rows[0]) return res.status(409).json({ error: "Email já registado" });
    if (phoneNorm) {
      const dupP = await pool.query("SELECT id FROM users WHERE phone = $1", [phoneNorm]);
      if (dupP.rows[0]) return res.status(409).json({ error: "Número já registado" });
    }
    const cols = await usersColumns();
    const tempPass = password && String(password).length >= 8 ? String(password) : crypto.randomBytes(6).toString('hex');
    const hash = await bcrypt.hash(tempPass, SALT_ROUNDS);
    const hasRole = cols.has("role"), hasPass = cols.has("password") || cols.has("password_hash"), hasPhone = cols.has("phone");
    const passCol = cols.has("password") ? "password" : "password_hash";
    const extra = (hasRole ? ", role" : "") + (hasPhone ? ", phone" : "");
    const extraVal = (hasRole ? ", $4" : "") + (hasPhone ? `, $${4 + (hasRole ? 1 : 0)}` : "");
    const params = [name, emailNorm, hash];
    if (hasRole) params.push(roleNorm);
    if (hasPhone) params.push(phoneNorm);
    let row;
    if (hasPass) {
      const r = await pool.query(
        `INSERT INTO users (name, email, ${passCol}${extra}) VALUES ($1, $2, $3${extraVal}) RETURNING id, name, email${hasRole ? ", role" : ""}${hasPhone ? ", phone" : ""}`,
        params
      );
      row = r.rows[0];
    } else {
      const r = await pool.query(
        `INSERT INTO users (name, email${extra}) VALUES ($1, $2${extraVal}) RETURNING id, name, email${hasRole ? ", role" : ""}${hasPhone ? ", phone" : ""}`,
        hasRole || hasPhone ? [name, emailNorm, ...(hasRole ? [roleNorm] : []), ...(hasPhone ? [phoneNorm] : [])] : [name, emailNorm]
      );
      row = r.rows[0];
    }
    // Alteração de permissões: sem a password temporária em claro no registo.
    audit(req, "user.invite", {
      actor: req.user?.name || "sistema",
      actorId: req.user?.userId,
      entity: "user",
      entityId: row.id,
      details: { papel: roleNorm, email_hash: emailRef(emailNorm) },
    });
    res.status(201).json({ data: { ...row, tempPassword: tempPass } });
  } catch (err) {
    console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

app.patch("/api/v1/users/:id/toggle", rateLimit(50), requireAuth, requireAdmin, async (req, res) => {
  try {
    const cols = await usersColumns();
    if (!cols.has("active")) return res.status(400).json({ error: "Tabela users sem coluna active" });
    const r = await pool.query("UPDATE users SET active = NOT active WHERE id = $1 RETURNING id, name, email", [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: "Utilizador não encontrado" });
    // Alteração de permissões de acesso: regista sempre o alvo.
    audit(req, "user.toggle_active", {
      actor: req.user?.name || "sistema",
      actorId: req.user?.userId,
      entity: "user",
      entityId: r.rows[0].id,
      details: { operacao: "toggle_active" },
    });
    res.json({ data: r.rows[0] });
  } catch (err) {
    console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

// ─── OVG sync (usa credenciais das settings) ────────────────────────────────

app.get("/api/v1/ovg/sync/status", requireAuth, async (req, res) => {
  try {
    const r = await pool.query("SELECT MAX(synced_at) as last, COUNT(*) as cnt FROM ovg_members");
    res.json({ data: { isSyncing: false, lastSync: r.rows[0]?.last ? { timestamp: r.rows[0].last, created: 0, updated: parseInt(r.rows[0].cnt) } : null, nextSyncIn: 0 } });
  } catch (err) {
    res.json({ data: { isSyncing: false, lastSync: null, nextSyncIn: 0 } });
  }
});

app.post("/api/v1/ovg/sync/now", requireAuth, requireManager, async (req, res) => {
  try {
    const user = await cfg("ovg_username", OVG_USERNAME);
    const pass = await cfg("ovg_password", OVG_PASSWORD);
    if (!user || !pass) return res.status(400).json({ error: "Credenciais OVG em falta (Integrações > Configurar)" });
    const token = await ovgLogin();
    const members = await ovgGetMembers(token);
    let upserted = 0;
    for (const m of members) {
      try {
        await pool.query(
          `INSERT INTO ovg_members (customer_number, name, sex, nif, mobile_number, email, status, club, last_entry, entry_date, synced_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
           ON CONFLICT (customer_number) DO UPDATE SET name=EXCLUDED.name, sex=EXCLUDED.sex, nif=EXCLUDED.nif, mobile_number=EXCLUDED.mobile_number, email=EXCLUDED.email, status=EXCLUDED.status, club=EXCLUDED.club, last_entry=EXCLUDED.last_entry, entry_date=EXCLUDED.entry_date, synced_at=NOW()`,
          [String(m.customer_number), m.name || null, m.sex || null, m.nif || null, m.mobile_number || null, m.email || null, m.status || null, m.club_cod || m.club || null, m.last_entry || null, m.entry_date || null]
        );
        upserted++;
      } catch {}
    }
    res.json({ data: { synced: upserted, total: members.length }, message: `${upserted} sócios sincronizados` });
  } catch (err) {
    console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

app.get("/api/v1/ovg/members", requireAuth, async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM ovg_members ORDER BY name ASC LIMIT 500");
    res.json({ data: r.rows, total: r.rows.length });
  } catch (err) {
    console.error("[OVG MEMBERS] Error:", err.message);
    res.status(500).json({ error: "Erro a ler membros OVG. Ver logs do servidor." });
  }
});

// ─── Customers PATCH (só campos de contacto; catraca mantém o resto) ─────────

app.patch("/api/v1/customers/:id", requireAuth, async (req, res) => {
  try {
    const id = String(req.params.id);
    // 1) Espelho do ginásio (id numérico ou cartão) — só nome/telefone/email.
    // NOTA: pg_sync.py reenvia online/bloqueado/numero_entradas a cada 10s.
    try {
      const fields = [];
      const params = [];
      if (req.body.nome !== undefined) { fields.push("nome = $" + (params.length + 1)); params.push(req.body.nome); }
      if (req.body.telefone !== undefined) { fields.push("telefone = $" + (params.length + 1)); params.push(req.body.telefone); }
      if (req.body.email !== undefined) { fields.push("email = $" + (params.length + 1)); params.push(req.body.email); }
      if (fields.length > 0) {
        const gp = [...params, id];
        const r = await pool.query(`UPDATE clientes SET ${fields.join(", ")} WHERE (id_cliente::text = $${params.length + 1} OR numero_cartao = $${params.length + 1}) RETURNING id_cliente, nome, telefone, email`, gp);
        if (r.rows.length > 0) return res.json({ data: r.rows[0] });
      }
    } catch {}
    // 2) Tabela CRM customers (uuid) — nome/telefone/email + género (M/F).
    // O espelho OVG é só-leitura (ids "ovg-*"): 404 abaixo é esperado para esses.
    const cfields = [];
    const cparams = [];
    if (req.body.nome !== undefined) { cfields.push("name = $" + (cparams.length + 1)); cparams.push(req.body.nome); }
    if (req.body.telefone !== undefined) { cfields.push("phone = $" + (cparams.length + 1)); cparams.push(req.body.telefone); }
    if (req.body.email !== undefined) { cfields.push("email = $" + (cparams.length + 1)); cparams.push(req.body.email); }
    if (req.body.genero !== undefined) {
      let g = String(req.body.genero || "").trim();
      if (/^masculino/i.test(g)) g = "M";
      else if (/^feminino/i.test(g)) g = "F";
      else if (g !== "" && g !== "M" && g !== "F") return res.status(400).json({ error: "Género inválido (M/F)" });
      cfields.push("gender = NULLIF($" + (cparams.length + 1) + ", '')");
      cparams.push(g);
    }
    if (cfields.length === 0) return res.status(400).json({ error: "Nada para atualizar (nome, telefone, email, genero)" });
    cparams.push(id);
    const r2 = await pool.query(`UPDATE customers SET ${cfields.join(", ")}, updated_at = NOW() WHERE id::text = $${cparams.length} RETURNING id::text AS id, name, email, phone, gender`, cparams);
    if (r2.rows.length === 0) return res.status(404).json({ error: "Cliente não encontrado" });
    res.json({ data: r2.rows[0] });
  } catch (err) {
    console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

// ─── Leads ──────────────────────────────────────────────────────────────────

const LEAD_STATUS = ["novo_lead", "contacto", "qualificado", "proposta", "negociacao", "convertido", "perdido"];

const mapLead = (r) => ({
  id: r.id, code: r.code, name: r.name, email: r.email, phone: r.phone,
  company: r.company, source: r.source, status: r.status, ownerId: r.owner_id,
  estimatedValue: r.estimated_value ?? 0, notes: r.notes, externalId: r.external_id || null,
  whatsapp: r.whatsapp || null, produtoInteresse: r.produto_interesse || null,
  proximoContato: r.proximo_contato || null, motivoPerda: r.motivo_perda || null,
  contactosTotal: r.contactos_total != null ? Number(r.contactos_total) : null,
  ultimoContactoAt: r.ultimo_contacto_at || null, ultimoResultado: r.ultimo_resultado || null,
  ultimoStaff: r.ultimo_staff || null, convertedAt: r.converted_at || null,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

// Enriquecimento da lista/detalhe com resumo de contactos (calculado, sem colunas extra).
const LEAD_WITH_STATS = `l.*,
  (SELECT COUNT(*) FROM lead_contacts c WHERE c.lead_id = l.id) AS contactos_total,
  lc.ult AS ultimo_contacto_at, lc.res AS ultimo_resultado, lc.stf AS ultimo_staff
  FROM leads l LEFT JOIN LATERAL (
    SELECT c.created_at AS ult, c.resultado AS res, COALESCE(u.name, c.staff_name) AS stf
    FROM lead_contacts c LEFT JOIN users u ON u.id = c.staff_id
    WHERE c.lead_id = l.id ORDER BY c.created_at DESC LIMIT 1
  ) lc ON true`;

app.get("/api/v1/leads", requireAuth, async (req, res) => {
  try {
    const where = [];
    const params = [];
    if (req.query.status) { where.push("status = $" + (params.length + 1)); params.push(req.query.status); }
    if (req.query.search) {
      where.push("(LOWER(name) LIKE $" + (params.length + 1) + " OR LOWER(company) LIKE $" + (params.length + 2) + " OR LOWER(email) LIKE $" + (params.length + 3) + ")");
      const q = "%" + req.query.search.toLowerCase() + "%";
      params.push(q, q, q);
    }
    if (req.query.source) { where.push("source = $" + (params.length + 1)); params.push(req.query.source); }
    const wc = where.length ? "WHERE " + where.join(" AND ") : "";
    const r = await pool.query(`SELECT ${LEAD_WITH_STATS} ${wc} ORDER BY l.updated_at DESC LIMIT 500`, params);
    res.json({ data: r.rows.map(mapLead), total: r.rows.length });
  } catch (err) {
    console.error("[LEADS LIST] Error:", err.message);
    res.status(500).json({ error: "Erro a ler leads. Ver logs do servidor." });
  }
});

app.post("/api/v1/leads", requireAuth, async (req, res) => {
  try {
    const { name, email, phone, company, source, status, ownerId, estimatedValue, notes, externalId, whatsapp, produtoInteresse, motivoPerda } = req.body;
    if (!name || name.trim().length < 2) return res.status(400).json({ error: "Nome é obrigatório" });
    const st = LEAD_STATUS.includes(status) ? status : "novo_lead";
    const extId = externalId ? String(externalId).trim() : null;
    // Idempotência: o Supabase/Fit 90 reenvia o mesmo external_id → atualiza sem duplicar.
    if (extId) {
      const existing = await pool.query("SELECT * FROM leads WHERE external_id = $1", [extId]);
      if (existing.rows[0]) {
        const r = await pool.query(
          `UPDATE leads SET name = $1, email = $2, phone = $3, company = $4, source = $5,
           estimated_value = $6, notes = $7, updated_at = NOW() WHERE id = $8 RETURNING *`,
          [name.trim(), email || null, phone || null, company || null, source || null,
           estimatedValue || 0, notes || null, existing.rows[0].id]
        );
        return res.json({ data: mapLead(r.rows[0]) });
      }
    }
    const code = "LD-" + Date.now().toString(36).toUpperCase().slice(-6);
    const r = await pool.query(
      `INSERT INTO leads (code, name, email, phone, company, source, status, owner_id, estimated_value, notes, external_id, whatsapp, produto_interesse, motivo_perda)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [code, name.trim(), email || null, phone || null, company || null, source || null, st, ownerId || null, estimatedValue || 0, notes || null, extId,
       whatsapp || null, produtoInteresse || null, motivoPerda || null]
    );
    res.status(201).json({ data: mapLead(r.rows[0]) });
  } catch (err) {
    console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

// ─── Seguimento de leads: contadores, follow-ups e histórico de contactos ───

app.get("/api/v1/leads/resumo", requireAuth, async (req, res) => {
  try {
    const r = await pool.query(`SELECT COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status = 'novo_lead') AS novas,
      COUNT(*) FILTER (WHERE status = 'qualificado') AS em_acompanhamento,
      COUNT(*) FILTER (WHERE status = 'convertido') AS convertidas,
      COUNT(*) FILTER (WHERE status = 'perdido') AS perdidas,
      COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM lead_contacts c WHERE c.lead_id = leads.id)) AS contactadas
      FROM leads`);
    const row = r.rows[0] || {};
    const num = (v) => Number(v ?? 0);
    res.json({ data: {
      total: num(row.total), novas: num(row.novas), contactadas: num(row.contactadas),
      emAcompanhamento: num(row.em_acompanhamento),
      convertidas: num(row.convertidas), perdidas: num(row.perdidas),
    } });
  } catch (err) {
    console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

app.get("/api/v1/leads/followups/hoje", requireAuth, async (req, res) => {
  try {
    const r = await pool.query(`SELECT ${LEAD_WITH_STATS}
      WHERE l.proximo_contato = CURRENT_DATE AND l.status <> 'convertido'
      ORDER BY l.updated_at DESC LIMIT 200`);
    const owners = await pool.query("SELECT id, name FROM users").catch(() => ({ rows: [] }));
    const byId = Object.fromEntries(owners.rows.map((u) => [u.id, u.name]));
    res.json({ data: r.rows.map((x) => ({ ...mapLead(x), ownerNome: byId[x.owner_id] || null })), total: r.rows.length });
  } catch (err) {
    console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

app.get("/api/v1/leads/:id/contacts", requireAuth, async (req, res) => {
  try {
    const lead = await pool.query("SELECT id FROM leads WHERE id = $1", [req.params.id]);
    if (!lead.rows.length) return res.status(404).json({ error: "Lead não encontrada" });
    const r = await pool.query(
      `SELECT c.id, c.canal, c.resultado, c.proximo_passo, c.proximo_contato, c.observacao, c.created_at,
              COALESCE(u.name, c.staff_name) AS staff_nome
       FROM lead_contacts c LEFT JOIN users u ON u.id = c.staff_id
       WHERE c.lead_id = $1 ORDER BY c.created_at ASC`, [req.params.id]);
    res.json({ data: r.rows, total: r.rows.length });
  } catch (err) {
    console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

const LEAD_CANAIS = ["WhatsApp", "Telefone", "SMS", "Presencial", "E-mail", "Sistema"];
const LEAD_RESULTADOS = ["Não respondeu", "Interessado", "Pediu mais informações", "Pediu para contactar depois", "Não tem interesse", "Converteu", "Número inválido", "Mudança de etapa"];
const LEAD_PASSOS = ["Contactar amanhã", "Contactar em 3 dias", "Contactar em 7 dias", "Sem próximo contacto", "Agendar visita"];
function passoParaData(passo) {
  const d = new Date();
  if (passo === "Contactar amanhã") d.setDate(d.getDate() + 1);
  else if (passo === "Contactar em 3 dias") d.setDate(d.getDate() + 3);
  else if (passo === "Contactar em 7 dias") d.setDate(d.getDate() + 7);
  else return null;
  return d.toISOString().slice(0, 10);
}
const isDateStr = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

app.post("/api/v1/leads/:id/contacts", requireAuth, async (req, res) => {
  try {
    const lead = await pool.query("SELECT * FROM leads WHERE id = $1", [req.params.id]);
    if (!lead.rows.length) return res.status(404).json({ error: "Lead não encontrada" });
    const { canal, resultado, proximo_passo, proximo_contato, observacao, staff_id } = req.body || {};
    if (!LEAD_CANAIS.includes(canal)) return res.status(400).json({ error: "Canal inválido" });
    if (!LEAD_RESULTADOS.includes(resultado)) return res.status(400).json({ error: "Resultado inválido" });
    const passo = proximo_passo || null;
    if (passo !== null && !LEAD_PASSOS.includes(passo)) return res.status(400).json({ error: "Próximo passo inválido" });
    let proxData = isDateStr(proximo_contato) ? proximo_contato : null;
    if (!proxData && passo && passo !== "Sem próximo contacto" && passo !== "Agendar visita") proxData = passoParaData(passo);
    if (passo === "Agendar visita" && !proxData) return res.status(400).json({ error: "Agendar visita precisa de data" });
    if (passo === "Sem próximo contacto") proxData = null;
    // Quem contactou: utilizador autenticado (JWT) → staff_id explícito válido → senão nulo.
    let staffId = null, staffName = null;
    const tryIds = [req.user?.userId, staff_id].filter(Boolean);
    for (const sid of tryIds) {
      try {
        const u = await pool.query("SELECT id, name FROM users WHERE id = $1", [sid]);
        if (u.rows[0]) { staffId = u.rows[0].id; staffName = u.rows[0].name; break; }
      } catch {}
    }
    const id = crypto.randomUUID();
    const ins = await pool.query(
      `INSERT INTO lead_contacts (id, lead_id, staff_id, staff_name, canal, resultado, proximo_passo, proximo_contato, observacao)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [id, req.params.id, staffId, staffName, canal, resultado, passo, proxData, observacao || null]
    );
    let upd = "UPDATE leads SET proximo_contato = $1, updated_at = NOW()";
    const up = [proxData];
    if (resultado === "Converteu" && lead.rows[0].status !== "convertido") {
      upd += ", status = 'convertido', converted_at = NOW()";
    } else if (lead.rows[0].status === "novo_lead") {
      // Estado nunca diverge do histórico: 1º contacto registado ⇒ Contactada
      upd += ", status = 'contacto'";
    }
    upd += " WHERE id = $" + (up.length + 1) + " RETURNING *";
    up.push(req.params.id);
    const lr = await pool.query(upd, up);
    const c = ins.rows[0];
    res.status(201).json({ data: {
      id: c.id, canal: c.canal, resultado: c.resultado, proximoPasso: c.proximo_passo,
      proximoContato: c.proximo_contato, observacao: c.observacao,
      staffNome: staffName, createdAt: c.created_at,
    }, lead: mapLead(lr.rows[0]) });
  } catch (err) {
    console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

app.get("/api/v1/leads/:id", requireAuth, async (req, res) => {
  try {
    const r = await pool.query(`SELECT ${LEAD_WITH_STATS} WHERE l.id = $1`, [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: "Lead não encontrada" });
    res.json({ data: mapLead(r.rows[0]) });
  } catch (err) {
    console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

app.patch("/api/v1/leads/:id", requireAuth, async (req, res) => {
  try {
    const cur = await pool.query("SELECT * FROM leads WHERE id = $1", [req.params.id]);
    if (!cur.rows.length) return res.status(404).json({ error: "Lead não encontrada" });
    const fields = [];
    const params = [];
    for (const k of ["name", "email", "phone", "company", "source", "notes"]) {
      if (req.body[k] !== undefined) { fields.push(`${k} = $${params.length + 1}`); params.push(req.body[k]); }
    }
    const camelMap = { whatsapp: "whatsapp", produtoInteresse: "produto_interesse", proximoContato: "proximo_contato", motivoPerda: "motivo_perda" };
    for (const [ck, col] of Object.entries(camelMap)) {
      if (req.body[ck] !== undefined) { fields.push(`${col} = $${params.length + 1}`); params.push(req.body[ck] || null); }
    }
    if (req.body.status !== undefined) {
      if (!LEAD_STATUS.includes(req.body.status)) return res.status(400).json({ error: "Status inválido" });
      fields.push(`status = $${params.length + 1}`); params.push(req.body.status);
      // Entrar em Convertida marca a data. A etapa muda-se na tabela, sem passar por
      // um contacto com resultado "Converteu", e o rasto não pode depender de o gestor
      // ter registado esse contacto. Sair da etapa desfaz a data, para não ficar uma
      // conversão antiga em cima de uma lead que voltou ao funil.
      if (req.body.status === "convertido" && cur.rows[0].status !== "convertido") fields.push("converted_at = NOW()");
      else if (cur.rows[0].status === "convertido") fields.push("converted_at = NULL");
    }
    if (req.body.estimatedValue !== undefined) { fields.push(`estimated_value = $${params.length + 1}`); params.push(req.body.estimatedValue); }
    if (req.body.ownerId !== undefined) { fields.push(`owner_id = $${params.length + 1}`); params.push(req.body.ownerId); }
    if (!fields.length) return res.status(400).json({ error: "Nada para atualizar" });
    fields.push("updated_at = NOW()");
    params.push(req.params.id);
    const r = await pool.query(`UPDATE leads SET ${fields.join(", ")} WHERE id = $${params.length} RETURNING *`, params);
    if (!r.rows.length) return res.status(404).json({ error: "Lead não encontrada" });
    // Rasto de quem/quando: mudança de etapa entra no histórico (canal Sistema)
    if (req.body.status !== undefined && req.body.status !== cur.rows[0].status) {
      try {
        let staffId = null, staffName = null;
        const tryIds = [req.user?.userId].filter(Boolean);
        for (const sid of tryIds) {
          try {
            const u = await pool.query("SELECT id, name FROM users WHERE id = $1", [sid]);
            if (u.rows[0]) { staffId = u.rows[0].id; staffName = u.rows[0].name; break; }
          } catch {}
        }
        const motivo = req.body.motivoPerda ?? r.rows[0].motivo_perda;
        const obs = `Etapa: ${cur.rows[0].status} → ${req.body.status}` +
          (req.body.status === "perdido" && motivo ? ` · Motivo: ${motivo}` : "");
        await pool.query(
          `INSERT INTO lead_contacts (id, lead_id, staff_id, staff_name, canal, resultado, proximo_passo, proximo_contato, observacao)
           VALUES ($1,$2,$3,$4,'Sistema','Mudança de etapa',NULL,$5,$6)`,
          [crypto.randomUUID(), req.params.id, staffId, staffName, r.rows[0].proximo_contato, obs]
        );
      } catch {}
    }
    res.json({ data: mapLead(r.rows[0]) });
  } catch (err) {
    console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

app.delete("/api/v1/leads/:id", requireAuth, requireManager, async (req, res) => {
  try {
    const r = await pool.query("DELETE FROM leads WHERE id = $1", [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: "Lead não encontrada" });
    res.status(204).end();
  } catch (err) {
    console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

app.post("/api/v1/leads/:id/convert", requireAuth, async (req, res) => {
  try {
    const r = await pool.query(
      "UPDATE leads SET status = 'convertido', converted_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *",
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: "Lead não encontrada" });
    res.json({ data: mapLead(r.rows[0]) });
  } catch (err) {
    console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

app.post("/api/v1/plans", requireAuth, requireManager, async (req, res) => {
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
    console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

app.put("/api/v1/plans/:id", requireAuth, requireManager, async (req, res) => {
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
    console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

app.delete("/api/v1/plans/:id", requireAuth, requireManager, async (req, res) => {
  try {
    const id = String(req.params.id);
    // Planos são negócio à parte: apagar leva subscrições + pagamentos.
    // Sem ?force=1 e com dependências -> 409 com contagens (o UI pede 2ª confirmação).
    const used = await pool.query("SELECT COUNT(*) AS cnt FROM subscriptions WHERE plan_id = $1", [id]);
    const n = parseInt(used.rows[0]?.cnt || "0", 10);
    if (n > 0 && req.query.force !== "1" && req.query.force !== "true") {
      const pay = await pool.query("SELECT COUNT(*) AS cnt FROM payments p JOIN subscriptions s ON s.id = p.subscription_id WHERE s.plan_id = $1", [id]);
      return res.status(409).json({ error: "has_dependencies", subscriptions: n, payments: parseInt(pay.rows[0]?.cnt || "0", 10), message: `Plano com ${n} subscrições. Confirme de novo para APAGAR TUDO (inclui pagamentos).` });
    }
    if (n > 0) {
      await pool.query("DELETE FROM payments WHERE subscription_id IN (SELECT id FROM subscriptions WHERE plan_id = $1)", [id]);
      await pool.query("DELETE FROM subscriptions WHERE plan_id = $1", [id]);
    }
    const result = await pool.query("DELETE FROM plans WHERE id = $1 RETURNING id", [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Plano não encontrado" });
    res.json({ ok: true, id: req.params.id, deleted: true });
  } catch (err) {
    console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

// ─── Subscriptions ─────────────────────────────────────────────────────────

app.get("/api/v1/subscriptions", requireAuth, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM subscriptions ORDER BY id DESC LIMIT 100");
    res.json({ data: result.rows, total: result.rows.length });
  } catch (err) {
    console.error("[SUBSCRIPTIONS LIST] Error:", err.message);
    res.status(500).json({ error: "Erro a ler subscrições. Ver logs do servidor." });
  }
});

app.get("/api/v1/payments/ekwanza/check-status/:id", rateLimit(60), async (req, res) => {
  try {
    const { id } = req.params;
    // Aceita code (SC...) ou id (uuid) — o frontend envia code.
    const paymentResult = await pool.query("SELECT * FROM payments WHERE code = $1 OR CAST(id AS TEXT) = $1", [id]);
    if (paymentResult.rows.length === 0) {
      return res.status(404).json({ error: "Pagamento não encontrado" });
    }
    const payment = paymentResult.rows[0];
    // Cancelado pelo aluno: nunca reabre (mesmo que a É-kwanza aprove depois).
    try {
      const mm = typeof payment.metadata === "string" ? JSON.parse(payment.metadata) : (payment.metadata || {});
      if (mm.cancelled_by_user) {
        return res.json({ paymentId: id, code: payment.code, ekwanzaStatus: "CANCELLED_BY_USER", currentStatus: payment.status, newStatus: payment.status, changed: false });
      }
    } catch {}
    // URL hospedada WiPay (se existir) sai em todas as respostas — mesmo
    // que a consulta É-kwanza falhe (ex. credenciais antigas mortas).
    let hosted = null;
    try {
      const mm0 = typeof payment.metadata === "string" ? JSON.parse(payment.metadata) : (payment.metadata || {});
      hosted = mm0.hosted_url || null;
    } catch {}
    let token = null;
    try { token = await getEkwanzaToken(); } catch { token = null; }
    if (!token) {
      // Sem É-kwanza: responde estado atual + link WiPay (se houver).
      // Pendentes WiPay confirmam-se pelo webhook / sync automático.
      return res.json({ paymentId: id, code: payment.code, ekwanzaStatus: "QUERY_FAILED", currentStatus: payment.status, hosted_url: hosted });
    }
    const chargeResp = await fetch(`https://gwy-api.appypay.co.ao/v2.0/charges?merchantTransactionId=${encodeURIComponent(payment.code)}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!chargeResp.ok) {
      return res.json({ paymentId: id, code: payment.code, ekwanzaStatus: "QUERY_FAILED", currentStatus: payment.status, hosted_url: hosted });
    }
    const chargeData = await chargeResp.json();
    const charge = chargeData.payments?.[0] || chargeData.payment || chargeData.data || null;
    if (!charge) {
      // Referência nunca gerada (ex. config REF em falta na altura): tenta gerar agora.
      // Zero-UUID = tentativa falhada anterior, conta como ausente.
      const noCharge = !payment.ekwanza_code || payment.ekwanza_code === "00000000-0000-0000-0000-000000000000";
      if (payment.method === "referencia" && noCharge) {
        let meta0 = {};
        try { meta0 = typeof payment.metadata === "string" ? JSON.parse(payment.metadata) : (payment.metadata || {}); } catch {}
        setImmediate(() => fireEkwanzaCharge({
          code: payment.code, paymentId: payment.id, amt: Number(payment.amount),
          m: "referencia", customer_phone: meta0.phone || null, description: meta0.description || null,
        }).catch(() => {}));
        return res.json({ paymentId: id, code: payment.code, ekwanzaStatus: "GENERATING", currentStatus: payment.status, hosted_url: hosted });
      }
      return res.json({ paymentId: id, code: payment.code, ekwanzaStatus: "NOT_FOUND", currentStatus: payment.status, hosted_url: hosted });
    }
    const rawChargeStatus = String(charge.status ?? charge.paymentStatus ?? charge.state ?? "").toLowerCase();
    const statusMap = { success: "confirmado", successful: "confirmado", paid: "confirmado", confirmado: "confirmado", completed: "confirmado", pending: "pendente", pendente: "pendente", failed: "rejeitado", fail: "rejeitado", cancelled: "rejeitado", canceled: "rejeitado", expired: "rejeitado", rejected: "rejeitado", error: "rejeitado" };
    const newStatus = statusMap[rawChargeStatus] || payment.status;
    // Preenche entidade + referência vindas da É-kwanza (pagamentos por referência).
    const refNumber = charge.reference?.referenceNumber || charge.reference?.reference_number || null;
    if (refNumber && (payment.reference_code !== String(refNumber) || !payment.entity)) {
      try {
        await pool.query(
          "UPDATE payments SET reference_code = $1, entity = COALESCE($2, entity), updated_at = NOW() WHERE code = $3",
          [String(refNumber), charge.reference?.entity || null, payment.code]
        );
        console.log(`[CHECK-STATUS] ${payment.code}: referência ${refNumber} entidade ${charge.reference?.entity || "-"}`);
      } catch (e) { console.error("[CHECK-STATUS] Falha a gravar referência:", e.message); }
    }
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
      if (newStatus === "confirmado") setImmediate(() => sendCademiDelivery(payment.code));
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
      hosted_url: (() => { try {
        const mm = typeof payment.metadata === "string" ? JSON.parse(payment.metadata) : (payment.metadata || {});
        return mm.hosted_url || null;
      } catch { return null; } })(),
    });
  } catch (err) {
    console.error("[CHECK-STATUS] Error:", err.message);
    console.error("[API]", err?.message || err); res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

// ─── Edge Agent API (PC do ginásio) ─────────────────────────────────────────
// SEGURANÇA: só com X-API-Key das máquinas (requireEdgeAuth). Os scripts do
// PC (edge_agent.py, sync_crm.py, sync_ovg.py) têm de enviar o header.
const pendingCommands = [];

app.post("/api/edge/evento", requireEdgeAuth, async (req, res) => {
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

app.get("/api/edge/comandos", requireEdgeAuth, (req, res) => {
  const agentId = req.query.agent_id || "PC01";
  const cmds = pendingCommands.filter(c => c.agent_id === agentId || !c.agent_id);
  // Clear delivered commands
  pendingCommands.length = 0;
  res.json({ comandos: cmds });
});

app.get("/api/edge/sincronizar", requireEdgeAuth, async (req, res) => {
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

// Posiciona no MAX atual para não despejar histórico no arranque
pool.query("SELECT COALESCE(MAX(id_acesso), 0) as m FROM acessos")
  .then(r => { lastSyncedId = parseInt(r.rows[0].m); })
  .catch(() => {});

const ACCESS_SELECT = `SELECT a.id_acesso, a.cliente_id, c.nome as cliente_nome,
  a.data_acesso::text as data_acesso, a.hora_acesso,
  a.tipo_acesso, a.resultado, a.motivo
  FROM acessos a JOIN clientes c ON a.cliente_id = c.id_cliente`;

app.get("/api/v1/access/stream", requireAuth, async (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });

  try {
    const result = await pool.query(
      `${ACCESS_SELECT} WHERE ${isMember("c")} AND ${notDeleted("c")} ORDER BY a.id_acesso DESC LIMIT 20`
    );
    res.write(`data: ${JSON.stringify({ type: "connected", history: result.rows })}\n\n`);
  } catch {}

  sseClients.add(res);
  req.on("close", () => sseClients.delete(res));
});

setInterval(async () => {
  if (sseClients.size === 0) return; // quota Neon: só consulta com clientes ligados (era 5s)
  try {
    const result = await pool.query(
      `${ACCESS_SELECT} WHERE a.id_acesso > $1 AND ${isMember("c")} AND ${notDeleted("c")} ORDER BY a.id_acesso DESC LIMIT 50`,
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
}, 15 * 1000);

// /admin: o HTML do backoffice só é entregue com sessão de staff válida.
// Registado antes do fallback SPA; sem isto, express.static + sendFile
// serviriam /admin a qualquer visitante. Os dados continuam protegidos por
// requireAuth/requireRole nas rotas /api/v1.
app.use(adminPageGuard);

// ─── Serve frontend (built files) ─────────────────────────────────────────
import { existsSync } from "fs";
const staticDir = join(__dirname, "public");
if (existsSync(staticDir)) {
  // pay-widget.js corre em sites terceiros: sem cache para atualizações
  // (remoção de campos, etc.) chegarem de imediato, sem Ctrl+F5.
  app.use(express.static(staticDir, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith("pay-widget.js")) {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
        res.setHeader("Pragma", "no-cache");
      }
    },
  }));
  app.use((req, res, next) => {
    if (req.method === "GET" && !req.path.startsWith("/api/") && !req.path.startsWith("/healthz")) {
      res.sendFile(join(staticDir, "index.html"));
    } else {
      next();
    }
  });
}

const port = Number(process.env.PORT || 3000);

// Presas na landing (Supabase) para a página Fit90 + botão sincronizar.
// (Antes do 404 catch-all — rotas depois dele nunca são alcançadas.)
app.get("/api/v1/leads/fit90-pendentes", requireAuth, async (req, res) => {
  try {
    const sbUrl = String(process.env.SUPABASE_URL || "https://fslrkrhuatzfqxbzilnd.supabase.co").replace(/\/$/, "");
    const sbKey = String(process.env.SUPABASE_SERVICE_KEY || "");
    if (!sbKey) return res.json({ data: { configured: false, rows: [] } });
    const r = await fetch(`${sbUrl}/rest/v1/fit90_leads?pushed=eq.false&select=id,name,email,phone,source,created_at&order=created_at.desc&limit=100`,
      { headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` } });
    const rows = await r.json().catch(() => []);
    res.json({ data: { configured: true, rows: Array.isArray(rows) ? rows : [] } });
  } catch (err) {
    console.error("[FIT90-PEND]", err?.message || err);
    res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});
app.post("/api/v1/leads/fit90-sync", requireAuth, async (req, res) => {
  try {
    const r = await syncFit90Leads();
    if (r?.skipped) return res.json({ data: { pushed: 0, skipped: true } });
    res.json({ data: { pushed: r?.pushed || 0 } });
  } catch (err) {
    console.error("[FIT90-SYNC] manual:", err?.message || err);
    res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

// Webhook Supabase (fit90_leads INSERT -> CRM, automático, sem chaves novas).
// TEM de ficar antes do 404 catch-all abaixo, senão nunca é alcançado.
// Configurar no dashboard Supabase: Database -> Webhooks -> POST
// https://solve-sqoh.onrender.com/api/v1/leads/fit90-hook com header
// X-API-Key = API_KEY do Solve. Idempotente por external_id.
app.post("/api/v1/leads/fit90-hook", rateLimit(60), async (req, res) => {
  try {
    const key = req.headers["x-api-key"];
    if (!apiKeyMatches(String(key || ""), API_KEY)) return res.status(401).json({ error: "não autorizado" });
    const rec = req.body?.record || req.body || {};
    if (req.body?.type && req.body.type !== "INSERT") return res.json({ ok: true, skipped: req.body.type });
    const name = String(rec.name || "").trim();
    if (name.length < 2) return res.status(400).json({ error: "Nome é obrigatório" });
    const extId = String(rec.id || rec.external_id || "");
    if (extId) {
      const dup = await pool.query("SELECT id FROM leads WHERE external_id = $1", [extId]);
      if (dup.rows[0]) return res.json({ ok: true, dedup: true, id: dup.rows[0].id });
    }
    const code = "LD-" + Date.now().toString(36).toUpperCase().slice(-6);
    const r = await pool.query(
      `INSERT INTO leads (code, name, email, phone, company, source, status, estimated_value, notes, external_id)
       VALUES ($1,$2,$3,$4,$5,$6,'novo_lead',$7,$8,$9) RETURNING id`,
      [code, name, rec.email || null, rec.phone || null, rec.company || null,
       rec.source || "fit90_landing", 0, rec.notes || null, extId || null]);
    console.log(`[FIT90-HOOK] ${name} -> lead ${r.rows[0].id}`);
    res.status(201).json({ ok: true, id: r.rows[0].id, code });
  } catch (err) {
    console.error("[FIT90-HOOK]", err?.message || err);
    res.status(500).json({ error: "Erro interno. Tente de novo." });
  }
});

// VULN-13: erros genéricos em produção (sem stacks/mensagens internas).
// Tem de vir depois das rotas e do fallback do SPA.
app.use((req, res) => {
  if (!res.headersSent) res.status(404).json({ error: "Não encontrado" });
});
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const msg = err?.type === "entity.parse.failed" ? "Pedido inválido (JSON malformado)" : "Erro interno. Tente de novo.";
  const status = err?.type === "entity.parse.failed" ? 400 : (err?.status || 500);
  try {
    console.error("[UNHANDLED]", err?.message || err);
  } catch {}
  if (!res.headersSent) res.status(status).json({ error: msg });
});

app.listen(port, () => console.log(`Server listening on port ${port}`));

// ─── Keep-alive anti-hibernação (Render free) ─────────────────────────────
// O Render adormece o serviço após 15 min sem tráfego de ENTRADA.
// Este self-ping à URL pública conta como tráfego e mantém acordado.
// Ativo quando SELF_PING_URL ou RENDER_EXTERNAL_URL existir (produção).
const SELF_PING_URL = (process.env.SELF_PING_URL || process.env.RENDER_EXTERNAL_URL || "").replace(/\/$/, "");
if (SELF_PING_URL) {
  const SELF_PING_INTERVAL = Number(process.env.SELF_PING_INTERVAL_MS || 10 * 60 * 1000);
  setInterval(async () => {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20000);
      try {
        const r = await fetch(`${SELF_PING_URL}/healthz`, { signal: ctrl.signal });
        console.log(`[KEEP-ALIVE] self-ping ${r.status}`);
      } finally { clearTimeout(timer); }
    } catch (e) {
      console.error("[KEEP-ALIVE] falhou:", e.message);
    }
  }, SELF_PING_INTERVAL);
  console.log(`[KEEP-ALIVE] ativo: ${SELF_PING_URL} a cada ${SELF_PING_INTERVAL / 60000} min`);
}

// Expiração de pendentes: 15min (cota Neon mensal) — override via EXPIRY_INTERVAL_MS.
// Fase Cademi-CRM: sem tabelas do ginásio, só payments de compras Cademi.
const EXPIRY_INTERVAL_MS = Number(process.env.EXPIRY_INTERVAL_MS || 15 * 60 * 1000);
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
}, EXPIRY_INTERVAL_MS);

// Auto-sync É-kwanza (pendentes Cademi): 5min — override via AUTOSYNC_INTERVAL_MS.
// O webhook /webhooks/ekwanza continua a atualizar em tempo real; isto é só rede de segurança.
// (o webhook nem sempre dispara; sem isto o estado fica preso em "pendente").
// NOTA: 5min acorda o Neon com frequência — vigiar a cota de 100 CU-h/mês.
let _autoSyncRunning = false;
const AUTOSYNC_INTERVAL_MS = Number(process.env.AUTOSYNC_INTERVAL_MS || 5 * 60 * 1000);
setInterval(async () => {
  if (_autoSyncRunning) return;
  _autoSyncRunning = true;
  try {
    const pend = await pool.query(
      "SELECT code, metadata FROM payments WHERE status = 'pendente' AND created_at > NOW() - INTERVAL '48 hours' ORDER BY created_at DESC LIMIT 15"
    );
    if (pend.rows.length === 0) return;
    let token = null;
    try { token = await getEkwanzaToken(); } catch (e) { console.error("[AUTO-SYNC] token falhou:", e.message); }
    const gpoUrl = (await cfg("ekwanza_gpo_url", process.env.EKWANZA_GPO_URL || "https://gwy-api.appypay.co.ao/v2.0")).replace(/\/$/, "");
    for (const { code, metadata } of pend.rows) {
      // Pendentes WiPay confirmam-se na API WiPay.
      let wid = null;
      try {
        const cm = typeof metadata === "string" ? JSON.parse(metadata) : (metadata || {});
        wid = cm?.wipay_id || null;
      } catch {}
      if (wid) {
        try { await applyWipayConfirm(code, wid); } catch (e) { console.error(`[AUTO-SYNC] ${code} (wipay):`, e.message); }
        await new Promise(r => setTimeout(r, 300));
        continue;
      }
      if (!token) continue;
      try {
        const cr = await fetch(`${gpoUrl}/charges?merchantTransactionId=${encodeURIComponent(code)}`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "User-Agent": "Mozilla/5.0" },
        });
        if (!cr.ok) continue;
        const cj = await cr.json().catch(() => null);
        const ch = cj?.payments?.[0];
        if (!ch?.status) continue;
        const s = String(ch.status).toLowerCase();
        let mapped = null;
        if (["success", "successful", "paid", "completed"].includes(s)) mapped = "confirmado";
        else if (["failed", "fail", "cancelled", "canceled", "expired", "rejected", "error"].includes(s)) mapped = "rejeitado";
        if (!mapped) continue;
        if (mapped === "confirmado") {
          await pool.query("UPDATE payments SET status='confirmado', paid_at=NOW(), reconciled_at=NOW(), updated_at=NOW() WHERE code=$1 AND status='pendente'", [code]);
        } else {
          await pool.query("UPDATE payments SET status='rejeitado', updated_at=NOW() WHERE code=$1 AND status='pendente'", [code]);
        }
        console.log(`[AUTO-SYNC] ${code}: pendente -> ${mapped} (GPO: ${ch.status})`);
        broadcastPaymentUpdate({ type: "payment_updated", code, status: mapped });
        if (mapped === "confirmado") setImmediate(() => sendCademiDelivery(code));
        await new Promise(r => setTimeout(r, 300));
      } catch (e) { console.error(`[AUTO-SYNC] ${code}:`, e.message); }
    }
  } catch (err) {
    console.error("[AUTO-SYNC] Error:", err.message);
  } finally {
    _autoSyncRunning = false;
  }
}, AUTOSYNC_INTERVAL_MS);

// Varrimento Fit90 (landing -> CRM): 5min — override via FIT90_SYNC_INTERVAL_MS.
// A landing grava direto em fit90_leads (Supabase) contornando a Edge Function;
// este job empurra as linhas pushed=false para leads (idempotente por
// external_id) e marca pushed=true. Sem SUPABASE_SERVICE_KEY, fica desligado.
const FIT90_SYNC_INTERVAL_MS = Number(process.env.FIT90_SYNC_INTERVAL_MS || 5 * 60 * 1000);
let _fit90Running = false;
async function syncFit90Leads() {
  const sbUrl = String(process.env.SUPABASE_URL || "https://fslrkrhuatzfqxbzilnd.supabase.co").replace(/\/$/, "");
  const sbKey = String(process.env.SUPABASE_SERVICE_KEY || "");
  if (!sbKey) return { skipped: true };
  const H = { apikey: sbKey, Authorization: `Bearer ${sbKey}`, "Content-Type": "application/json" };
  const get = async (path) => (await (await fetch(`${sbUrl}/rest/v1/${path}`, { headers: H })).json());
  const patch = async (path, body) => (await fetch(`${sbUrl}/rest/v1/${path}`, { method: "PATCH", headers: { ...H, Prefer: "return=representation" }, body: JSON.stringify(body) }));
  const rows = await get("fit90_leads?pushed=eq.false&select=id,name,email,phone,company,source,notes&order=created_at&limit=50");
  if (!Array.isArray(rows) || rows.length === 0) return { pushed: 0 };
  let pushed = 0;
  for (const row of rows) {
    try {
      const name = String(row.name || "").trim();
      if (name.length < 2) continue;
      const extId = String(row.id);
      const exists = await pool.query("SELECT id FROM leads WHERE external_id = $1", [extId]);
      let cid = exists.rows[0]?.id || null;
      if (!cid) {
        const code = "LD-" + Date.now().toString(36).toUpperCase().slice(-6);
        const r = await pool.query(
          `INSERT INTO leads (code, name, email, phone, company, source, status, estimated_value, notes, external_id)
           VALUES ($1,$2,$3,$4,$5,$6,'novo_lead',$7,$8,$9) RETURNING id`,
          [code, name, row.email || null, row.phone || null, row.company || null,
           row.source || "fit90_landing", 0, row.notes || null, extId]);
        cid = r.rows[0].id;
      }
      await patch(`fit90_leads?id=eq.${row.id}`, { pushed: true, pushed_at: new Date().toISOString(), crm_lead_id: String(cid) });
      pushed++;
    } catch (e) { console.error(`[FIT90-SYNC] ${row.id}:`, e.message); }
  }
  if (pushed) console.log(`[FIT90-SYNC] ${pushed} leads landing -> CRM`);
  return { pushed };
}
setInterval(async () => {
  if (_fit90Running) return;
  _fit90Running = true;
  try { await syncFit90Leads(); }
  catch (err) { console.error("[FIT90-SYNC] Error:", err.message); }
  finally { _fit90Running = false; }
}, FIT90_SYNC_INTERVAL_MS);

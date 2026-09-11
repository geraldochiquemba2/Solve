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
      "SELECT DISTINCT customer_id as id_cliente, customer_name as nome FROM solve_access_logs ORDER BY customer_name ASC"
    );
    res.json({ data: result.rows, total: result.rows.length });
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
  app.get("*", (req, res) => {
    if (!req.path.startsWith("/api/") && !req.path.startsWith("/healthz")) {
      res.sendFile(join(staticDir, "index.html"));
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

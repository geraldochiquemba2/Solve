import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createWhatsAppService } from "../whatsapp.js";
import { createAutomationEngine, canonicalTrigger } from "../automation.js";
import { createPortalRoutes } from "../portal.js";

const cfgDefaults = async (_key, fallback) => fallback;
const emptyPool = { query: async () => ({ rows: [] }) };

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return body; },
  };
}

function messagePool() {
  const byIdempotency = new Map();
  const byProvider = new Map();
  let seq = 0;
  const calls = [];
  return {
    calls,
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (/INSERT INTO whatsapp_messages/.test(sql)) {
        const providerId = params[6];
        const idempotencyKey = params[12];
        if (providerId && byProvider.has(providerId)) return { rows: [] };
        if (idempotencyKey && byIdempotency.has(idempotencyKey)) return { rows: [] };
        const row = { id: `w-${++seq}`, status: params[5], provider_message_id: providerId };
        if (providerId) byProvider.set(providerId, row);
        if (idempotencyKey) byIdempotency.set(idempotencyKey, row);
        return { rows: [{ id: row.id }] };
      }
      if (/SELECT id, status, provider_message_id(?:, updated_at)? FROM whatsapp_messages WHERE idempotency_key/.test(sql)) {
        const row = byIdempotency.get(params[0]);
        return { rows: row ? [row] : [] };
      }
      return { rows: [] };
    },
  };
}

test("automation: canonicaliza aliases da UI e aceita eventos canonicos", () => {
  assert.equal(canonicalTrigger("pagamento.confirmado"), "payment_confirmed");
  assert.equal(canonicalTrigger("Lead.Criado"), "lead_created");
  assert.equal(canonicalTrigger("lead.convertido"), "lead_converted");
  assert.equal(canonicalTrigger("subscricao.ativada"), "subscription_activated");
  assert.equal(canonicalTrigger("nps.pedido"), "nps_requested");
  assert.equal(canonicalTrigger("payment_confirmed"), "payment_confirmed");
  assert.equal(canonicalTrigger("evento.desconhecido"), "evento.desconhecido");
});

test("automation: enqueue grava no outbox e ignora eventos desconhecidos", async () => {
  const queries = [];
  const pool = {
    async query(sql, params = []) {
      queries.push({ sql, params });
      if (/INSERT INTO automation_events/.test(sql)) return { rows: [{ id: "evt-1" }] };
      return { rows: [] };
    },
  };
  const engine = createAutomationEngine({ pool, whatsapp: {}, onSyncCademi: async () => ({ ok: true }) });

  const id = await engine.enqueue("pagamento.pendente", { code: "SC1" }, { dedupeKey: "payment_pending:SC1" });
  assert.equal(id, "evt-1");
  assert.equal(await engine.enqueue("evento.desconhecido", {}), null);
  assert.ok(queries.some((q) => q.params[0] === "payment_pending"));
});

test("automation: dry-run nao envia WhatsApp nem altera estado", async () => {
  let sent = 0;
  const engine = createAutomationEngine({
    pool: emptyPool,
    whatsapp: { sendText: async () => { sent += 1; return { ok: true }; } },
    dryRun: true,
  });
  const result = await engine.executeAction(
    { type: "send_whatsapp", params: { message: "Olá" } },
    { id: "evt-1", event_type: "payment_confirmed", payload: { customerId: "c-1", phone: "923456789" }, automation: { id: "a-1" } }
  );
  assert.equal(sent, 0);
  assert.equal(result.dryRun, true);
  assert.ok(result.ok);
});

test("automation: respeita opt-out e envia idempotency key por evento/automacao/acao", async () => {
  let meta = null;
  const optOutPool = {
    async query(sql) {
      if (/SELECT whatsapp_opt_in FROM customers/.test(sql)) return { rows: [{ whatsapp_opt_in: false }] };
      return { rows: [] };
    },
  };
  const engine = createAutomationEngine({
    pool: optOutPool,
    whatsapp: { sendText: async () => { throw new Error("não devia enviar"); } },
  });
  const skipped = await engine.executeAction(
    { type: "send_whatsapp", params: { message: "Olá" } },
    { id: "evt-1", event_type: "payment_confirmed", payload: { customerId: "c-1", phone: "923456789" }, automation: { id: "a-1" } }
  );
  assert.match(skipped.skipped, /consentimento/);

  const allowPool = {
    async query(sql) {
      if (/SELECT whatsapp_opt_in FROM customers/.test(sql)) return { rows: [{ whatsapp_opt_in: true }] };
      return { rows: [] };
    },
  };
  const allow = createAutomationEngine({
    pool: allowPool,
    whatsapp: { sendText: async (_to, _body, m) => { meta = m; return { ok: true, id: "wamid" }; } },
  });
  await allow.executeAction(
    { type: "send_whatsapp", params: { message: "Olá {{customerName}}" } },
    { id: "evt-9", event_type: "payment_confirmed", payload: { customerId: "c-1", customerName: "Ana", phone: "923456789" }, automation: { id: "a-7" }, actionIndex: 2 }
  );
  assert.equal(meta.idempotencyKey, "automation:evt-9:a-7:2");
  assert.equal(meta.sourceEvent, "payment_confirmed");
});

test("whatsapp: valida assinatura HMAC e challenge sem expor segredos", async () => {
  const env = {
    WHATSAPP_TOKEN: "token",
    WHATSAPP_PHONE_NUMBER_ID: "123456789",
    WHATSAPP_VERIFY_TOKEN: "verify",
    WHATSAPP_APP_SECRET: "app-secret",
  };
  const fetchImpl = async () => jsonResponse(200, {
    verified_name: "SamoraFit",
    display_phone_number: "+244 923 000 000",
    quality_rating: "GREEN",
    status: "CONNECTED",
  });
  const svc = createWhatsAppService({ pool: emptyPool, cfg: cfgDefaults, env, fetchImpl });
  const raw = Buffer.from('{"entry":[]}');
  const signature = `sha256=${crypto.createHmac("sha256", "app-secret").update(raw).digest("hex")}`;

  assert.equal(await svc.verifySignature(raw, signature), true);
  assert.equal(await svc.verifySignature(raw, "sha256=deadbeef"), false);
  assert.equal(await svc.verifySignature(raw, undefined), false);
  assert.equal(await svc.verifyChallenge("subscribe", "verify"), true);
  assert.equal(await svc.verifyChallenge("subscribe", "errado"), false);

  const health = await svc.health({ force: true });
  assert.equal(health.configured, true);
  assert.equal(health.connected, true);
  assert.equal(health.status, "operacional");
  assert.ok(health.phoneNumberId.includes("***"));
  assert.equal(JSON.stringify(health).includes("token"), false);
});

test("whatsapp: sem credenciais nao chama a Meta e reporta nao_configurado", async () => {
  let calls = 0;
  const svc = createWhatsAppService({
    pool: emptyPool,
    cfg: cfgDefaults,
    env: {},
    fetchImpl: async () => { calls += 1; return jsonResponse(200, {}); },
  });
  const health = await svc.health({ force: true });
  assert.equal(health.status, "nao_configurado");
  assert.equal(health.connected, false);
  assert.equal(calls, 0);
});

test("whatsapp: 401 da Meta classifica erro_autenticacao sem marcar operacional", async () => {
  const svc = createWhatsAppService({
    pool: emptyPool,
    cfg: cfgDefaults,
    env: { WHATSAPP_TOKEN: "token", WHATSAPP_PHONE_NUMBER_ID: "123" },
    fetchImpl: async () => jsonResponse(401, { error: { code: 190, message: "Invalid OAuth access token" } }),
  });
  const health = await svc.health({ force: true });
  assert.equal(health.connected, false);
  assert.equal(health.status, "erro_autenticacao");
});

test("whatsapp: sendText normaliza telefone, envia payload e nao duplica idempotente", async () => {
  const pool = messagePool();
  let fetchCalls = 0;
  let payload = null;
  const svc = createWhatsAppService({
    pool,
    cfg: cfgDefaults,
    env: { WHATSAPP_TOKEN: "token", WHATSAPP_PHONE_NUMBER_ID: "123", WHATSAPP_APP_SECRET: "s" },
    fetchImpl: async (_url, options) => {
      fetchCalls += 1;
      payload = JSON.parse(options.body);
      return jsonResponse(200, { messages: [{ id: "wamid.1" }] });
    },
  });
  const first = await svc.sendText("923456789", "Olá", { idempotencyKey: "idem-1" });
  assert.equal(first.ok, true);
  assert.equal(first.id, "wamid.1");
  assert.equal(payload.to, "244923456789");
  assert.equal(payload.type, "text");
  assert.equal(fetchCalls, 1);

  const second = await svc.sendText("923456789", "Olá", { idempotencyKey: "idem-1" });
  assert.equal(second.duplicate, true);
  assert.equal(fetchCalls, 1);
});

test("whatsapp: falha da Meta guarda erro e devolve codigo", async () => {
  const pool = messagePool();
  const svc = createWhatsAppService({
    pool,
    cfg: cfgDefaults,
    env: { WHATSAPP_TOKEN: "token", WHATSAPP_PHONE_NUMBER_ID: "123" },
    fetchImpl: async () => jsonResponse(401, { error: { code: 190, message: "Invalid token" } }),
  });
  const result = await svc.sendText("923456789", "Olá", { idempotencyKey: "idem-fail" });
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, "190");
  assert.ok(pool.calls.some((c) => /status='failed'/.test(c.sql) && c.params[2] === "190"));
});

test("whatsapp: timeout de rede devolve erro_conectividade", async () => {
  const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
  const svc = createWhatsAppService({
    pool: messagePool(),
    cfg: cfgDefaults,
    env: { WHATSAPP_TOKEN: "token", WHATSAPP_PHONE_NUMBER_ID: "123" },
    fetchImpl: async () => { throw abort; },
  });
  const result = await svc.sendText("923456789", "Olá");
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, "timeout");
});

test("whatsapp: webhook inbound e idempotente e atualiza estados", async () => {
  const seen = new Set();
  const calls = [];
  const pool = {
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (/INSERT INTO whatsapp_messages/.test(sql)) {
        if (seen.has(params[6])) return { rows: [] };
        seen.add(params[6]);
        return { rows: [{ id: "w-1" }] };
      }
      return { rows: [] };
    },
  };
  const svc = createWhatsAppService({ pool, cfg: cfgDefaults, env: {} });
  const payload = {
    entry: [{
      changes: [{
        value: {
          contacts: [{ wa_id: "244923456789", profile: { name: "Ana" } }],
          messages: [{ from: "244923456789", id: "wamid.in.1", type: "text", text: { body: "Olá" } }],
          statuses: [{ id: "wamid.out.1", status: "delivered" }],
        },
      }],
    }],
  };
  const first = await svc.processWebhook(payload);
  assert.equal(first.inbound, 1);
  assert.equal(first.duplicates, 0);
  assert.equal(first.statuses, 1);
  const second = await svc.processWebhook(payload);
  assert.equal(second.inbound, 0);
  assert.equal(second.duplicates, 1);
  assert.ok(calls.some((c) => /WHEN \$2 = 'read'/.test(c.sql)));
});

test("portal: regista rotas e devolve resposta generica para telefone sem cliente", async () => {
  const routes = [];
  const uses = [];
  const app = {
    use(path, handler) { uses.push({ path, handler }); },
    get(path, handler) { routes.push({ method: "GET", path, handler }); },
    post(path, ...args) { routes.push({ method: "POST", path, handler: args.at(-1) }); },
  };
  let otpSent = 0;
  const pool = { query: async () => ({ rows: [] }) };
  const portal = createPortalRoutes({
    app,
    pool,
    jwt: { verify() { return {}; }, sign() { return "jwt"; } },
    jwtSecret: "segredo",
    whatsapp: { sendOtp: async () => { otpSent += 1; return { ok: true }; } },
    automation: { enqueue: async () => null },
    rateLimit: () => (_req, _res, next) => next(),
    rateLimitBy: () => (_req, _res, next) => next(),
    ensurePromoSchema: async () => {},
    validatePromo: async () => ({ valid: false }),
    promoUserKey: () => "chave",
    fireEkwanzaCharge: async () => ({ ok: true }),
    kickCademiDelivery: () => {},
    cfg: cfgDefaults,
    audit: () => {},
  });

  await portal.ensureSchema();
  assert.ok(uses.some((u) => u.path === "/api/v1/portal"));
  assert.ok(routes.some((r) => r.method === "POST" && r.path === "/api/v1/portal/otp/request"));
  assert.ok(routes.some((r) => r.method === "POST" && r.path === "/api/v1/portal/otp/verify"));
  assert.ok(routes.some((r) => r.method === "POST" && r.path === "/api/v1/portal/logout"));
  assert.ok(routes.some((r) => r.method === "GET" && r.path === "/api/v1/portal/minha-conta"));
  assert.ok(routes.some((r) => r.method === "GET" && r.path === "/api/v1/portal/pagamentos"));
  assert.ok(routes.some((r) => r.method === "POST" && r.path === "/api/v1/portal/pagar"));
  assert.ok(routes.some((r) => r.method === "GET" && r.path === "/api/v1/portal/recibos/:id"));

  const requestRoute = routes.find((r) => r.method === "POST" && r.path === "/api/v1/portal/otp/request");
  let status = 200;
  let body = null;
  const res = {
    set() { return res; },
    status(code) { status = code; return res; },
    json(value) { body = value; return res; },
  };
  await requestRoute.handler({ body: { phone: "923456789" }, headers: {}, ip: "127.0.0.1" }, res);
  assert.equal(status, 200);
  assert.deepEqual(body, { data: { ok: true, expiresIn: 300 } });
  assert.equal(otpSent, 0);

  status = 200;
  body = null;
  await requestRoute.handler({ body: { phone: "123" }, headers: {}, ip: "127.0.0.1" }, res);
  assert.equal(status, 400);
  assert.ok(body.error);

  const logout = routes.find((r) => r.method === "POST" && r.path === "/api/v1/portal/logout");
  status = 200;
  body = null;
  await logout.handler({}, res);
  assert.deepEqual(body, { data: { ok: true } });
});

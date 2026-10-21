import test from "node:test";
import assert from "node:assert/strict";
import { registerStudioIntegration } from "../studio-integration.js";

const PREFIX = "/api/v1/integrations/samorafit-studio";

function setup() {
  const routes = new Map();
  const app = {
    get(path, ...handlers) { routes.set(`GET ${path}`, handlers); },
    post(path, ...handlers) { routes.set(`POST ${path}`, handlers); },
    delete(path, ...handlers) { routes.set(`DELETE ${path}`, handlers); },
  };
  const queries = [];
  const pool = {
    async query(sql, params) {
      queries.push({ sql, params });
      return { rows: [] };
    },
  };
  registerStudioIntegration(app, {
    pool,
    requireAuth: (_req, _res, next) => next(),
    requireRole: () => (_req, _res, next) => next(),
    rateLimit: () => (_req, _res, next) => next(),
    audit: () => {},
  });
  return { routes, queries };
}

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    end() { return this; },
  };
}

test("studio: regista os endpoints de ingestão e de leitura", () => {
  const { routes } = setup();
  for (const [method, path] of [
    ["POST", `${PREFIX}/sync`],
    ["POST", `${PREFIX}/events`],
    ["GET", `${PREFIX}/status`],
    ["GET", `${PREFIX}/overview`],
    ["GET", `${PREFIX}/snapshot`],
    ["GET", `${PREFIX}/customers`],
    ["GET", `${PREFIX}/plans`],
    ["GET", `${PREFIX}/subscriptions`],
    ["GET", `${PREFIX}/payments`],
    ["GET", `${PREFIX}/invoices`],
    ["GET", `${PREFIX}/refunds`],
    ["GET", `${PREFIX}/sync-log`],
    ["GET", `${PREFIX}/keys`],
    ["POST", `${PREFIX}/keys`],
    ["DELETE", `${PREFIX}/keys/:id`],
  ]) {
    assert.ok(routes.has(`${method} ${path}`), `falta ${method} ${path}`);
  }
});

test("studio: exige API Key e aceita o fallback STUDIO_API_KEY", async () => {
  const original = process.env.STUDIO_API_KEY;
  process.env.STUDIO_API_KEY = "sfs_test_key";
  try {
    const { routes } = setup();
    const handlers = routes.get(`POST ${PREFIX}/events`);
    const requireKey = handlers[1];

    const semChave = response();
    let chamouNext = false;
    await requireKey({ headers: {} }, semChave, () => { chamouNext = true; });
    assert.equal(semChave.statusCode, 401);
    assert.equal(chamouNext, false);

    const req = { headers: { "x-api-key": "sfs_test_key" } };
    const comChave = response();
    await requireKey(req, comChave, () => { chamouNext = true; });
    assert.equal(chamouNext, true);
    assert.equal(req.studioKey.id, "env");
  } finally {
    if (original === undefined) delete process.env.STUDIO_API_KEY;
    else process.env.STUDIO_API_KEY = original;
  }
});

test("studio: evento upsert grava o cliente e o log", async () => {
  const { routes, queries } = setup();
  const handler = routes.get(`POST ${PREFIX}/events`).at(-1);
  const res = response();
  await handler({
    headers: {},
    body: {
      event: "customer.created",
      data: { external_id: "42", full_name: "Ana Silva", phone: "+244900000000" },
    },
  }, res, (err) => { throw err; });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.upserted, 1);
  assert.equal(res.body.entity, "customers");
  assert.equal(res.body.external_id, "42");
  assert.ok(queries.some(q => /INSERT INTO studio_customers/.test(q.sql)));
  assert.ok(queries.some(q => /INSERT INTO studio_sync_log/.test(q.sql)));
});

test("studio: evento deleted inactiva o cliente", async () => {
  const { routes, queries } = setup();
  const handler = routes.get(`POST ${PREFIX}/events`).at(-1);
  const res = response();
  await handler({
    headers: {},
    body: { event: "customer.deleted", data: { external_id: "42" } },
  }, res, (err) => { throw err; });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.deleted, true);
  assert.ok(queries.some(q => /UPDATE studio_customers SET status='INACTIVE'/.test(q.sql)));
});

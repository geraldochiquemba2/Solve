// Harness de regressão de segurança — timing de login + limite por conta.
// Extrai o código real de standalone-server/index.js e executa-o com
// bcrypt/pool/ambiente simulados (bcrypt com custo constante e configurável
// para medir a diferença de tempo entre os caminhos).
//
// Invariantes:
//  1. Email inexistente e password errada custam o mesmo (bcrypt), para não
//     enumerar contas pela latência.
//  2. O limite de recuperação é por conta, não só por IP.
//  3. A resposta de "email não existe" continua a ser a genérica.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const SRC = path.resolve(process.argv[2] ?? "standalone-server/index.js");
const code = fs.readFileSync(SRC, "utf8");

const JWT_SECRET = "segredo-de-teste";
const SALT_ROUNDS = 10;
const BCRYPT_MS = Number(process.env.HARNESS_BCRYPT_MS ?? 25);

// ── extracção ─────────────────────────────────────────────────────────────
const rlStart = code.indexOf("const _hits = new Map();");
const rlEnd = code.indexOf('const CORS_ORIGIN =');
if (rlStart < 0 || rlEnd < 0) throw new Error("bloco de rate limiting não encontrado");
const rlBlock = code.slice(rlStart, rlEnd);

const dummyStart = code.indexOf("let _dummyHashPromise = null;");
const dummyEnd = code.indexOf('const CORS_ORIGIN =');
const dummyBlock = code.slice(dummyStart, dummyEnd);

const loginStart = code.indexOf('app.post("/api/v1/auth/login"');
const loginEnd = code.indexOf("\n});", loginStart);
const loginArrow = code.slice(loginStart, loginEnd)
  .replace(/^app\.post\([^,]+,/, "")           // tira app.post(
  .replace(/^\s*rateLimit\(20\),/, "")        // tira o rateLimit já aplicado
  .trim() + "}";                              // o "});" final também fecha a arrow

const forgotStart = code.indexOf('app.post("/api/v1/auth/forgot-password"');
const forgotEnd = code.indexOf("\n});", forgotStart);
const forgotBlock = code.slice(forgotStart, forgotEnd);

// invariantes no código-fonte
if (!/await bcrypt\.compare\(password, await dummyPasswordHash\(\)\)/.test(code)) {
  throw new Error("REGRESSÃO: o caminho de conta inexistente deixou de pagar o bcrypt");
}
if (!/rateLimitBy\(5, 15 \* 60 \* 1000/.test(code)) {
  throw new Error("REGRESSÃO: o limite por conta no forgot-password desapareceu");
}

// ── doubles ───────────────────────────────────────────────────────────────
const bcryptMock = {
  async compare(_p, _h) { await sleep(BCRYPT_MS); return false; },
  async hash(_p, _r) { await sleep(BCRYPT_MS); return "hash-gerado"; },
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function makePool(user) {
  return {
    async query(sql, params = []) {
      if (/FROM users WHERE LOWER\(email\)/i.test(sql)) return { rows: user ? [user] : [] };
      if (/FROM users WHERE phone/i.test(sql)) return { rows: user ? [user] : [] };
      if (/UPDATE users SET last_login_at/.test(sql)) return { rows: [] };
      if (/FROM users WHERE id = \$1/.test(sql)) return { rows: user ? [{ id: user.id }] : [] };
      if (/INSERT INTO settings/.test(sql)) return { rows: [] };
      return { rows: [] };
    },
  };
}

const REAL_USER = {
  id: 1, name: "Ana", email: "ana@solve.ao", role: "gestor",
  active: true, password_hash: "hash", phone: "+244900000000",
};

function buildLogin(pool) {
  return new Function(
    "bcrypt", "crypto", "pool", "jwt", "JWT_SECRET", "JWT_EXPIRES_IN", "SALT_ROUNDS",
    "res_cookie", "getSessionEpoch", "res_cookie_csrf", "CSRF_COOKIE", "csrfCookieOptions",
    "issueCsrfToken",
    `${dummyBlock}\nreturn (${loginArrow});`
  )(
    bcryptMock, crypto, pool,
    { sign: () => "jwt-assinado" },
    JWT_SECRET, "24h", SALT_ROUNDS,
    () => {}, async () => "", () => {}, "csrf", () => ({}), () => "csrf-token"
  );
}

function call(handler, req) {
  const out = { status: 200, body: null };
  const res = {
    status: (s) => ((out.status = s), res),
    json: (b) => ((out.body = b), res),
    cookie: () => res,
    clearCookie: () => res,
  };
  return handler(req, res).then(() => out);
}

function measure(fn, n = 12) {
  const times = [];
  return (async () => {
    for (let i = 0; i < n; i++) {
      const t0 = process.hrtime.bigint();
      await fn();
      times.push(Number(process.hrtime.bigint() - t0) / 1e6);
    }
    times.sort((a, b) => a - b);
    return times[Math.floor(n / 2)];
  })();
}

// ── matriz ────────────────────────────────────────────────────────────────
const cases = [];
const assert = (c, m) => { if (!c) throw new Error(m); };
const check = async (nome, fn) => {
  try { await fn(); cases.push({ nome, ok: true }); }
  catch (e) { cases.push({ nome, ok: false, erro: e.message }); }
};

const semUtilizador = buildLogin(makePool(null));
const comUtilizador = buildLogin(makePool(REAL_USER));

// A. comportamento
await check("conta inexistente -> 401 com mensagem genérica", async () => {
  const r = await call(semUtilizador, { body: { email: "ninguem@solve.ao", password: "x" } });
  assert(r.status === 401, `esperado 401, obtido ${r.status}`);
  assert(r.body.error === "Credenciais inválidas", `mensagem: ${r.body.error}`);
});

await check("conta existente + password errada -> 401 com a MESMA mensagem", async () => {
  const r = await call(comUtilizador, { body: { email: REAL_USER.email, password: "errada" } });
  assert(r.status === 401, `esperado 401, obtido ${r.status}`);
  assert(r.body.error === "Credenciais inválidas", `mensagem: ${r.body.error}`);
});

await check("conta desactivada continua a devolver 403 (comportamento existente preservado)", async () => {
  const inativo = buildLogin(makePool({ ...REAL_USER, active: false }));
  const r = await call(inativo, { body: { email: REAL_USER.email, password: "x" } });
  assert(r.status === 403, `esperado 403, obtido ${r.status}`);
});

await check("pedido sem password -> 400 antes de tocar na BD", async () => {
  const r = await call(semUtilizador, { body: { email: "a@b.ao" } });
  assert(r.status === 400, `esperado 400, obtido ${r.status}`);
});

// B. equalização de tempo
await check(`tempo de "conta inexistente" ≈ "password errada" (bcrypt=${BCRYPT_MS}ms)`, async () => {
  const semConta = await measure(() => call(semUtilizador, { body: { email: "ninguem@solve.ao", password: "x" } }));
  const comPassErrada = await measure(() => call(comUtilizador, { body: { email: REAL_USER.email, password: "x" } }));
  const razao = semConta / Math.max(comPassErrada, 0.001);
  assert(razao > 0.7 && razao < 1.4,
    `tempos muito diferentes: inexistente ${semConta.toFixed(1)}ms vs password errada ${comPassErrada.toFixed(1)}ms (rácio ${razao.toFixed(2)})`);
});

await check("o caminho de conta inexistente chama mesmo o bcrypt (comparação/hashSpy)", async () => {
  let calls = 0;
  const spy = {
    async compare() { calls++; await sleep(1); return false; },
    async hash() { calls++; await sleep(1); return "h"; },
  };
  const h = new Function("bcrypt", "crypto", "pool", "jwt", "JWT_SECRET", "JWT_EXPIRES_IN", "SALT_ROUNDS",
    "res_cookie", "getSessionEpoch", "res_cookie_csrf", "CSRF_COOKIE", "csrfCookieOptions", "issueCsrfToken",
    `${dummyBlock}\nreturn (${loginArrow});`)(
      spy, crypto, makePool(null), { sign: () => "t" }, JWT_SECRET, "24h", SALT_ROUNDS,
      () => {}, async () => "", () => {}, "csrf", () => ({}), () => "c"
    );
  await call(h, { body: { email: "ninguem@solve.ao", password: "x" } });
  assert(calls >= 1, `bcrypt nunca foi chamado (${calls})`);
});

// C. limite por conta no forgot-password
await check("o limite por conta está ligado ao email normalizado", () => {
  assert(/String\(req\.body\?\.email \|\| ""\)\.trim\(\)\.toLowerCase\(\) \|\| null/.test(forgotBlock),
    "a chave do limite não normaliza o email");
});

await check("pedido sem email não é bloqueado pelo limite por conta", () => {
  const bloco = forgotBlock;
  assert(/rateLimitBy\(5, 15 \* 60 \* 1000, \(req\) => String\(req\.body\?\.email \|\| ""\)/.test(bloco),
    "o limite por conta não devolve null sem email");
});

// o rateLimitBy REAL, extraído do ficheiro, exercitado de facto
await check("rateLimitBy real: 5 pedidos passam, o 6º dá 429; outra conta passa", async () => {
  // os parâmetros e a chave são os mesmos que estão na rota (verificado abaixo)
  const args = /rateLimitBy\(\s*(\d+)\s*,\s*([0-9]+)\s*\*\s*([0-9]+)\s*\*\s*([0-9]+)/.exec(code);
  assert(args, "não consegui ler os parâmetros de rateLimitBy da rota");
  const max = Number(args[1]);
  const janela = Number(args[2]) * Number(args[3]) * Number(args[4]);
  assert(max === 5 && janela === 15 * 60 * 1000, `parâmetros na rota: ${max} por ${janela}ms`);

  const { rateLimitBy } = new Function(`${rlBlock}\nreturn { rateLimitBy };`)();
  const keyFn = (req) => String(req.body?.email || "").trim().toLowerCase() || null;
  const limiter = rateLimitBy(max, janela, keyFn, "Demasiados pedidos de recuperação para esta conta.");

  const pedir = (email) => {
    const out = { status: 200, nexted: false };
    const res = { status: (s) => ((out.status = s), res), json: () => res };
    limiter({ body: email === null ? {} : { email } }, res, () => { out.nexted = true; });
    return out;
  };

  for (let i = 0; i < max; i++) {
    const r = pedir("ana@solve.ao");
    assert(r.nexted === true, `pedido ${i + 1} foi bloqueado (${r.status})`);
  }
  const sexto = pedir("ana@solve.ao");
  assert(sexto.status === 429 && !sexto.nexted, `o ${max + 1}º devia dar 429, deu ${sexto.status}`);
  const outra = pedir("bruno@solve.ao");
  assert(outra.nexted === true, "outra conta ficou bloqueada indevidamente");

  // normalização: " Ana@Solve.AO " conta como a mesma conta
  const comEspacos = pedir("  Ana@Solve.AO  ");
  assert(comEspacos.status === 429, "a chave do limite não normaliza o email");
});

await check("rateLimitBy real: sem email não bloqueia (não dá para enumerar)", async () => {
  const { rateLimitBy } = new Function(`${rlBlock}\nreturn { rateLimitBy };`)();
  const limiter = rateLimitBy(1, 15 * 60 * 1000, (req) => String(req.body?.email || "").trim().toLowerCase() || null);
  for (let i = 0; i < 5; i++) {
    const out = { status: 200, nexted: false };
    const res = { status: (s) => ((out.status = s), res), json: () => res };
    limiter({ body: {} }, res, () => { out.nexted = true; });
    assert(out.nexted === true, `pedido sem email ${i + 1} foi bloqueado`);
  }
});

// ── resultado ─────────────────────────────────────────────────────────────
let ok = 0;
let ko = 0;
console.log(`\n  Harness: timing de login + limite por conta (de ${path.basename(SRC)})\n`);
for (const c of cases) {
  console.log(`  ${c.ok ? "OK   " : "FALHA"} ${c.nome}`);
  if (!c.ok) console.log(`           -> ${c.erro}`);
  c.ok ? ok++ : ko++;
}
console.log(`\n  ${ok} OK, ${ko} FALHA\n`);
process.exit(ko === 0 ? 0 : 1);

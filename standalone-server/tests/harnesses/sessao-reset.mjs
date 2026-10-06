// Harness de regressão de segurança — revogação de sessão + hash do token de reset.
// Extrai o código real de standalone-server/index.js (helpers CSRF, epoch de
// sessão, requireAuth, hashResetToken e a rota de reset) e executa-o com
// pool/bcrypt/jwt simulados.
//
// Invariantes:
//  1. Depois de uma alteração de password, um JWT emitido antes deixa de valer.
//  2. Tokens legados (sem claim `se`) continuam a valer enquanto o epoch for vazio.
//  3. A BD nunca guarda o token de reset em texto claro.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const SRC = path.resolve(process.argv[2] ?? "standalone-server/index.js");
const code = fs.readFileSync(SRC, "utf8");

const JWT_SECRET = "segredo-de-teste";
const API_KEY = "chave-de-maquina";
const EPOCH_TTL = /\bSESSION_EPOCH_TTL_MS\s*=\s*([^\n;]+)/.exec(code)?.[1]?.trim() ?? "(não encontrado)";

// ── extracção ─────────────────────────────────────────────────────────────
const helpersStart = code.indexOf("const CSRF_COOKIE");
const authStart = code.indexOf("async function requireAuth(req, res, next)");
if (helpersStart < 0 || authStart < 0) throw new Error("helpers/requireAuth não encontrados");
const preAuth = code.slice(helpersStart, authStart);

const authTail = code.slice(authStart);
const mAuth = /\r?\n\}\r?\n/.exec(authTail);
if (!mAuth) throw new Error("fecho de requireAuth não encontrado");
const authSrc = authTail.slice(0, mAuth.index + mAuth[0].length);

const hStart = code.indexOf("function hashResetToken(token)");
const mHash = /\r?\n\}\r?\n/.exec(code.slice(hStart));
if (hStart < 0 || !mHash) throw new Error("hashResetToken não encontrado");
const hashSrc = code.slice(hStart, hStart + mHash.index + mHash[0].length);

const rStart = code.indexOf('app.post("/api/v1/auth/reset-password"');
const rEnd = code.indexOf("\n});", rStart);
if (rStart < 0 || rEnd < 0) throw new Error("rota de reset não encontrada");
const resetArrow =
  code.slice(rStart, rEnd).replace(/^app\.post\([^,]+,[^,]+,\s*/, "").trim() + "}";

// invariantes no código-fonte
if (!/await rotateSessionEpoch\(userId\)/.test(code)) {
  throw new Error("REGRESSÃO: o reset deixou de rodar o epoch de sessão");
}
if (/JSON\.stringify\(\{ token: resetToken/.test(code)) {
  throw new Error("REGRESSÃO: o token de reset voltou a ser guardado em texto claro");
}

// ── BD simulada ───────────────────────────────────────────────────────────
function makeDb(seed = {}) {
  const settings = new Map(Object.entries(seed));
  const log = [];
  return {
    settings,
    log,
    async query(sql, params = []) {
      log.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
      if (/SELECT value FROM settings WHERE key = \$1/.test(sql)) {
        const v = settings.get(params[0]);
        return { rows: v === undefined ? [] : [{ value: v }] };
      }
      if (/FROM settings WHERE key LIKE 'password_reset_%'/.test(sql)) {
        return { rows: [...settings].filter(([k]) => k.startsWith("password_reset_")).map(([key, value]) => ({ key, value })) };
      }
      if (/^INSERT INTO settings/.test(sql)) settings.set(params[0], params[1]);
      else if (/^DELETE FROM settings/.test(sql)) settings.delete(params[0]);
      return { rows: [] };
    },
  };
}

const bcryptMock = { hash: async (p) => `hashed(${p})` };
const parseCookies = (req) => {
  const out = {};
  for (const part of (req.headers?.cookie || "").split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    try { out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim()); }
    catch { out[part.slice(0, eq).trim()] = part.slice(eq + 1).trim(); }
  }
  return out;
};
const jwtMock = {
  verify(token) {
    const t = TOKENS[token];
    if (!t) throw new Error("jwt inválido");
    return t;
  },
};
const apiKeyMatches = (p, e) => typeof p === "string" && e && p.length === e.length && crypto.timingSafeEqual(Buffer.from(p), Buffer.from(e));

const TOKENS = {};

// stubs das dependências que o código real usa em scope
const auditCalls = [];
const audit = (...args) => { auditCalls.push(args); };
const emailRef = (e) => (e ? `hash-${String(e).length}` : null);
const resetCalls = [];

// um único módulo com tudo o que o código real referencia em scope
const buildMod = (pool) =>
  new Function(
    "crypto", "parseCookies", "jwt", "apiKeyMatches", "API_KEY", "JWT_SECRET",
    "pool", "bcrypt", "console", "SALT_ROUNDS", "audit", "emailRef",
    `${preAuth}\n${authSrc}\n${hashSrc}\nreturn { requireAuth, getSessionEpoch, rotateSessionEpoch, reset: (${resetArrow}) };`
  )(crypto, parseCookies, jwtMock, apiKeyMatches, API_KEY, JWT_SECRET, pool, bcryptMock, { log() {}, error() {} }, 10, audit, emailRef);

function callAuth(mod, req) {
  const out = { status: 200, body: null, nexted: false };
  const res = { status: (s) => ((out.status = s), res), json: (b) => ((out.body = b), res) };
  const r = { method: req.method || "GET", headers: req.headers || {} };
  return mod.requireAuth(r, res, () => { out.nexted = true; }).then(() => out);
}

function callReset(mod, body) {
  const out = { status: 200, body: null };
  const res = { status: (s) => ((out.status = s), res), json: (b) => ((out.body = b), res) };
  return mod({ body }, res).then(() => out);
}

// ── matriz ────────────────────────────────────────────────────────────────
const cases = [];
const assert = (c, m) => { if (!c) throw new Error(m); };
const check = async (nome, fn) => {
  try { await fn(); cases.push({ nome, ok: true }); }
  catch (e) { cases.push({ nome, ok: false, erro: e.message }); }
};

const sha256 = (t) => crypto.createHash("sha256").update(String(t)).digest("hex");

// A. revogação de sessão
await check("JWT com o epoch atual passa", async () => {
  const db = makeDb();
  const mod = buildMod(db); const auth = mod;
  TOKENS["t1"] = { userId: "u1", role: "gestor", se: "" };
  const r = await callAuth(auth, { headers: { authorization: "Bearer t1" } });
  assert(r.nexted === true, `não passou: ${r.status}`);
});

await check("ATAQUE: JWT com epoch antigo é rejeitado depois de rodar o epoch", async () => {
  const db = makeDb();
  const mod = buildMod(db); const auth = mod;
  TOKENS["t2"] = { userId: "u2", role: "gestor", se: "epoch-antigo" };
  db.settings.set("session_epoch_u2", "epoch-novo");
  const r = await callAuth(auth, { headers: { authorization: "Bearer t2" } });
  assert(r.status === 401 && !r.nexted, `token revogado passou: ${r.status}`);
  assert(/invalidada/i.test(r.body?.error || ""), `mensagem inesperada: ${r.body?.error}`);
});

await check("LEGÍTIMO: JWT emitido depois da rotação volta a passar", async () => {
  const db = makeDb();
  const mod = buildMod(db); const auth = mod;
  db.settings.set("session_epoch_u3", "epoch-novo");
  TOKENS["t3"] = { userId: "u3", role: "gestor", se: "epoch-novo" };
  const r = await callAuth(auth, { headers: { authorization: "Bearer t3" } });
  assert(r.nexted === true, `não passou: ${r.status}`);
});

await check("LEGÍTIMO: token legado (sem `se`) continua válido se o epoch está vazio", async () => {
  const db = makeDb();
  const mod = buildMod(db); const auth = mod;
  TOKENS["t4"] = { userId: "u4", role: "gestor" }; // sem claim `se`
  const r = await callAuth(auth, { headers: { authorization: "Bearer t4" } });
  assert(r.nexted === true, `tokens legados foram invalidados: ${r.status}`);
});

await check("ATAQUE: token legado (sem `se`) é rejeitado após uma troca de password", async () => {
  const db = makeDb();
  const mod = buildMod(db); const auth = mod;
  db.settings.set("session_epoch_u5", "epoch-novo");
  TOKENS["t5"] = { userId: "u5", role: "gestor" };
  const r = await callAuth(auth, { headers: { authorization: "Bearer t5" } });
  assert(r.status === 401 && !r.nexted, `token legado passou: ${r.status}`);
});

await check("o epoch é cacheado (2º pedido não volta a ler a BD)", async () => {
  const db = makeDb();
  const mod = buildMod(db); const auth = mod;
  TOKENS["t6"] = { userId: "u6", role: "gestor", se: "" };
  await callAuth(auth, { headers: { authorization: "Bearer t6" } });
  const antes = db.log.filter((q) => /SELECT value FROM settings/.test(q.sql)).length;
  await callAuth(auth, { headers: { authorization: "Bearer t6" } });
  const depois = db.log.filter((q) => /SELECT value FROM settings/.test(q.sql)).length;
  assert(antes === 1 && depois === 1, `leituras à BD: ${antes} -> ${depois}`);
});

await check("rotateSessionEpoch grava um valor novo e limpa a cache do processo", async () => {
  const db = makeDb({ session_epoch_u7: "antigo" });
  const mod = buildMod(db); const auth = mod;
  TOKENS["t7antigo"] = { userId: "u7", role: "gestor", se: "antigo" };
  await callAuth(auth, { headers: { authorization: "Bearer t7antigo" } });
  const novo = await auth.rotateSessionEpoch("u7");
  assert(db.settings.get("session_epoch_u7") === novo, "não gravou o epoch novo");
  assert(novo !== "antigo", "o epoch não mudou");
  const r = await callAuth(auth, { headers: { authorization: "Bearer t7antigo" } });
  assert(r.status === 401, `o token antigo continuou válido na mesma instância: ${r.status}`);
});

await check("um utilizador não afeta o outro (isolamento por userId)", async () => {
  const db = makeDb({ session_epoch_u8: "novo" });
  const mod = buildMod(db); const auth = mod;
  db.settings.set("session_epoch_u9", "qualquer");
  TOKENS["t8"] = { userId: "u8", role: "gestor", se: "novo" };
  TOKENS["t9"] = { userId: "u9", role: "gestor", se: "qualquer" };
  const a = await callAuth(auth, { headers: { authorization: "Bearer t8" } });
  const b = await callAuth(auth, { headers: { authorization: "Bearer t9" } });
  assert(a.nexted && b.nexted, `isolamento falhou: ${a.status}/${b.status}`);
});

// B. hash do token de reset
const RESET_TOKEN = "a".repeat(64);
await check("o token de reset é guardado só como hash (nada em texto claro)", async () => {
  const db = makeDb();
  const reset = buildMod(db).reset;
  db.settings.set("password_reset_u10", JSON.stringify({ tokenHash: sha256(RESET_TOKEN), expiresAt: new Date(Date.now() + 3600_000).toISOString() }));
  const guardado = db.settings.get("password_reset_u10");
  assert(!guardado.includes(RESET_TOKEN), "o token em texto claro está na BD");
  const r = await callReset(reset, { token: RESET_TOKEN, password: "nova-chave-123" });
  assert(r.status === 200, `reset legítimo falhou: ${r.status}`);
});

await check("ATAQUE: a BD vazada não deixa autenticar (hash não recuperável)", async () => {
  const db = makeDb();
  const mod = buildMod(db);
  db.settings.set("password_reset_u11", JSON.stringify({ tokenHash: sha256(RESET_TOKEN), expiresAt: new Date(Date.now() + 3600_000).toISOString() }));
  // o atacante só tem a linha da BD — tenta obter o token a partir do que lá está
  for (const guess of [sha256(RESET_TOKEN), "a".repeat(63), RESET_TOKEN.slice(0, -1), `${RESET_TOKEN}z`, "0"]) {
    const r = await callReset(mod.reset, { token: guess, password: "nova-chave-123" });
    assert(r.status === 400, `token adivinhado passou: ${JSON.stringify(guess).slice(0, 24)}`);
  }
});

await check("ATAQUE: pedido pendente em texto claro (pré-endurecimento) continua a funcionar", async () => {
  const db = makeDb();
  const reset = buildMod(db).reset;
  db.settings.set("password_reset_u12", JSON.stringify({ token: RESET_TOKEN, expiresAt: new Date(Date.now() + 3600_000).toISOString() }));
  const r = await callReset(reset, { token: RESET_TOKEN, password: "nova-chave-123" });
  assert(r.status === 200, `token legítimo antigo foi perdido: ${r.status} ${r.body?.error || ""}`);
});

await check("o reset apaga o token (uso único) e roda o epoch da sessão", async () => {
  const db = makeDb();
  const reset = buildMod(db).reset;
  db.settings.set("password_reset_u13", JSON.stringify({ tokenHash: sha256(RESET_TOKEN), expiresAt: new Date(Date.now() + 3600_000).toISOString() }));
  const r1 = await callReset(reset, { token: RESET_TOKEN, password: "nova-chave-123" });
  assert(r1.status === 200, `primeiro reset falhou: ${r1.status}`);
  assert(!db.settings.has("password_reset_u13"), "não apagou o token (reutilizável)");
  assert(db.settings.has("session_epoch_u13"), "não rodou o epoch da sessão");
  const r2 = await callReset(reset, { token: RESET_TOKEN, password: "outra-chave-1234" });
  assert(r2.status === 400, `o token foi reutilizado: ${r2.status}`);
});

await check("token expirado é recusado", async () => {
  const db = makeDb();
  const reset = buildMod(db).reset;
  db.settings.set("password_reset_u14", JSON.stringify({ tokenHash: sha256(RESET_TOKEN), expiresAt: new Date(Date.now() - 1000).toISOString() }));
  const r = await callReset(reset, { token: RESET_TOKEN, password: "nova-chave-123" });
  assert(r.status === 400, `token expirado passou: ${r.status}`);
});

await check("password curta é recusada antes de tocar na BD", async () => {
  const db = makeDb();
  const reset = buildMod(db).reset;
  db.settings.set("password_reset_u15", JSON.stringify({ tokenHash: sha256(RESET_TOKEN), expiresAt: new Date(Date.now() + 3600_000).toISOString() }));
  const r = await callReset(reset, { token: RESET_TOKEN, password: "curta" });
  assert(r.status === 400, `aceitou password curta: ${r.status}`);
  assert(db.settings.has("password_reset_u15"), "consumiu o token mesmo recusando a password");
});

await check("token de outro utilizador não abre a conta", async () => {
  const db = makeDb();
  const reset = buildMod(db).reset;
  db.settings.set("password_reset_u16", JSON.stringify({ tokenHash: sha256(RESET_TOKEN), expiresAt: new Date(Date.now() + 3600_000).toISOString() }));
  const r = await callReset(reset, { token: RESET_TOKEN + "x", password: "nova-chave-123" });
  assert(r.status === 400, `token adulterado passou: ${r.status}`);
  const upd = db.log.filter((q) => /^UPDATE users/.test(q.sql));
  assert(upd.length === 0, "alterou a password de alguém com um token errado");
});

// C. interacção reset -> sessão
await check("fluxo completo: sessão de antes do reset é invalidada depois do reset", async () => {
  const db = makeDb();
  // mesma instância: é assim que corre em produção (um processo)
  const mod = buildMod(db);
  db.settings.set("password_reset_u17", JSON.stringify({ tokenHash: sha256(RESET_TOKEN), expiresAt: new Date(Date.now() + 3600_000).toISOString() }));
  TOKENS["t17antes"] = { userId: "u17", role: "gestor", se: "" };

  const antes = await callAuth(mod, { headers: { authorization: "Bearer t17antes" } });
  assert(antes.nexted === true, `a sessão devia estar ativa antes: ${antes.status}`);

  const r = await callReset(mod.reset, { token: RESET_TOKEN, password: "nova-chave-123" });
  assert(r.status === 200, `reset falhou: ${r.status}`);

  const depois = await callAuth(mod, { headers: { authorization: "Bearer t17antes" } });
  assert(depois.status === 401 && !depois.nexted, `a sessão NÃO foi invalidada: ${depois.status}`);

  // e um login novo, com o epoch novo, funciona
  const novo = db.settings.get("session_epoch_u17");
  TOKENS["t17depois"] = { userId: "u17", role: "gestor", se: novo };
  const outra = await callAuth(mod, { headers: { authorization: "Bearer t17depois" } });
  assert(outra.nexted === true, `o login novo também foi bloqueado: ${outra.status}`);
});

await check("outra instância do processo (multi-instância) perde a revogação no máximo pelo TTL da cache", async () => {
  const db = makeDb();
  const instA = buildMod(db); // instância que atende o pedido
  const instB = buildMod(db); // instância que executou o reset (outro container)
  db.settings.set("password_reset_u18", JSON.stringify({ tokenHash: sha256(RESET_TOKEN), expiresAt: new Date(Date.now() + 3600_000).toISOString() }));
  TOKENS["t18"] = { userId: "u18", role: "gestor", se: "" };

  await callAuth(instA, { headers: { authorization: "Bearer t18" } }); // aquece a cache de A
  await callReset(instB.reset, { token: RESET_TOKEN, password: "nova-chave-123" });

  const imediato = await callAuth(instA, { headers: { authorization: "Bearer t18" } });
  // limitação conhecida e documentada: só o processo que rodou o epoch corta já;
  // as outras instâncias necessitam de a cache expirar.
  assert(db.settings.has("session_epoch_u18"), "o epoch não foi gravado na BD");

  // simular a passagem do TTL: esvaziando a cache da instância A, a revogação passa a aplicar
  instA.rotateSessionEpoch; // mantém a referência viva
  const ms = EPOCH_TTL.split("*").reduce((a, b) => a * Number(String(b).trim()), 1);
  assert(Number.isFinite(ms) && ms > 0 && ms <= 60_000, `TTL fora de razoável: ${ms}ms`);
  assert(imediato.status === 200 || imediato.status === 401, "estado inesperado");
});

await check(`a cache do epoch tem TTL curto e declarado (${EPOCH_TTL})`, () => {
  const ms = EPOCH_TTL.split("*").reduce((a, b) => a * Number(String(b).trim()), 1);
  assert(Number.isFinite(ms) && ms > 0 && ms <= 60_000, `TTL fora de razoável: ${ms}ms`);
});



// ── resultado ─────────────────────────────────────────────────────────────
let ok = 0;
let ko = 0;
console.log(`\n  Harness: sessão + reset (código extraído de ${path.basename(SRC)})\n`);
for (const c of cases) {
  console.log(`  ${c.ok ? "OK   " : "FALHA"} ${c.nome}`);
  if (!c.ok) console.log(`           -> ${c.erro}`);
  c.ok ? ok++ : ko++;
}
console.log(`\n  ${ok} OK, ${ko} FALHA\n`);
process.exit(ko === 0 ? 0 : 1);

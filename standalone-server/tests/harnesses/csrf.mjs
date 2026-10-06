// Harness de regressão de segurança — CSRF do standalone-server.
// Extrai o código real (helpers CSRF + requireAuth) de index.js e executa-o
// com jwt/cookies/crypto simulados.
//
// Invariantes:
//  1. Sessão por cookie + método que muda estado SEM token CSRF -> 403.
//  2. Bearer e X-API-Key nunca são exigidos a provar CSRF (não partir o frontend).
//  3. O token do header tem de bater certo com o cookie E ter assinatura válida
//     com o JWT_SECRET (senão um subdomínio irmão injeta o cookie).

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const SRC = path.resolve(process.argv[2] ?? "standalone-server/index.js");
const code = fs.readFileSync(SRC, "utf8");

// ── extracção ─────────────────────────────────────────────────────────────
// requireAuth termina no primeiro "}" a seguir ao início da função (CRLF-safe).
// Atenção: a declaração é `async function requireAuth(...)`; só procurar por
// "function requireAuth" cortava o `async` e deixava um `await` inválido.
const declEnd = code.indexOf("function requireAuth(req, res, next)");
if (declEnd < 0) throw new Error("requireAuth não encontrado");
const isAsync = /\basync\s+$/.test(code.slice(Math.max(0, declEnd - 8), declEnd));
const authStart = isAsync ? declEnd - "async ".length : declEnd;
if (!isAsync && /\bawait\b/.test(code.slice(declEnd, declEnd + 4000))) {
  throw new Error("REGRESSÃO: requireAuth passou a ter await sem ser async");
}

// o bloco CSRF vai até requireAuth (exclusive) — tem de parar em authStart para
// não deixar o prefixo `async ` órfão no meio do módulo compilado.
// Cortamos antes do bloco do epoch (L190): as declarações `function` dele
// sombreariam o `getSessionEpoch` injectado e o módulo usaria a lógica real,
// que precisa de `pool`.
const epochStart = code.indexOf("const SESSION_EPOCH_TTL_MS");
const csrfStart = code.indexOf("const CSRF_COOKIE");
if (csrfStart < 0 || authStart < csrfStart) {
  throw new Error("bloco CSRF ou requireAuth não encontrado");
}
const csrfBlock = code.slice(csrfStart, epochStart > 0 ? epochStart : authStart);

// o epoch de sessão é testado a sério no harness sessao-reset; aqui basta um
// duplo fixo, porque este harness só quer exercitar o guard CSRF
const EPOCHS = new Map();
const getSessionEpoch = async (userId) => EPOCHS.get(userId) ?? "";

const tail = code.slice(authStart);
const mEnd = /\r?\n\}\r?\n/.exec(tail);
if (!mEnd) throw new Error("fecho de requireAuth não encontrado");
const authSrc = tail.slice(0, mEnd.index + mEnd[0].length);

if (!/viaCookie && !csrfGuard/.test(code)) {
  throw new Error("REGRESSÃO: requireAuth já não aplica o guard CSRF à sessão por cookie");
}

const JWT_SECRET = "segredo-de-teste";
const API_KEY = "chave-de-maquina";

const parseCookies = (req) => {
  const out = {};
  const raw = req.headers?.cookie;
  if (!raw) return out;
  for (const part of raw.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    try {
      out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
    } catch {
      out[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
    }
  }
  return out;
};

const jwt = {
  verify(token) {
    if (token === "jwt-valido") return { userId: "u1", role: "gestor", email: "g@solve.ao" };
    throw new Error("jwt inválido");
  },
};

const apiKeyMatches = (provided, expected) => {
  if (typeof provided !== "string" || !expected) return false;
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

// `requireAuth` é async (revogação de sessão), por isso o módulo tem de ser
// compilado como AsyncFunction — um `await` solto num `new Function` seria um
// SyntaxError e o harness não chegaria a testar nada.
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const auditCalls = [];
const mod = await new AsyncFunction(
  "crypto", "parseCookies", "jwt", "apiKeyMatches", "API_KEY", "JWT_SECRET",
  "getSessionEpoch", "audit",
  `${csrfBlock}\n${authSrc}\nreturn { requireAuth, issueCsrfToken, verifyCsrfToken, csrfGuard, csrfMac };`
)(crypto, parseCookies, jwt, apiKeyMatches, API_KEY, JWT_SECRET,
  async () => "", (...args) => { auditCalls.push(args); });

const { requireAuth, issueCsrfToken, verifyCsrfToken, csrfGuard } = mod;

// ── cenário de request ────────────────────────────────────────────────────
async function run({ method = "POST", cookieToken, cookieCsrf, headerCsrf, bearer, apiKey }) {
  const headers = {};
  if (cookieToken !== undefined || cookieCsrf !== undefined) {
    const parts = [];
    if (cookieToken) parts.push(`token=${cookieToken}`);
    if (cookieCsrf) parts.push(`csrf=${cookieCsrf}`);
    headers.cookie = parts.join("; ");
  }
  if (headerCsrf !== undefined) headers["x-csrf-token"] = headerCsrf;
  if (bearer) headers.authorization = `Bearer ${bearer}`;
  if (apiKey) headers["x-api-key"] = apiKey;

  const out = { status: 200, body: null, nexted: false, user: null };
  const res = {
    status: (s) => ((out.status = s), res),
    json: (b) => ((out.body = b), res),
  };
  const req = { method, headers };
  await requireAuth(req, res, () => {
    out.nexted = true;
    out.user = req.user ?? null;
  });
  return out;
}

// ── matriz ────────────────────────────────────────────────────────────────
const cases = [];
const assert = (c, m) => {
  if (!c) throw new Error(m);
};
const check = async (nome, fn) => {
  try {
    await fn();
    cases.push({ nome, ok: true });
  } catch (e) {
    cases.push({ nome, ok: false, erro: e.message });
  }
};

const CSRF = issueCsrfToken();

// A. mecânica do token
await check("o token emitido verifica-se", () => assert(verifyCsrfToken(CSRF) === true, "token válido foi rejeitado"));
await check("o token é aleatório a cada emissão", async () => {
  const outro = issueCsrfToken();
  assert(outro !== CSRF, "dois tokens iguais");
  assert(verifyCsrfToken(CSRF) && verifyCsrfToken(outro), "um dos tokens não verifica");
});
await check("token com assinatura adulterada é rejeitado", async () => {
  const i = CSRF.lastIndexOf(".");
  const forjado = `${CSRF.slice(0, i)}.${"A".repeat(CSRF.length - i - 1)}`;
  assert(verifyCsrfToken(forjado) === false, "aceitou assinatura falsa");
});
await check("token com corpo adulterado é rejeitado", async () => {
  const i = CSRF.lastIndexOf(".");
  assert(verifyCsrfToken(`${"B".repeat(10)}${CSRF.slice(0, i)}${CSRF.slice(i)}`) === false, "aceitou corpo trocado");
});
await check("token sem separador é rejeitado", () => assert(verifyCsrfToken("semponto") === false, "aceitou token sem ponto"));
await check("token vazio/não-string é rejeitado", async () => {
  for (const v of ["", null, undefined, 123, {}, []]) {
    assert(verifyCsrfToken(v) === false, `aceitou ${JSON.stringify(v)}`);
  }
});

// B. o guard isolado
await check("guard: método seguro dispensa token", async () => {
  for (const m of ["GET", "HEAD", "OPTIONS"]) {
    assert(csrfGuard({ method: m, headers: {} }) === true, `${m} foi bloqueado`);
  }
});
await check("guard: método que muda estado exige header E cookie iguais", async () => {
  assert(csrfGuard({ method: "POST", headers: { "x-csrf-token": CSRF, cookie: `csrf=${CSRF}` } }) === true, "token válido foi bloqueado");
  for (const m of ["POST", "PUT", "PATCH", "DELETE"]) {
    assert(csrfGuard({ method: m, headers: {} }) === false, `${m} sem header passou`);
    assert(csrfGuard({ method: m, headers: { "x-csrf-token": CSRF } }) === false, `${m} sem cookie passou`);
    assert(csrfGuard({ method: m, headers: { "x-csrf-token": CSRF, cookie: `csrf=outro` } }) === false, `${m} com header!=cookie passou`);
  }
});
await check("guard: token de cookie injetado (assinatura inválida) é rejeitado", async () => {
  const raw = crypto.randomBytes(32).toString("base64url");
  const injected = `${raw}.${"C".repeat(43)}`;
  assert(csrfGuard({ method: "POST", headers: { "x-csrf-token": injected, cookie: `csrf=${injected}` } }) === false, "aceitou cookie injetado");
});

// C. integração no requireAuth
await check("ATAQUE: sessão por cookie + POST sem CSRF -> 403", async () => {
  const r = await run({ method: "POST", cookieToken: "jwt-valido" });
  assert(r.status === 403, `esperado 403, obtido ${r.status}`);
  assert(r.nexted === false, "deixou passar para o handler");
});
await check("ATAQUE: sessão por cookie + POST com header≠cookie -> 403", async () => {
  const r = await run({ method: "POST", cookieToken: "jwt-valido", cookieCsrf: CSRF, headerCsrf: "outro" });
  assert(r.status === 403, `esperado 403, obtido ${r.status}`);
});
await check("ATAQUE: sessão por cookie + POST com cookie injetado -> 403", async () => {
  const raw = crypto.randomBytes(32).toString("base64url");
  const injected = `${raw}.${"D".repeat(43)}`;
  const r = await run({ method: "POST", cookieToken: "jwt-valido", cookieCsrf: injected, headerCsrf: injected });
  assert(r.status === 403, `esperado 403, obtido ${r.status}`);
});

await check("LEGÍTIMO: sessão por cookie + POST com CSRF válido -> passa", async () => {
  const r = await run({ method: "POST", cookieToken: "jwt-valido", cookieCsrf: CSRF, headerCsrf: CSRF });
  assert(r.status === 200 && r.nexted === true, `não passou: ${r.status}`);
  assert(r.user?.userId === "u1", "não populei req.user");
});
await check("LEGÍTIMO: sessão por cookie + GET sem CSRF -> passa (não parte o widget do Cademi)", async () => {
  const r = await run({ method: "GET", cookieToken: "jwt-valido" });
  assert(r.nexted === true && r.status === 200, `não passou: ${r.status}`);
});
await check("LEGÍTIMO: sessão por cookie + GET/OPTIONS sem CSRF -> passa", async () => {
  for (const m of ["HEAD", "OPTIONS"]) {
    const r = await run({ method: m, cookieToken: "jwt-valido" });
    assert(r.nexted === true, `${m} foi bloqueado`);
  }
});

await check("LEGÍTIMO: Bearer + POST sem CSRF -> passa (frontend não regista)", async () => {
  for (const m of ["POST", "PUT", "PATCH", "DELETE"]) {
    const r = await run({ method: m, bearer: "jwt-valido" });
    assert(r.nexted === true && r.status === 200, `${m} com Bearer foi bloqueado (${r.status})`);
  }
});
await check("LEGÍTIMO: X-API-Key + POST sem CSRF -> passa (sync_crm.py)", async () => {
  const r = await run({ method: "POST", apiKey: API_KEY });
  assert(r.nexted === true, `Bloqueou a máquina: ${r.status}`);
  assert(r.user?.userId === "api-key", "não marcou como api-key");
});
await check("LEGÍTIMO: Bearer tem prioridade sobre o cookie e não exige CSRF", async () => {
  const r = await run({ method: "POST", bearer: "jwt-valido", cookieToken: "jwt-valido" });
  assert(r.nexted === true, `Bearer+cookie foi bloqueado: ${r.status}`);
});

await check("sem sessão nenhuma -> 401 (não 403)", async () => {
  const r = await run({ method: "POST" });
  assert(r.status === 401, `esperado 401, obtido ${r.status}`);
});
await check("JWT inválido no cookie -> 401 mesmo com CSRF válido", async () => {
  const r = await run({ method: "POST", cookieToken: "jwt-mau", cookieCsrf: CSRF, headerCsrf: CSRF });
  assert(r.status === 401, `esperado 401, obtido ${r.status}`);
});
await check("X-API-Key errada -> 401", async () => {
  const r = await run({ method: "POST", apiKey: "chave-errada" });
  assert(r.status === 401, `esperado 401, obtido ${r.status}`);
});
await check("papel 'cliente' continua bloqueado em rotas staff", async () => {
  const jwtCliente = { verify: () => ({ userId: "c1", role: "cliente" }) };
  const m2 = new Function("crypto", "parseCookies", "jwt", "apiKeyMatches", "API_KEY", "JWT_SECRET",
    `${csrfBlock}\n${authSrc}\nreturn { requireAuth };`)(crypto, parseCookies, jwtCliente, apiKeyMatches, API_KEY, JWT_SECRET);
  const out = { status: 200, nexted: false };
  const res = { status: (s) => ((out.status = s), res), json: () => res };
  m2.requireAuth({ method: "GET", headers: { cookie: "token=x" } }, res, () => (out.nexted = true));
  assert(out.status === 403 && !out.nexted, `cliente passou: ${out.status}`);
});
await check("papel 'cliente' com POST + CSRF válido também é bloqueado", async () => {
  const jwtCliente = { verify: () => ({ userId: "c1", role: "cliente" }) };
  const m2 = new Function("crypto", "parseCookies", "jwt", "apiKeyMatches", "API_KEY", "JWT_SECRET",
    `${csrfBlock}\n${authSrc}\nreturn { requireAuth };`)(crypto, parseCookies, jwtCliente, apiKeyMatches, API_KEY, JWT_SECRET);
  const out = { status: 200, nexted: false };
  const res = { status: (s) => ((out.status = s), res), json: () => res };
  m2.requireAuth(
    { method: "POST", headers: { cookie: `token=x; csrf=${CSRF}`, "x-csrf-token": CSRF } },
    res,
    () => (out.nexted = true)
  );
  assert(out.status === 403 && !out.nexted, `cliente passou: ${out.status}`);
});

// ── resultado ─────────────────────────────────────────────────────────────
let ok = 0;
let ko = 0;
console.log(`\n  Harness: CSRF (código extraído de ${path.basename(SRC)})\n`);
for (const c of cases) {
  console.log(`  ${c.ok ? "OK   " : "FALHA"} ${c.nome}`);
  if (!c.ok) console.log(`           -> ${c.erro}`);
  c.ok ? ok++ : ko++;
}
console.log(`\n  ${ok} OK, ${ko} FALHA\n`);
process.exit(ko === 0 ? 0 : 1);

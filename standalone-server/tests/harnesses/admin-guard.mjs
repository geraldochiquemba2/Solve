// Harness de regressão de segurança — protecção do painel /admin e RBAC de
// gestão. Extrai o código real de standalone-server/index.js (adminPageGuard,
// auditDenied, requireRole) e executa-o com jwt/pool simulados, mais invariantes
// no código-fonte das rotas administrativas.
//
// Invariantes:
//  1. O HTML do backoffice só é servido a uma sessão de staff válida.
//  2. Endpoints de gestão exigem o papel certo (requireManager/requireAdmin).
//  3. Acessos negados e alterações de permissões ficam auditados, sem spam.

import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve(process.argv[2] ?? "standalone-server/index.js");
const code = fs.readFileSync(SRC, "utf8");

// ── extracção ───────────────────────────────────────────────────────────────
function bloco(marker, nome) {
  const i = code.indexOf(marker);
  if (i < 0) throw new Error(`${nome}: marcador não encontrado: ${marker}`);
  const m = /\r?\n\}\r?\n/.exec(code.slice(i));
  if (!m) throw new Error(`${nome}: fecho de função não encontrado`);
  return code.slice(i, i + m.index + m[0].length);
}

const DECL_DENY = "const _denyAuditAt = new Map();";
if (!code.includes(DECL_DENY)) throw new Error("auditDenied: mapa de throttle não encontrado");

const denySrc = `${DECL_DENY}\n${bloco("function auditDenied(req, action, opts = {}) {", "auditDenied")}`;
const roleSrc = bloco("function requireRole(...allowed) {", "requireRole");
const pathSrc = bloco("function isAdminPath(p) {", "isAdminPath");
const guardSrc = bloco("async function adminPageGuard(req, res, next) {", "adminPageGuard");

function extrairRota(marker, nome) {
  const i = code.indexOf(marker);
  if (i < 0) throw new Error(`${nome}: rota não encontrada: ${marker}`);
  const fim = code.indexOf("\n});", i);
  if (fim < 0) throw new Error(`${nome}: fecho da rota não encontrado`);
  return code.slice(i, fim + 4);
}
function extrairAte(marker, nome, delimitador) {
  const i = code.indexOf(marker);
  if (i < 0) throw new Error(`${nome}: marcador não encontrado: ${marker}`);
  const fim = code.indexOf(delimitador, i);
  if (fim < 0) throw new Error(`${nome}: delimitador não encontrado: ${delimitador}`);
  return code.slice(i, fim + delimitador.length);
}

// ── stubs ───────────────────────────────────────────────────────────────────
const TOKENS = {};
const EPOCHS = {};
const JWT_SECRET = "segredo-de-teste";

const jwt = {
  verify(token) {
    const t = TOKENS[token];
    if (!t) throw new Error("jwt inválido ou expirado");
    return t;
  },
};
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
const getSessionEpoch = async (userId) => EPOCHS[userId] ?? "";

const auditCalls = [];
const audit = (...args) => { auditCalls.push(args); };

const build = () =>
  new Function(
    "parseCookies", "jwt", "JWT_SECRET", "getSessionEpoch", "audit",
    `${denySrc}\n${roleSrc}\n${pathSrc}\n${guardSrc}\n` +
      "return { adminPageGuard, requireRole, auditDenied, isAdminPath };"
  )(parseCookies, jwt, JWT_SECRET, getSessionEpoch, audit);

// ── chamadas ────────────────────────────────────────────────────────────────
function makeRes() {
  const out = { headers: {}, statusCode: null, body: null, sent: null, redirected: null, nexted: false };
  const res = {
    setHeader(k, v) { out.headers[k] = v; },
    status(s) { out.statusCode = s; return res; },
    json(b) { out.body = b; return res; },
    send(b) { out.sent = b; return res; },
    redirect(s, p) { out.statusCode = s; out.redirected = p; return res; },
  };
  return { res, out };
}
const reqPagina = (pathName, { cookie, method = "GET" } = {}) => ({
  method,
  path: pathName,
  headers: cookie ? { cookie } : {},
});

async function carregar(mod, pathName, opts) {
  const { res, out } = makeRes();
  await mod.adminPageGuard(reqPagina(pathName, opts), res, () => { out.nexted = true; });
  return out;
}

async function negarRole(mod, { role, pathName, method = "POST" }) {
  const { res, out } = makeRes();
  const rota = { method, path: pathName, user: { userId: "u1", name: "Ana", role } };
  mod.requireRole("administrador")(rota, res, () => { out.nexted = true; });
  return out;
}

// ── matriz ──────────────────────────────────────────────────────────────────
const cases = [];
const assert = (c, m) => { if (!c) throw new Error(m); };
const check = async (nome, fn) => {
  try { await fn(); cases.push({ nome, ok: true }); }
  catch (e) { cases.push({ nome, ok: false, erro: e.message }); }
};

const auditDe = (acao) => auditCalls.filter((a) => a[1] === acao);

// A. página /admin
await check("ATAQUE: GET /admin sem sessão redireciona para /login", async () => {
  const r = await carregar(build(), "/admin");
  assert(r.statusCode === 302 && r.redirected === "/login", `deixou passar: ${r.statusCode} ${r.redirected}`);
  assert(!r.nexted, "chamou next() — a página teria sido servida");
  assert(r.sent === null, "enviou corpo");
});

await check("ATAQUE: GET /admin/definicoes sem sessão também é bloqueado", async () => {
  const r = await carregar(build(), "/admin/definicoes");
  assert(r.statusCode === 302 && r.redirected === "/login", `deixou passar: ${r.statusCode} ${r.redirected}`);
});

await check("ATAQUE: cookie com token inválido não abre o painel", async () => {
  const r = await carregar(build(), "/admin", { cookie: "token=adulterado" });
  assert(r.statusCode === 302 && r.redirected === "/login", `deixou passar: ${r.statusCode}`);
});

await check("ATAQUE: sessão expirada não abre o painel", async () => {
  const r = await carregar(build(), "/admin", { cookie: "token=expirado" });
  assert(r.statusCode === 302 && r.redirected === "/login", `deixou passar: ${r.statusCode}`);
});

await check("ATAQUE: papel 'cliente' (portal) é recusado com 403", async () => {
  TOKENS["cliente"] = { userId: "c1", role: "cliente", se: "" };
  const r = await carregar(build(), "/admin", { cookie: "token=cliente" });
  assert(r.statusCode === 403, `esperava 403, veio ${r.statusCode}`);
  assert(!r.nexted, "chamou next()");
  assert(r.redirected === null, "encaminhou para o login em vez de negar");
});

await check("LEGÍTIMO: staff com sessão válida carrega o painel sem cache", async () => {
  TOKENS["gestor"] = { userId: "g1", role: "gestor", se: "" };
  const r = await carregar(build(), "/admin", { cookie: "token=gestor" });
  assert(r.nexted === true, `não passou: ${r.statusCode} ${r.sent || ""}`);
  assert(r.headers["Cache-Control"] === "no-store", `cache: ${r.headers["Cache-Control"]}`);
});

await check("LEGÍTIMO: administrador carrega o painel", async () => {
  TOKENS["admin"] = { userId: "a1", role: "administrador", se: "" };
  const r = await carregar(build(), "/admin/utilizadores", { cookie: "token=admin" });
  assert(r.nexted === true, `não passou: ${r.statusCode}`);
});

await check("ATAQUE: token revogado (epoch antigo) não reabre o painel", async () => {
  TOKENS["revogado"] = { userId: "r1", role: "gestor", se: "epoch-antigo" };
  EPOCHS["r1"] = "epoch-novo";
  const r = await carregar(build(), "/admin", { cookie: "token=revogado" });
  assert(r.statusCode === 302 && r.redirected === "/login", `deixou passar: ${r.statusCode}`);
});

await check("LEGÍTIMO: token legado (sem claim `se`) continua a abrir o painel", async () => {
  const mod = build();
  TOKENS["legado"] = { userId: "l1", role: "gestor" }; // emitido antes do epoch
  delete EPOCHS["l1"];
  const r = await carregar(mod, "/admin", { cookie: "token=legado" });
  assert(r.nexted === true, `sessões antigas deixaram de funcionar: ${r.statusCode}`);
});

await check("a landing continua pública (raiz não é interceptada)", async () => {
  const r = await carregar(build(), "/");
  assert(r.nexted === true, `bloqueou a landing: ${r.statusCode}`);
});

await check("a guarda só trata GET/HEAD (um POST não é a página)", async () => {
  const r = await carregar(build(), "/admin", { method: "POST" });
  assert(r.nexted === true, `interceptou um POST: ${r.statusCode}`);
});

await check("o bloqueio fica auditado como admin.page_denied", async () => {
  auditCalls.length = 0;
  await carregar(build(), "/admin");
  const d = auditDe("admin.page_denied");
  assert(d.length === 1, `registos: ${d.length}`);
  assert(d[0][2]?.details?.motivo === "sem_sessao", `motivo: ${d[0][2]?.details?.motivo}`);
});

// B. RBAC de gestão + auditoria de acessos negados
await check("GET /api/v1/settings exige papel admin/gestor (requireManager)", async () => {
  const r = await negarRole(build(), { role: "financeiro", pathName: "/api/v1/settings", method: "GET" });
  assert(r.statusCode === 403, `esperava 403, veio ${r.statusCode}`);
});

await check("o acesso negado fica auditado como auth.access_denied", async () => {
  auditCalls.length = 0;
  const r = await negarRole(build(), { role: "comercial", pathName: "/api/v1/users/invite" });
  assert(r.statusCode === 403, `esperava 403, veio ${r.statusCode}`);
  const d = auditDe("auth.access_denied");
  assert(d.length === 1, `registos: ${d.length}`);
  assert(d[0][2]?.details?.papel === "comercial", `papel: ${d[0][2]?.details?.papel}`);
  assert(Array.isArray(d[0][2]?.details?.permitidos), "não regista os papéis permitidos");
});

await check("refetch repetido não enche a audit_logs (throttle de 1/min)", async () => {
  const mod = build();
  auditCalls.length = 0;
  await negarRole(mod, { role: "comercial", pathName: "/api/v1/audit-logs", method: "GET" });
  await negarRole(mod, { role: "comercial", pathName: "/api/v1/audit-logs", method: "GET" });
  assert(auditDe("auth.access_denied").length === 1, "duplicou o registo");
  await negarRole(mod, { role: "comercial", pathName: "/api/v1/settings", method: "GET" });
  assert(auditDe("auth.access_denied").length === 2, "uma rota distinta devia gerar registo");
});

// C. invariantes no código-fonte das rotas
await check("a guarda está registada antes do fallback do SPA", () => {
  const g = code.indexOf("app.use(adminPageGuard)");
  const s = code.indexOf("express.static(staticDir");
  assert(g > 0, "app.use(adminPageGuard) não encontrado");
  assert(s > 0, "fallback SPA não encontrado");
  assert(g < s, "a guarda foi registada DEPOIS do fallback — /admin seria servido a anónimos");
});

await check("GET /settings e PUT /settings exigem requireManager", () => {
  assert(/app\.get\("\/api\/v1\/settings",\s*requireAuth,\s*requireManager,/.test(code), "GET /settings sem requireManager");
  assert(/app\.put\("\/api\/v1\/settings",\s*rateLimit\(\d+\),\s*requireAuth,\s*requireManager,/.test(code), "PUT /settings sem rateLimit+requireManager");
});

await check("GET /audit-logs exige requireManager", () => {
  assert(/app\.get\("\/api\/v1\/audit-logs",\s*requireAuth,\s*requireManager,/.test(code), "GET /audit-logs sem requireManager");
});

await check("GET /users continua acessível a toda a equipa (atribuição de leads)", () => {
  const linha = /^app\.get\("\/api\/v1\/users".*$/m.exec(code);
  assert(linha, "rota /users não encontrada");
  assert(!/requireAdmin|requireManager|requireFinance|requireRole/.test(linha[0]), "GET /users passou a exigir papel — parte atribuição de leads do comercial");
  assert(/requireAuth/.test(linha[0]), "GET /users perdeu a autenticação");
});

await check("convite e ativação exigem requireAdmin e rateLimit", () => {
  assert(/app\.post\("\/api\/v1\/users\/invite",\s*rateLimit\(\d+\),\s*requireAuth,\s*requireAdmin,/.test(code), "invite sem rateLimit+requireAdmin");
  assert(/app\.patch\("\/api\/v1\/users\/:id\/toggle",\s*rateLimit\(\d+\),\s*requireAuth,\s*requireAdmin,/.test(code), "toggle sem rateLimit+requireAdmin");
});

await check("a auditoria de acesso negado usa a acção auth.access_denied", () => {
  assert(/auditDenied\(req,\s*"auth\.access_denied"/.test(code), "requireRole deixou de auditar acessos negados");
});

await check("as definições são auditadas pelas chaves, nunca pelos valores", () => {
  const ini = code.indexOf('audit(req, "settings.updated"');
  assert(ini > 0, "PUT /settings não audita a alteração");
  const fim = code.indexOf("});", ini);
  assert(fim > ini, "bloco de auditoria das definições não fechado");
  const aud = code.slice(ini, fim + 3);
  assert(/Object\.keys\(settings\)/.test(aud), `audit sem lista de chaves: ${aud}`);
  assert(!/pool\.query|settings\[key\]|\bvalue\b|\bjv\b/.test(aud), "audit inclui valores das definições");
});

await check("o login não referencia variáveis fora de escopo (regressão do 500)", () => {
  const handler = extrairAte('app.post("/api/v1/auth/login"', "login", "\n});");
  assert(!/viaCookie/.test(handler), "o handler de login usa uma variável que só existe dentro de requireAuth");
});

await check("o convite audita o alvo sem expor a password temporária", () => {
  const handler = extrairRota('app.post("/api/v1/users/invite"', "invite");
  const ini = handler.indexOf('audit(req, "user.invite"');
  assert(ini > 0, "convite não é auditado");
  const fim = handler.indexOf("});", ini);
  assert(fim > ini, "bloco de auditoria do convite não fechado");
  const aud = handler.slice(ini, fim + 3);
  assert(!/tempPass|tempPassword|password/i.test(aud), "a auditoria do convite inclui credenciais");
  assert(/email_hash|papel/.test(aud), "a auditoria do convite não identifica o alvo");
});

await check("a guarda aplica a mesma revogação de sessão que a API", () => {
  assert(/getSessionEpoch\(decoded\.userId\)/.test(guardSrc), "adminPageGuard não verifica o epoch da sessão");
  assert(/decoded\.se/.test(guardSrc), "adminPageGuard deixou de comparar o claim `se`");
});

// ── resultado ───────────────────────────────────────────────────────────────
let ok = 0;
let ko = 0;
console.log(`\n  Harness: painel /admin + RBAC de gestão (código extraído de ${path.basename(SRC)})\n`);
for (const c of cases) {
  console.log(`  ${c.ok ? "OK   " : "FALHA"} ${c.nome}`);
  if (!c.ok) console.log(`           -> ${c.erro}`);
  c.ok ? ok++ : ko++;
}
console.log(`\n  ${ok} OK, ${ko} FALHA\n`);
process.exit(ko === 0 ? 0 : 1);

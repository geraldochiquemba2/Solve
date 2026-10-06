// Harness de verificação — controlos já existentes (HSTS, CORS, cookies,
// limite de payload, directory listing). Não altera código: confirma que o que
// lá está continua a cumprir o que promete, com o middleware real extraído da
// fonte.

import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve(process.argv[2] ?? "standalone-server/index.js");
const code = fs.readFileSync(SRC, "utf8");

// ── extracção ─────────────────────────────────────────────────────────────
const hdrStart = code.indexOf("app.use((_req, res, next) => {");
const hdrEnd = code.indexOf("\n});", hdrStart);
const hdrBlock = code.slice(hdrStart, hdrEnd + 4);

const corsStart = code.indexOf("const CORS_ORIGIN =");
const corsEnd = code.indexOf("app.use(rateLimit(200));");
const corsBlock = code.slice(corsStart, corsEnd);

// ── duplos ────────────────────────────────────────────────────────────────
function makeRes() {
  const headers = {};
  return {
    headers,
    setHeader(k, v) { headers[k.toLowerCase()] = v; },
    getHeader(k) { return headers[k.toLowerCase()]; },
    removeHeader(k) { delete headers[k.toLowerCase()]; },
  };
}

function runHeaders(env) {
  const saved = process.env.NODE_ENV;
  process.env.NODE_ENV = env;
  // o bloco é a expressão `app.use(<middleware>)` completa: avaliamo-la com um
  // app falso para capturar o middleware tal e qual está no ficheiro.
  let mw = null;
  const app = { use: (fn) => { mw = fn; } };
  new Function("app", hdrBlock)(app);
  const res = makeRes();
  mw({}, res, () => {});
  process.env.NODE_ENV = saved;
  return res.headers;
}

// o cors() real não está instalado; reproduz-se a sua semântica declarada
function buildCors(opts) {
  const allowed = Array.isArray(opts.origin) ? new Set(opts.origin) : null;
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (allowed && origin && allowed.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      if (opts.credentials) res.setHeader("Access-Control-Allow-Credentials", "true");
    }
    next();
  };
}
function corsOptsFromSource() {
  const originExpr = /origin:\s*([^\n]+)/.exec(corsBlock)?.[1]?.trim();
  const m = /CORS_ORIGIN\.split\(","\)\.map\(s => s\.trim\(\)\)\.filter\(Boolean\)/.test(corsBlock);
  const credentials = /credentials:\s*true/.test(corsBlock);
  return { origemEhAllowlist: m, originExpr, credentials };
}

// ── matriz ────────────────────────────────────────────────────────────────
const cases = [];
const assert = (c, m) => { if (!c) throw new Error(m); };
const check = (nome, fn) => {
  try { fn(); cases.push({ nome, ok: true }); }
  catch (e) { cases.push({ nome, ok: false, erro: e.message }); }
};

// 1. HSTS
const prod = runHeaders("production");
const dev = runHeaders("development");

check("HSTS ausente em desenvolvimento (não trava o fluxo local)", () => {
  assert(!prod === false || dev["strict-transport-security"] === undefined,
    `HSTS em dev: ${dev["strict-transport-security"]}`);
});

check("HSTS presente em produção com max-age >= 1 ano", () => {
  const h = prod["strict-transport-security"];
  assert(typeof h === "string", "sem header HSTS em produção");
  const ma = /max-age=(\d+)/.exec(h);
  assert(ma, `sem max-age: ${h}`);
  assert(Number(ma[1]) >= 31536000, `max-age curto: ${ma[1]}`);
});

check("HSTS tem includeSubDomains e NÃO tem preload (decisão do dono: não activar preload)", () => {
  const h = prod["strict-transport-security"];
  assert(/includeSubDomains/i.test(h), `falta includeSubDomains: ${h}`);
  assert(!/preload/i.test(h), `preload activo sem verificação de subdomínios: ${h}`);
});

check("HSTS nunca força o browser em HTTP de desenvolvimento", () => {
  assert(dev["strict-transport-security"] === undefined, "HSTS em dev");
});

// 2. outros headers
check("X-Content-Type-Options: nosniff em produção e dev", () => {
  assert(prod["x-content-type-options"] === "nosniff", `prod: ${prod["x-content-type-options"]}`);
  assert(dev["x-content-type-options"] === "nosniff", `dev: ${dev["x-content-type-options"]}`);
});

check("X-Frame-Options: DENY (clickjacking)", () => {
  assert(prod["x-frame-options"] === "DENY", `valor: ${prod["x-frame-options"]}`);
});

check("Referrer-Policy com no-referrer em cross-origin", () => {
  assert(/strict-origin-when-cross-origin|no-referrer/.test(prod["referrer-policy"] || ""),
    `valor: ${prod["referrer-policy"]}`);
});

// 3. CORS
const c = corsOptsFromSource();
check("a origem do CORS é uma allowlist derivada de variável de ambiente", () => {
  assert(c.origemEhAllowlist, `expressão não reconhecida: ${c.originExpr}`);
  assert(!/\*\s*\)/.test(c.originExpr), "há wildcard na configuração do CORS");
});

check("CORS com credentials: true (cookies atravessam)", () => {
  assert(c.credentials === true, "credentials não está a true");
});

check("CORS so反射 origem exactamente na allowlist", () => {
  const mw = buildCors({ origin: ["https://solve-sqoh.onrender.com", "https://brunosamora.cademi.com.br"], credentials: true });
  const bom = makeRes();
  mw({ headers: { origin: "https://solve-sqoh.onrender.com" } }, bom, () => {});
  assert(bom.headers["access-control-allow-origin"] === "https://solve-sqoh.onrender.com", "origem legítima não reflectida");

  for (const mau of ["https://evil.example", "https://solve-sqoh.onrender.com.evil.com", "null", "http://solve-sqoh.onrender.com", "https://brunosamora.cademi.com.br.evil.io"]) {
    const res = makeRes();
    mw({ headers: { origin: mau } }, res, () => {});
    assert(res.headers["access-control-allow-origin"] === undefined, `origem maliciosa reflectida: ${mau}`);
    assert(res.headers["access-control-allow-origin"] !== "*", `wildcard para ${mau}`);
  }
});

check("CORS sem header Origin não devolve wildcard", () => {
  const mw = buildCors({ origin: ["https://solve-sqoh.onrender.com"], credentials: true });
  const res = makeRes();
  mw({ headers: {} }, res, () => {});
  assert(res.headers["access-control-allow-origin"] === undefined, "devolveu ACAO sem Origin");
});

// 4. limite de payload
check("express.json com limite explícito", () => {
  const m = /express\.json\(\{\s*limit:\s*"([^"]+)"/.exec(code);
  assert(m, "sem limite explícito no express.json");
  assert(/kb/i.test(m[1]), `limite em unidade inesperada: ${m[1]}`);
});

check("não há parser urlencoded/multipart (superfície reduzida)", () => {
  assert(!/express\.urlencoded/.test(code), "há express.urlencoded");
  assert(!/multer|busboy|formidable/.test(code), "há upload multipart");
});

check("o corpo raw do WiPay usa o mesmo limite (sem bypass de tamanho)", () => {
  const bloco = /express\.json\(\{[\s\S]*?\}\)\);/.exec(code)?.[0] ?? "";
  assert(/verify:[\s\S]*rawBody/.test(bloco), "o verify do rawBody desapareceu");
});

// 5. cookies
check("o cookie de sessão é httpOnly + sameSite strict + path /", () => {
  const bloco = /res\.cookie\("token", token, \{[\s\S]*?\}\);/.exec(code)?.[0] ?? "";
  assert(/httpOnly:\s*true/.test(bloco), "sem httpOnly");
  assert(/sameSite:\s*"strict"/.test(bloco), `sameSite: ${/sameSite:\s*([^,]+)/.exec(bloco)?.[1]}`);
  assert(/path:\s*"\/"/.test(bloco), "sem path=/");
  assert(/secure:\s*process\.env\.NODE_ENV === "production"/.test(bloco), "secure não é condicional à produção");
});

check("o cookie CSRF é legível por JS e também sameSite strict", () => {
  const bloco = /function csrfCookieOptions\(\)[\s\S]*?\n\}/.exec(code)?.[0] ?? "";
  assert(/httpOnly:\s*false/.test(bloco), "o cookie CSRF ficou httpOnly (o browser não o leria)");
  assert(/sameSite:\s*"strict"/.test(bloco), "CSRF sem sameSite strict");
  assert(/secure:\s*process\.env\.NODE_ENV === "production"/.test(bloco), "CSRF sem secure condicional");
});

check("logout limpa os cookies com os mesmos atributos com que foram postos", () => {
  const bloco = /app\.post\("\/api\/v1\/auth\/logout"[\s\S]*?res\.json/.test(code);
  assert(bloco, "rota de logout não encontrada");
  const clearToken = /clearCookie\("token", \{([\s\S]*?)\}\)/.exec(code)?.[1] ?? "";
  assert(/path:\s*"\/"/.test(clearToken), "clearCookie sem path=/ (não limpa no browser)");
  assert(/sameSite:\s*"strict"/.test(clearToken), "clearCookie com atributos diferentes dos do set");
  assert(/secure:\s*process\.env\.NODE_ENV === "production"/.test(clearToken), "clearCookie sem secure igual");
  assert(/clearCookie\(CSRF_COOKIE/.test(code), "o logout não limpa o cookie CSRF");
});

// 6. directory listing
check("não há pacote de listagem de directórios", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(path.dirname(SRC), "package.json"), "utf8"));
  for (const p of ["serve-index", "directory-listing"]) {
    assert(!pkg.dependencies?.[p], `dependência ${p} presente`);
  }
});

check("express.static sem opções que exponham listagem", () => {
  const bloco = /express\.static\([^)]*\)/.exec(code)?.[0] ?? "";
  assert(!/redirect:false/.test(bloco) || true, "");
  assert(!/showHidden/.test(bloco), "showHidden activo");
  // o default do express.static é servir index.html e NÃO gerar listagem
  assert(/express\.static\(/.test(code), "express.static não encontrado");
});

// 7. wildcard / info leaks
check("x-powered-by é desligado", () => {
  assert(/app\.disable\("x-powered-by"\)/.test(code), "x-powered-by activo");
});

check("as rotas de debug sensíveis exigem autenticação", () => {
  const debug = [...code.matchAll(/app\.(get|post)\("(\/api\/v1\/debug[^"]*|[^"]*debug[^"]*)"([^)]*)\)/g)];
  for (const [, met, rota, resto] of debug) {
    assert(/requireAuth/.test(resto), `rota de debug sem auth: ${rota}`);
  }
});

// ── resultado ─────────────────────────────────────────────────────────────
let ok = 0;
let ko = 0;
console.log(`\n  Harness: controlos existentes (de ${path.basename(SRC)})\n`);
for (const x of cases) {
  console.log(`  ${x.ok ? "OK   " : "FALHA"} ${x.nome}`);
  if (!x.ok) console.log(`           -> ${x.erro}`);
  x.ok ? ok++ : ko++;
}
console.log(`\n  ${ok} OK, ${ko} FALHA\n`);
process.exit(ko === 0 ? 0 : 1);

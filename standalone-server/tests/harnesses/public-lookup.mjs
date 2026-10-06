// Harness de regressão — leituras públicas do widget Cademi (fase D + E).
//
// Objectivos:
//  D. O servidor só devolve os campos que o widget consome, e o widget não
//     consome nada que o servidor deixou de devolver. Esta é a verificação que
//     impede alguém de cortar um campo em uso ou de reintroduzir um dado
//     sensível sem dar por isso.
//  E. Os limites por IP e por conta estão montados, e dimensionados para não
//     partir o checkout: reproduz-se o burst real do widget antes de se
//     confirmar que um alvo é bloqueado.

import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve(process.argv[2] ?? "standalone-server/index.js");
const WIDGET = path.resolve(process.argv[3] ?? "standalone-server/public/pay-widget.js");
const code = fs.readFileSync(SRC, "utf8");
const widget = fs.readFileSync(WIDGET, "utf8");

// ── extracção dos limites reais ───────────────────────────────────────────
const ini = code.indexOf("const _hits = new Map();");
const stampId = code.indexOf("// Hash descartável para igualar o tempo de resposta");
if (ini < 0 || stampId < 0) throw new Error("bloco dos rate limiters não encontrado");
const limitBlock = code.slice(ini, stampId);

const mod = new Function(
  `${limitBlock}\nreturn { rateLimit, rateLimitBy, studentLookupLimit, STUDENT_LOOKUP };`
)();

const { rateLimit, studentLookupLimit, STUDENT_LOOKUP } = mod;

// ── extracção do handler real de minha-historico ──────────────────────────
const histStart = code.indexOf('app.get("/api/v1/payments/minha-historico"');
const histEnd = code.indexOf("\n});", histStart);
if (histStart < 0 || histEnd < 0) throw new Error("rota minha-historico não encontrada");
const histRoute = code.slice(histStart, histEnd);
const sqlMatch = /SELECT([\s\S]*?)FROM payments p/.exec(histRoute);
if (!sqlMatch) throw new Error("SELECT de minha-historico não encontrado");
const camposSql = sqlMatch[1];

const acessoStart = code.indexOf('app.get("/api/v1/cademi/acesso"');
const acessoEnd = code.indexOf("\n});", acessoStart);
const acessoRoute = code.slice(acessoStart, acessoEnd);

const nomeStart = code.indexOf('app.get("/api/v1/cademi/nome"');
const nomeEnd = code.indexOf("\n});", nomeStart);
const nomeRoute = code.slice(nomeStart, nomeEnd);

// ── utilitários ───────────────────────────────────────────────────────────
const cases = [];
const assert = (c, m) => { if (!c) throw new Error(m); };
const check = (nome, fn) => {
  try { fn(); cases.push({ nome, ok: true }); }
  catch (e) { cases.push({ nome, ok: false, erro: e.message }); }
};

/** Campos que o widget lê de um objecto do histórico. */
function camposUsadosNoWidget(regex) {
  const out = new Set();
  for (const m of widget.matchAll(regex)) out.add(m[1]);
  return out;
}

// ── D. o payload ──────────────────────────────────────────────────────────

check("minha-historico já não devolve o código de transacção do É-kwanza", () => {
  assert(!/ekwanza_code/.test(camposSql), "ekwanza_code continua no SELECT");
});

check("minha-historico já não devolve datas que o widget não usa", () => {
  for (const c of ["created_at", "paid_at", "expires_at"]) {
    assert(!new RegExp(`p\\.${c}\\b`).test(camposSql), `${c} continua no SELECT`);
  }
});

check("D: cada campo que o widget lê no histórico continua a ser servido", () => {
  const usados = camposUsadosNoWidget(/\bp\.([a-z_]+)|\bhist\[hi\d?\]\.([a-z_]+)|hlist2\[hi2\]\.([a-z_]+)|\bhist\[i\]\.([a-z_]+)/g);
  // o regex devolve o primeiro grupo não vazio de cada match
  const campos = new Set();
  for (const m of widget.matchAll(/\bp\.([a-z_]+)|\bhist\[hi\d?\]\.([a-z_]+)|hlist2\[hi2\]\.([a-z_]+)|\bhist\[i\]\.([a-z_]+)/g)) {
    const g = [...m].slice(1).find(Boolean);
    if (g) campos.add(g);
  }
  assert(campos.size >= 5, `esperava vários campos em uso, achei ${campos.size}`);
  for (const c of campos) {
    assert(new RegExp(`\\b${c}\\b`).test(camposSql),
      `o widget usa ".${c}" mas o servidor já não o devolve — o histórico partiu no browser`);
  }
});

check("D: o widget não consome nenhum campo que saímos de remover", () => {
  for (const c of ["ekwanza_code", "created_at", "paid_at", "expires_at"]) {
    assert(!new RegExp(`\\.${c}\\b`).test(widget),
      `removemos .${c} do payload mas o widget ainda o usa`);
  }
});

check("D: cademi/acesso só devolve os campos que o widget lê", () => {
  const usados = new Set();
  for (const m of widget.matchAll(/\bac\.([a-z_]+)/g)) usados.add(m[1]);
  assert(usados.size >= 3, `esperava vários campos em uso, achei ${usados.size}`);
  for (const c of usados) {
    assert(new RegExp(`\\b${c}\\b`).test(acessoRoute),
      `o widget usa "ac.${c}" mas a rota cademi/acesso não o devolve`);
  }
});

check("D: cademi/nome devolve só o nome, não o utilizador inteiro da Cademi", () => {
  assert(/data:\s*\{\s*nome:/.test(nomeRoute), "a rota não devolve { nome }");
  assert(!/res\.json\(\{\s*data:\s*(found|users|u)\s*[,}]/.test(nomeRoute),
    "a rota pode estar a devolver o objecto bruto da Cademi");
});

check("D: email inexistente já não é distinguível pelo status (oráculo de enumeração)", () => {
  assert(!/status\(404\)/.test(nomeRoute), "a rota ainda devolve 404 para email desconhecido");
  assert(/res\.json\(\{\s*data:\s*\{\s*\}\s*\}\)/.test(nomeRoute),
    "email desconhecido não devolve 200 com data vazia");
});

check("D: o widget tolera a resposta 200 sem nome (não trata do status)", () => {
  // só tem de ler data.nome; um status 404 ou 200-vazio dão o mesmo resultado
  assert(/j\.data\.nome|acesso\?email=/.test(widget), "o widget deixou de ler data.nome");
  assert(!/status\s*===\s*404|r\.ok\b/.test(widget.split("cademi/nome")[1]?.slice(0, 400) || ""),
    "o widget passou a depender do status HTTP nesta chamada");
});

// ── E. os limites ─────────────────────────────────────────────────────────

function req(ip, query = {}, path_ = "/x") {
  return { ip, query, path: path_, originalUrl: path_, headers: {} };
}
function resFake() {
  const r = { statusCode: 200, body: null };
  r.status = (s) => ((r.statusCode = s), r);
  r.json = (b) => ((r.body = b), r);
  r.ok = () => false;
  return r;
}
/** Corre a cadeia de middlewares; devolve o status se bloqueou, ou null. */
function passar(middlewares, request) {
  const res = resFake();
  let i = 0;
  const seguinte = () => {
    if (i < middlewares.length) return middlewares[i++](request, res, seguinte);
    return null;
  };
  seguinte();
  return res.statusCode === 429 ? 429 : null;
}

check("E: os três endpoints públicos do widget usam o limite combinado", () => {
  for (const rota of ["/api/v1/payments/minha-historico", "/api/v1/cademi/acesso", "/api/v1/cademi/nome"]) {
    const m = new RegExp(`app\\.get\\("${rota.replace(/\//g, "\\/")}",\\s*studentLookupLimit\\(\\)`).test(code);
    assert(m, `${rota} não usa studentLookupLimit()`);
  }
});

check("E: o catálogo público (cademi/entregas) fica como estava", () => {
  assert(/app\.get\("\/api\/v1\/cademi\/entregas", rateLimit\(60\)/.test(code),
    "cademi/entregas mudou de limiter sem necessidade (não tem PII)");
});

check("E: o limite é por IP e por conta, com valores explícitos", () => {
  assert(/perIpPerMin:\s*\d+/.test(code), "sem limite por IP");
  assert(/perAccount:\s*\d+/.test(code), "sem limite por conta");
  assert(STUDENT_LOOKUP.perAccount > 0 && STUDENT_LOOKUP.windowMs > 0, "limites inválidos");
});

check("E: burst legítimo do widget não é bloqueado", () => {
  // consumo real medido no widget: ~5 chamadas por endpoint num checkout
  // (acesso: init/change/pay-click; histórico: init/refresh/poll), sem polling.
  const cenarios = [
    ["/api/v1/cademi/acesso", 5],
    ["/api/v1/payments/minha-historico", 5],
    ["/api/v1/cademi/nome", 1],
  ];
  for (const [rota, n] of cenarios) {
    for (let i = 0; i < n; i++) {
      const r = passar(studentLookupLimit(), req("10.0.0.9", { email: "aluno@exemplo.ao" }, rota));
      assert(r !== 429, `${rota}: bloqueio na chamada ${i + 1} de ${n} (partiria o checkout)`);
    }
  }
});

check("E: recarregar a página e repetir o clique em Pagar ainda passa", () => {
  // o aluno que volta do É-kwanza recarrega e clica outra vez: o burst sobe
  for (let sessoes = 0; sessoes < 3; sessoes++) {
    for (const rota of ["/api/v1/cademi/acesso", "/api/v1/payments/minha-historico", "/api/v1/cademi/nome"]) {
      const r = passar(studentLookupLimit(), req("10.0.0.9", { email: "aluno@exemplo.ao" }, rota));
      assert(r !== 429, `${rota} bloqueou na sessão ${sessoes + 1} (margem insuficiente)`);
    }
  }
});

check("ATAQUE: martelar uma conta a partir de vários IPs é travado", () => {
  // o limite por IP não apanha isto: cada pedido vem de um IP diferente.
  // o limite por conta tem de travar.
  let passou = 0;
  for (let i = 0; i < 40; i++) {
    const r = passar(studentLookupLimit(), req(`10.0.${Math.floor(i / 250)}.${i % 250}`, { email: "vitima@exemplo.ao" }, "/api/v1/payments/minha-historico"));
    if (r === 429) break;
    passou++;
  }
  assert(passou <= STUDENT_LOOKUP.perAccount,
    `deixou passar ${passou} pedidos sobre a mesma conta (limite é ${STUDENT_LOOKUP.perAccount})`);
  assert(passou < 40, "o martelão nunca foi travado");
});

check("ATAQUE: recolha em massa a partir de uma máquina é travada pelo limite por IP", () => {
  let passou = 0;
  for (let i = 0; i < 200; i++) {
    const r = passar(studentLookupLimit(), req("10.0.0.1", { email: `alvo${i}@exemplo.ao` }, "/api/v1/payments/minha-historico"));
    if (r === 429) break;
    passou++;
  }
  assert(passou <= STUDENT_LOOKUP.perIpPerMin, `passou ${passou} (limite por IP é ${STUDENT_LOOKUP.perIpPerMin})`);
});

check("a quota de uma conta não é gasta por outra", () => {
  for (let i = 0; i < 12; i++) {
    assert(passar(studentLookupLimit(), req("10.1.0.1", { email: "a@exemplo.ao" }, "/api/v1/payments/minha-historico")) !== 429, "conta A bloqueada cedo demais");
    assert(passar(studentLookupLimit(), req("10.1.0.2", { email: "b@exemplo.ao" }, "/api/v1/payments/minha-historico")) !== 429, "conta B bloqueada por causa de A");
  }
});

check("o mesmo email em endpoints diferentes tem quotas separadas", () => {
  // IPs distintos para isolar a dimensão "por endpoint" do limite por
  // conta: esgotar a quota de um endpoint não pode travar os outros.
  const rota = "/api/v1/payments/minha-historico";
  for (let i = 0; i < 20; i++) {
    passar(studentLookupLimit(), req(`10.9.1.${i}`, { email: "d@exemplo.ao" }, rota));
  }
  // a quota deste endpoint está esgotada
  assert(passar(studentLookupLimit(), req("10.9.2.1", { email: "d@exemplo.ao" }, rota)) === 429,
    "a quota por conta deste endpoint não foi esgotada");
  // mas o mesmo aluno continua a poder consultar os outros dois
  for (const outra of ["/api/v1/cademi/acesso", "/api/v1/cademi/nome"]) {
    const r = passar(studentLookupLimit(), req("10.9.3.1", { email: "d@exemplo.ao" }, outra));
    assert(r !== 429, `${outra} ficou bloqueado por esgotar a quota de ${rota}`);
  }
});

check("o burst real do widget cabe abaixo do limite por IP", () => {
  // IP limpo: os contadores por IP são globais ao módulo e os testes anteriores
  // já gastaram quota noutro endereço.
  // um checkout completo: 5 acessos + 5 histórico + 1 nome
  let total = 0;
  for (const [rota, n] of [["/api/v1/cademi/acesso", 5], ["/api/v1/payments/minha-historico", 5], ["/api/v1/cademi/nome", 1]]) {
    for (let i = 0; i < n; i++) {
      assert(passar(studentLookupLimit(), req("10.7.0.1", { email: "burst@exemplo.ao" }, rota)) !== 429, `${rota} bloqueou`);
      total++;
    }
  }
  assert(total <= STUDENT_LOOKUP.perIpPerMin,
    `o burst do widget (${total}) não cabia no limite por IP (${STUDENT_LOOKUP.perIpPerMin})`);
});

check("pedido sem email nem telefone segue para a validação (não é contado)", () => {
  assert(passar(studentLookupLimit(), req("10.3.0.1", {}, "/api/v1/payments/minha-historico")) === null,
    "sem chave, o limite não deve devolver 429");
});

check("a chave do limite por conta é o email normalizado", () => {
  for (let i = 0; i < 12; i++) {
    passar(studentLookupLimit(), req("10.4.0.1", { email: "Aluno@Exemplo.AO" }, "/api/v1/cademi/acesso"));
  }
  // agora o mesmo email em outra grafia tem de acabar batendo no mesmo limite
  const r = passar(studentLookupLimit(), req("10.5.0.1", { email: "  aluno@exemplo.ao  " }, "/api/v1/cademi/acesso"));
  assert(r === 429, "a normalização do email não está a funcionar no limite");
});

// ── E. o registo ──────────────────────────────────────────────────────────

check("E: as três leituras ficam registadas em audit_logs", () => {
  for (const ev of ["student.history_viewed", "student.access_viewed", "student.name_lookup"]) {
    assert(code.includes(`"${ev}"`), `falta o evento ${ev}`);
  }
});

check("E: o registo guarda o email como hash, nunca em claro", () => {
  for (const ev of ["student.history_viewed", "student.access_viewed", "student.name_lookup"]) {
    const i = code.indexOf(`"${ev}"`);
    const janela = code.slice(i, i + 220);
    assert(/email_hash:\s*emailRef\(/.test(janela), `${ev} não regista o email como hash`);
    assert(!/email:\s*email\b/.test(janela), `${ev} regista o email em claro`);
  }
});

check("E: o histórico não regista o email do aluno em claro em lado nenhum", () => {
  const i = code.indexOf('"student.history_viewed"');
  const janela = code.slice(i - 200, i + 400);
  assert(!/details:\s*\{[^}]*\bemail\s*:/.test(janela), "email em claro nos detalhes");
});

// ── resultado ─────────────────────────────────────────────────────────────
let ok = 0;
let ko = 0;
console.log(`\n  Harness: leituras públicas do widget — fase D + E\n`);
for (const c of cases) {
  console.log(`  ${c.ok ? "OK   " : "FALHA"} ${c.nome}`);
  if (!c.ok) console.log(`           -> ${c.erro}`);
  c.ok ? ok++ : ko++;
}
console.log(`\n  ${ok} OK, ${ko} FALHA\n`);
process.exit(ko === 0 ? 0 : 1);

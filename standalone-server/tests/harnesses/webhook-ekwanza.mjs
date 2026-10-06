// Harness de regressão de segurança — webhook É-kwanza.
// Não copia a lógica: EXTRAI o handler real de standalone-server/index.js e
// executa-o com pool/fetch/ambiente simulados. Assim o que é testado é o
// código que vai para produção.
//
// Invariante: o estado "confirmado" só pode ser alcançado quando a API oficial
// da É-kwanza confirma a carga. O operationStatus do callback (controlado por um
// atacante) nunca escolhe o estado final.

import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve(process.argv[2] ?? "standalone-server/index.js");
const code = fs.readFileSync(SRC, "utf8");

// ── invariantes verificadas directamente no código-fonte ──────────────────
if (/authoritativeSuccess \? "confirmado" : statusMap/.test(code)) {
  throw new Error("REGRESSÃO: o estado final voltou a depender do callback do atacante");
}
if (!/authoritativeSuccess \? "confirmado" : "rejeitado"/.test(code)) {
  throw new Error("a correcção fail-closed não está presente no código-fonte");
}

// ── extrair o handler real ────────────────────────────────────────────────
const start = code.indexOf('app.post("/webhooks/ekwanza"');
if (start < 0) throw new Error("rota /webhooks/ekwanza não encontrada");
const end = code.indexOf("\n});", start);
if (end < 0) throw new Error("fecho da rota não encontrado");

// o "});" que fecha a rota é também o "}" que fecha a arrow function
const arrow = code.slice(start, end).replace(/^app\.post\([^,]+,[^,]+,\s*/, "").trim() + "}";

const buildHandler = new Function(
  "pool, cfg, getEkwanzaToken, fetch, broadcastPaymentUpdate, sendCademiDelivery, console, audit",
  `return (${arrow});`
);

// ── infraestrutura de teste ───────────────────────────────────────────────
const SQL = [];

function makeRes() {
  const r = { _status: 200, _json: null };
  r.status = (s) => ((r._status = s), r);
  r.json = (b) => ((r._json = b), r);
  return r;
}

function makePool(payment) {
  return {
    async query(sql, params = []) {
      SQL.push({ sql, params });
      if (/^SELECT id, status, amount, metadata FROM payments/i.test(sql)) {
        return { rows: payment ? [payment] : [] };
      }
      return { rows: [] };
    },
  };
}

/** Cenário: chama o handler real e devolve o que ele fez. */
async function run({ payment, body, official }) {
  SQL.length = 0;
  const delivered = [];
  const broadcasted = [];

  const fetchStub =
    official === "throw"
      ? async () => {
          throw new Error("rede indisponivel");
        }
      : async () => ({ ok: true, json: async () => ({ payments: [{ status: official }] }) });

  const handler = buildHandler(
    makePool(payment),
    async (_k, d) => d,
    async () => "token-oficial",
    fetchStub,
    (m) => broadcasted.push(m),
    (c) => delivered.push(c),
    { log() {}, error() {} },
    () => {}
  );

  const res = makeRes();
  await handler({ body }, res);
  // a entrega ao Cademi é disparada com setImmediate: esvaziar a fase de check
  // antes de verificar os efeitos colaterais
  await new Promise((r) => setImmediate(r));

  const statusWrites = SQL.filter((s) => /UPDATE payments SET status/i.test(s.sql));
  const first = statusWrites[0];
  const finalStatus = !first
    ? null
    : /status = 'confirmado'/.test(first.sql)
      ? "confirmado"
      : (first.params?.[0] ?? null);

  return {
    http: res._status,
    body: res._json,
    finalStatus,
    statusWrites: statusWrites.length,
    metadataWrites: SQL.filter((s) => /SET metadata/i.test(s.sql)).length,
    metadata: SQL.find((s) => /SET metadata/i.test(s.sql))?.params?.[0] ?? "",
    delivered,
    broadcasted,
  };
}

const PAGO = { id: "p1", status: "pendente", amount: 5000, metadata: {} };
const COD = "PAY-ABC-123";

// ── matriz de verificação ─────────────────────────────────────────────────
const cases = [];
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};
const check = (nome, cond, extra) => {
  try {
    cond();
    cases.push({ nome, ok: true });
  } catch (e) {
    cases.push({ nome, ok: false, erro: extra ? `${e.message} (${extra})` : e.message });
  }
};

// ATAQUE — o bypass corrigido
{
  const r = await run({ payment: PAGO, body: { merchantTransactionId: COD, operationStatus: 1 }, official: "failed" });
  check("ATAQUE: oficial=failed + operationStatus=1 NÃO confirma", () => {
    assert(r.finalStatus !== "confirmado", `vazou o estado ${r.finalStatus}`);
    assert(r.statusWrites === 0, `escreveu status ${r.statusWrites}x`);
    assert(r.delivered.length === 0, "entregou o curso no Cademi");
    assert(r.body?.verified === false, "respondeu verified:true");
    assert(/confirmed_callback_without_authoritative_confirmation/.test(r.metadata), "não registou a divergência em metadata");
  });
}

// fluxos legítimos que NÃO podem regressar
{
  const r = await run({ payment: PAGO, body: { merchantTransactionId: COD, operationStatus: 1 }, official: "success" });
  check("LEGÍTIMO: oficial=success + status=1 confirma e entrega no Cademi", () => {
    assert(r.finalStatus === "confirmado", `esperado confirmado, obtido ${r.finalStatus}`);
    assert(r.delivered.length === 1, "não entregou o curso");
    assert(r.body?.verified === true, "respondeu verified:false");
  });
}

for (const [st, label] of [[3, "cancelado"], [4, "expirado"], [5, "falhado"]]) {
  const r = await run({ payment: PAGO, body: { merchantTransactionId: COD, operationStatus: st }, official: "failed" });
  check(`LEGÍTIMO: oficial=failed + status=${st} (${label}) rejeita`, () => {
    assert(r.finalStatus === "rejeitado", `esperado rejeitado, obtido ${r.finalStatus}`);
    assert(r.delivered.length === 0, "entregou apesar de rejeitado");
    assert(r.body?.verified === true, "respondeu verified:false");
  });
}

// demais estados não-sucedidos da API oficial
for (const off of ["pending", "expired", "cancelled", "unknown"]) {
  const r = await run({ payment: PAGO, body: { merchantTransactionId: COD, operationStatus: 1 }, official: off });
  check(`oficial=${off} nunca confirma`, () => assert(r.finalStatus !== "confirmado", `vazou ${r.finalStatus}`));
}

// confirmação oficial indisponível
{
  const r = await run({ payment: PAGO, body: { merchantTransactionId: COD, operationStatus: 1 }, official: "throw" });
  check("oficial indisponível: não confirma nem rejeita, fica por resolver", () => {
    assert(r.finalStatus === null, `escreveu estado ${r.finalStatus}`);
    assert(r.statusWrites === 0, "escreveu status sem confirmação oficial");
    assert(r.body?.verified === false, "respondeu verified:true");
  });
}

// validações de entrada
{
  const r = await run({ payment: PAGO, body: { merchantTransactionId: COD, operationStatus: 1, operationData: { amount: 1 } }, official: "success" });
  check("montante divergente: bloqueado antes de confirmar", () => {
    assert(r.finalStatus === null, `confirmou apesar do amount mismatch: ${r.finalStatus}`);
    assert(r.body?.verified === false, "respondeu verified:true com montante errado");
  });
}

{
  const r = await run({ payment: null, body: { merchantTransactionId: "DESCONHECIDO", operationStatus: 1 }, official: "success" });
  check("código inexistente: não cria pagamento nem enumera", () => {
    assert(r.statusWrites === 0 && r.metadataWrites === 0, "escreveu na BD para código desconhecido");
    assert(r.body?.received === true, "não respondeu received:true");
  });
}

{
  const r = await run({ payment: { ...PAGO, metadata: { cancelled_by_user: true } }, body: { merchantTransactionId: COD, operationStatus: 1 }, official: "success" });
  check("cancelado pelo utilizador: ignorado mesmo com sucesso oficial", () => {
    assert(r.statusWrites === 0, "confirmou um pagamento cancelado");
    assert(r.body?.ignored === true, "não marcou ignored");
  });
}

for (const st of [0, 2, 6, 99, null, "abc", "1 OR 1=1"]) {
  const r = await run({ payment: PAGO, body: { merchantTransactionId: COD, operationStatus: st }, official: "success" });
  check(`operationStatus inválido (${JSON.stringify(st)}) → 400`, () => {
    assert(r.http === 400, `esperado 400, obtido ${r.http}`);
    assert(r.statusWrites === 0, "escreveu status com status inválido");
  });
}

{
  const r = await run({ payment: PAGO, body: { operationStatus: 1 }, official: "success" });
  check("sem merchantTransactionId → 400", () => assert(r.http === 400, `esperado 400, obtido ${r.http}`));
}

{
  const r = await run({ payment: PAGO, body: { merchantTransactionId: "x".repeat(101), operationStatus: 1 }, official: "success" });
  check("merchantTransactionId gigante → 400", () => assert(r.http === 400, `esperado 400, obtido ${r.http}`));
}

// varrimento exaustivo
{
  let vazou = 0;
  let confirmados = 0;
  for (const st of [1, 3, 4, 5]) {
    for (const off of ["failed", "pending", "expired", "cancelled", "unknown", "throw"]) {
      const r = await run({ payment: PAGO, body: { merchantTransactionId: COD, operationStatus: st }, official: off });
      if (r.finalStatus === "confirmado" || r.delivered.length > 0) vazou++;
      if (r.finalStatus === "confirmado") confirmados++;
    }
  }
  check(`varrimento 24 combinações: só a API oficial pode confirmar (confirmados=${confirmados}, vazamentos=${vazou})`, () => {
    assert(vazou === 0, `${vazou} combinações confirmaram sem a API oficial`);
    assert(confirmados === 0, `${confirmados} confirmações indevidas`);
  });
}

// ── resultado ─────────────────────────────────────────────────────────────
let ok = 0;
let ko = 0;
console.log(`\n  Harness: webhook É-kwanza (handler extraído de ${path.basename(SRC)})\n`);
for (const c of cases) {
  console.log(`  ${c.ok ? "OK   " : "FALHA"} ${c.nome}`);
  if (!c.ok) console.log(`           -> ${c.erro}`);
  c.ok ? ok++ : ko++;
}
console.log(`\n  ${ok} OK, ${ko} FALHA\n`);
process.exit(ko === 0 ? 0 : 1);

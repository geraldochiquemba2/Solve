// Harness de regressão de segurança — registo de eventos (audit_logs).
// Verifica três coisas no código real:
//  1. Os eventos de segurança são efectivamente registados.
//  2. Nenhum payload leva PII (email, password, token de reset, JWT).
//  3. Uma falha na escrita do log nunca faz falhar o pedido.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const SRC = path.resolve(process.argv[2] ?? "standalone-server/index.js");
const code = fs.readFileSync(SRC, "utf8");

// ── extracção do bloco audit/emailRef ─────────────────────────────────────
const start = code.indexOf("function audit(req, action,");
const end = code.indexOf("const CORS_ORIGIN =");
if (start < 0 || end < 0) throw new Error("bloco de audit não encontrado");
const auditBlock = code.slice(start, end);

const INSERT_RE = /INSERT INTO audit_logs \(([^)]*)\)\s*VALUES \(\$1, \$2, \$3, \$4, \$5, \$6, \$7\)/;
if (!INSERT_RE.test(code)) {
  throw new Error("REGRESSÃO: o insert em audit_logs mudou ( Rever a contagem de parâmetros)");
}

// ── módulo real ───────────────────────────────────────────────────────────
function buildAudit(pool) {
  return new Function("crypto", "pool", `${auditBlock}\nreturn { audit, emailRef };`)(crypto, pool);
}

// ── duplo de BD ───────────────────────────────────────────────────────────
function makePool(behavior = "ok") {
  const written = [];
  return {
    written,
    async query(sql, params) {
      written.push({ sql, params });
      if (behavior === "throw") throw new Error("BD indisponível");
      if (behavior === "reject") return Promise.reject(new Error("audit_logs não existe"));
      return { rows: [] };
    },
  };
}

const req = { ip: "203.0.113.9", socket: {} };

// ── matriz ────────────────────────────────────────────────────────────────
const cases = [];
const assert = (c, m) => { if (!c) throw new Error(m); };
const check = async (nome, fn) => {
  try { await fn(); cases.push({ nome, ok: true }); }
  catch (e) { cases.push({ nome, ok: false, erro: e.message }); }
};

await check("audit grava uma linha com os 7 campos", async () => {
  const pool = makePool();
  buildAudit(pool).audit(req, "auth.login_ok", { actorId: "u-1", details: { role: "gestor" } });
  await new Promise((r) => setImmediate(r));
  assert(pool.written.length === 1, `escreveu ${pool.written.length} linhas`);
  const [linha] = pool.written;
  assert(/INSERT INTO audit_logs/.test(linha.sql), "não é um insert em audit_logs");
  assert(linha.params.length === 7, `esperava 7 parâmetros, recebeu ${linha.params.length}`);
  assert(linha.params[2] === "auth.login_ok", `action errada: ${linha.params[2]}`);
});

await check("o details vai como jsonb válido", async () => {
  const pool = makePool();
  buildAudit(pool).audit(req, "x.y", { details: { motivo: "teste", n: 1 } });
  await new Promise((r) => setImmediate(r));
  const det = JSON.parse(pool.written[0].params[5]);
  assert(det.motivo === "teste" && det.n === 1, `details: ${pool.written[0].params[5]}`);
});

await check("sem details grava null (não a string 'undefined')", async () => {
  const pool = makePool();
  buildAudit(pool).audit(req, "x.y");
  await new Promise((r) => setImmediate(r));
  assert(pool.written[0].params[5] === null, `details = ${pool.written[0].params[5]}`);
});

await check("ip truncado a 50 chars (limite da coluna)", async () => {
  const pool = makePool();
  buildAudit(pool).audit({ ip: "9".repeat(200) }, "x.y");
  await new Promise((r) => setImmediate(r));
  assert(pool.written[0].params[6].length === 50, `ip com ${pool.written[0].params[6].length} chars`);
});

await check("campos text truncados (actor/action/entity)", async () => {
  const pool = makePool();
  buildAudit(pool).audit(req, "y".repeat(400), { actor: "z".repeat(400), entity: "e".repeat(400) });
  await new Promise((r) => setImmediate(r));
  const [a, act, ent] = [pool.written[0].params[0], pool.written[0].params[2], pool.written[0].params[3]];
  assert(a.length === 255 && act.length === 255 && ent.length === 100,
    `limites: actor=${a.length} action=${act.length} entity=${ent.length}`);
});

// PII — o ponto mais importante
await check("emailRef não guarda o email (só hash truncado)", async () => {
  const { emailRef } = buildAudit(makePool());
  const ref = emailRef("Ana.Silva@Solve.AO");
  assert(!ref.includes("@"), "o email está no ref");
  assert(!/ana|solve/i.test(ref), `o ref parece conter o email: ${ref}`);
  assert(ref.length === 16, `comprimento inesperado: ${ref.length}`);
});

await check("emailRef normaliza (maiúsculas/espaços) e distingue contas", async () => {
  const { emailRef } = buildAudit(makePool());
  assert(emailRef("Ana@Solve.AO") === emailRef("  ana@solve.ao  "), "não normalizou");
  assert(emailRef("ana@solve.ao") !== emailRef("bruno@solve.ao"), "contas diferentes deu o mesmo ref");
});

await check("emailRef(null) devolve null", async () => {
  const { emailRef } = buildAudit(makePool());
  for (const v of [null, undefined, ""]) assert(emailRef(v) === null, `${JSON.stringify(v)} -> ${emailRef(v)}`);
});

await check("nenhum email/password/token em texto claro nos payloads de audit", async () => {
  const segredos = [
    "Ana.Silva@Solve.AO",
    "senha-super-secreta-123",
    "tokendesecaoabcdef",
    "a".repeat(64), // formato do token de reset
  ];
  // extrai todos os payload de audit() do ficheiro real
  const calls = [...code.matchAll(/audit\(req,\s*"([^"]+)",\s*(\{[\s\S]*?\})\s*\);/g)];
  assert(calls.length >= 10, `esperava >=10 chamadas de audit, encontrei ${calls.length}`);
  for (const [, action, payload] of calls) {
    for (const seg of segredos) {
      if (payload.includes(seg)) {
        throw new Error(`evento "${action}" embute um segredo/PII em texto claro`);
      }
    }
  }
});

await check("os eventos cobrem os ataques que interessam", async () => {
  const acoes = [...code.matchAll(/audit\(req,\s*"([^"]+)"/g)].map((m) => m[1]);
  const esperadas = [
    "auth.login_ok",
    "auth.login_failed",
    "auth.csrf_rejected",
    "auth.session_revoked",
    "auth.password_reset_requested",
    "auth.password_changed",
    "payment.webhook_unverified",
  ];
  for (const e of esperadas) {
    assert(acoes.includes(e), `falta o evento ${e}`);
  }
});

await check("nenhum campo de password/email/token é copiado para o actor/details", async () => {
  // o login usa emailRef(email), não email
  const linhaLogin = /auth\.login_failed[\s\S]{0,200}/.exec(code)?.[0] ?? "";
  assert(/email_hash: emailRef\(email\)/.test(linhaLogin), "o login não usa o hash do email");
  assert(!/details:\s*\{[^}]*\bemail\s*:/.test(linhaLogin), "o email entrou em claro no details");
});

// resiliência
await check("BD que lança não propaga (fire-and-forget)", async () => {
  const { audit } = buildAudit(makePool("throw"));
  audit(req, "x.y"); // não pode lançar
  await new Promise((r) => setImmediate(r));
});

await check("BD que rejeita (tabela em falta) não propaga", async () => {
  const { audit } = buildAudit(makePool("reject"));
  audit(req, "x.y");
  await new Promise((r) => setImmediate(r));
});

await check("req sem ip não rebenta", async () => {
  const pool = makePool();
  const { audit } = buildAudit(pool);
  audit(undefined, "x.y");
  audit({}, "x.y");
  audit({ socket: { remoteAddress: "10.0.0.1" } }, "x.y");
  await new Promise((r) => setImmediate(r));
  assert(pool.written.length === 3, `escreveu ${pool.written.length}/3`);
  assert(pool.written[2].params[6] === "10.0.0.1", `ip do socket: ${pool.written[2].params[6]}`);
});

await check("actor por omissão é 'sistema'", async () => {
  const pool = makePool();
  buildAudit(pool).audit(req, "x.y");
  await new Promise((r) => setImmediate(r));
  assert(pool.written[0].params[0] === "sistema", `actor = ${pool.written[0].params[0]}`);
});

// ── resultado ─────────────────────────────────────────────────────────────
let ok = 0;
let ko = 0;
console.log(`\n  Harness: registo de eventos (de ${path.basename(SRC)})\n`);
for (const c of cases) {
  console.log(`  ${c.ok ? "OK   " : "FALHA"} ${c.nome}`);
  if (!c.ok) console.log(`           -> ${c.erro}`);
  c.ok ? ok++ : ko++;
}
console.log(`\n  ${ok} OK, ${ko} FALHA\n`);
process.exit(ko === 0 ? 0 : 1);

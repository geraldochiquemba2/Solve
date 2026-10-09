// Harness de regressão — conversão do esquema legado de promo_codes/promo_usages.
//
// Causa do 500 em /api/v1/promos*: `ALTER TABLE ... RENAME TO` NÃO renomeia os
// índices/constraints em PostgreSQL. Os nomes auto-gerados (promo_codes_pkey,
// promo_codes_code_key, promo_usages_pkey, idx_promo_usages_*) ficavam presos à
// tabela antiga e colidiam com a tabela nova (o PK rebentava com "relation
// already exists" e os CREATE INDEX IF NOT EXISTS ficavam no-op), o que fazia a
// conversão rebentar -> ROLLBACK -> 500.
//
// Extrai freeLegacyIndexNames do index.js real e verifica que liberta todos os
// nomes de índices (incluindo os que suportam PK/UNIQUE) antes do CREATE TABLE.

import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve(process.argv[2] ?? "standalone-server/index.js");
const code = fs.readFileSync(SRC, "utf8");

// ── extracção ───────────────────────────────────────────────────────────────
const MARK = "async function freeLegacyIndexNames(client, legacyTable) {";
const inicio = code.indexOf(MARK);
if (inicio < 0) throw new Error("freeLegacyIndexNames não encontrada no index.js");
const m = /\r?\n\}\r?\n/.exec(code.slice(inicio));
if (!m) throw new Error("fecho de freeLegacyIndexNames não encontrado");
const fnSrc = code.slice(inicio, inicio + m.index + m[0].length);

const freeLegacyIndexNames = new Function(`${fnSrc}\nreturn freeLegacyIndexNames;`)();

// ── duplos ──────────────────────────────────────────────────────────────────
function fakeClient(indexes) {
  const renamed = [];
  return {
    renamed,
    async query(sql) {
      if (/pg_index/.test(sql)) return { rows: indexes.map((indexname) => ({ indexname })) };
      const m = /ALTER INDEX "([^"]+)" RENAME TO "([^"]+)"/.exec(sql);
      if (m) { renamed.push({ from: m[1], to: m[2] }); }
      return { rows: [] };
    },
  };
}

// ── verificações ────────────────────────────────────────────────────────────
const cases = [];
const ok = (c, m) => { if (!c) throw new Error(m); };
async function check(nome, fn) {
  try { await fn(); cases.push({ nome, ok: true }); }
  catch (e) { cases.push({ nome, ok: false, erro: e.message }); }
}

const INDEXES = ["promo_codes_pkey", "promo_codes_code_key", "idx_promo_usages_promo_id"];

await check("liberta todos os índices da tabela legada (PK, UNIQUE e simples)", async () => {
  const c = fakeClient(INDEXES);
  await freeLegacyIndexNames(c, "promo_codes_legacy");
  for (const nome of INDEXES) {
    ok(c.renamed.some((r) => r.from === nome), `índice não renomeado: ${nome}`);
  }
});

await check("os nomes novos são únicos, diferentes e cabem no limite de 63 chars", async () => {
  const c = fakeClient(INDEXES);
  await freeLegacyIndexNames(c, "promo_codes_legacy");
  const destinos = c.renamed.map((r) => r.to);
  ok(destinos.length === INDEXES.length, "nº de renomeações inesperado");
  ok(new Set(destinos).size === destinos.length, "destinos repetidos");
  for (const r of c.renamed) {
    ok(r.to !== r.from, `sem alteração em ${r.from}`);
    ok(r.to.length <= 63, `nome excedeu 63 chars: ${r.to}`);
  }
});

await check("tabela sem índices não rebenta (pg_index vazio)", async () => {
  const c = fakeClient([]);
  await freeLegacyIndexNames(c, "promo_codes_legacy");
  ok(c.renamed.length === 0, "renomeou algo sem índices");
});

await check("liberta o nome do PK antes do CREATE TABLE novo (promo_codes)", async () => {
  const ordem = /ALTER TABLE promo_codes RENAME TO promo_codes_legacy[\s\S]*?freeLegacyIndexNames\(client, "promo_codes_legacy"\)[\s\S]*?PROMO_CODES_DDL/;
  ok(ordem.test(code), "promo_codes: index names não são libertados antes do CREATE TABLE");
});

await check("liberta o nome do PK antes do CREATE TABLE novo (promo_usages)", async () => {
  const ordem = /ALTER TABLE promo_usages RENAME TO promo_usages_legacy[\s\S]*?freeLegacyIndexNames\(client, "promo_usages_legacy"\)[\s\S]*?PROMO_USAGES_DDL/;
  ok(ordem.test(code), "promo_usages: index names não são libertados antes do CREATE TABLE");
});

// ── resultado ───────────────────────────────────────────────────────────────
let passou = 0;
let falhou = 0;
console.log(`\n  Harness: conversão do esquema legado de promos (de ${path.basename(SRC)})\n`);
for (const x of cases) {
  console.log(`  ${x.ok ? "OK   " : "FALHA"} ${x.nome}`);
  if (!x.ok) console.log(`           -> ${x.erro}`);
  x.ok ? passou++ : falhou++;
}
console.log(`\n  ${passou} OK, ${falhou} FALHA\n`);
process.exit(falhou === 0 ? 0 : 1);

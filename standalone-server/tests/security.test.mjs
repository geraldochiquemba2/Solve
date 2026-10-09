// Ponto de entrada dos testes de segurança do servidor standalone.
//
// Usa apenas o runner nativo do Node (`node --test`), pelo que não acrescenta
// dependências ao projecto. Cada harness é executado como processo separado —
// é a única forma de testar o `index.js` real, que faz `app.listen()` no
// arranque e liga-se à base de dados.
//
//   cd standalone-server && node --test "tests/*.test.mjs"
//
// (o runner do Node não aceita `tests/` como directório neste setup: o script
//  `pnpm test` do standalone-server já usa o padrão glob.)
//
// Os harnesses extraem o código sob teste directamente do `index.js`, por isso
// passam a falhar se alguém alterar a lógica sem actualizar a protecção.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ_REPO = path.resolve(AQUI, "..", "..");
const INDEX = path.join(RAIZ_REPO, "standalone-server", "index.js");

const HARNESSES = [
  ["webhook É-kwanza fail-closed", "webhook-ekwanza.mjs", 23],
  ["CSRF (double-submit assinado)", "csrf.mjs", 23],
  ["revogação de sessão e reset de password", "sessao-reset.mjs", 18],
  ["timing de login e limite por conta", "login-timing.mjs", 10],
  ["registo de eventos em audit_logs", "audit-log.mjs", 15],
  ["headers, CORS e cookies", "headers-cors.mjs", 21],
  ["leituras públicas do widget Cademi", "public-lookup.mjs", 23],
  ["painel /admin e RBAC de gestão", "admin-guard.mjs", 25],
  ["conversão do esquema legado de promos", "promo-schema.mjs", 6],
];

function correrHarness(ficheiro) {
  return new Promise((resolve) => {
    const filho = spawn(process.execPath, [
      path.join(AQUI, "harnesses", ficheiro),
      INDEX,
      path.join(RAIZ_REPO, "standalone-server", "public", "pay-widget.js"),
    ], {
      cwd: RAIZ_REPO,
      env: { ...process.env, NODE_ENV: "test" },
    });
    let saida = "";
    let erros = "";
    filho.stdout.on("data", (d) => { saida += d; });
    filho.stderr.on("data", (d) => { erros += d; });
    filho.on("close", (code) => resolve({ code, saida, erros }));
  });
}

for (const [nome, ficheiro, esperado] of HARNESSES) {
  test(nome, async () => {
    const { code, saida, erros } = await correrHarness(ficheiro);
    if (code !== 0) {
      assert.fail(`${ficheiro} falhou (exit ${code})\n${saida}${erros}`);
    }
    const m = /(\d+)\s+OK,\s+(\d+)\s+FALHA/.exec(saida);
    assert.ok(m, `${ficheiro} não reportou o resumo "N OK, M FALHA":\n${saida}`);
    const [, ok, ko] = m.map(Number);
    assert.equal(ko, 0, `${ficheiro} teve ${ko} falhas`);
    assert.equal(ok, esperado, `${ficheiro} executou ${ok} verificações, esperava ${esperado}`);
  });
}

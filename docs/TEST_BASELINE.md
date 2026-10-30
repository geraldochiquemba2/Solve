# Baseline de Testes — Módulo 0

**Data:** 2026-10-30  
**Repositório:** `Solve/`  
**Objetivo:** registar o comportamento atual dos testes, incluindo falhas, skips e causa do timeout.

## 1. Resumo

| Verificação | Resultado |
|---|---|
| Testes standalone (`node --test`) | **25/25 pass**, 0 fail, 3,36 s |
| Testes da API, configuração por omissão | **1 suite falhou**, 92 pass, 33 skipped (125), 27,46 s |
| Testes da API com `--hookTimeout=60000` | **125/125 pass**, 9/9 suites, 35,26 s |
| Typecheck final | **Pass** (`EXIT=0`) |
| Build da raiz | **Pass** (`EXIT=0`) |
| Lint | **Não existe script** |
| CI do projeto | **Não encontrada configuração** |
| Testes E2E / Docker / Render | **Não executados** |

Conclusão: não há evidência de um teste funcional quebrado. A falha por omissão é um problema de tempo de arranque do `beforeAll` da suite de segurança, agravado por cache frio e pelo custo de importação da aplicação completa.

## 2. Configuração dos testes da API

- Runner: Vitest `^5.0.0`.
- Comando do package: `vitest run`.
- Ambiente: `node`.
- Ficheiro de setup: `apps/api/src/__tests__/setup.ts`.
- `include`: `src/__tests__/**/*.test.ts`.
- `hookTimeout` e `testTimeout`: não definidos em `vitest.config.ts`.
- Cobertura: provider `v8`, mas não foi executada nesta baseline.
- O setup mocka `@workspace/db` e `@workspace/api-zod`; não há base de dados real.
- Os testes usam `supertest` e, na suite de segurança, sockets TCP crus para enviar paths sem normalização.
- Aliases de Vitest apontam `@workspace/db`, `@workspace/db/schema` e `@workspace/api-zod` para o código-fonte do workspace.

### Ficheiros de teste

1. `auth.test.ts`
2. `customers.test.ts`
3. `ekwanza.test.ts`
4. `health.test.ts`
5. `payments.test.ts`
6. `plans.test.ts`
7. `portal.test.ts`
8. `promos.test.ts`
9. `security-regression.test.ts`

A contagem de 125 vem das expansões de `it.each`; não corresponde a 125 ficheiros.

## 3. API — configuração por omissão

Comando:

```powershell
pnpm --filter @workspace/api-server test
```

Resultado observado:

```text
Test Files  1 failed | 8 passed (9)
Tests       92 passed | 33 skipped (125)
Duration    27.46s
EXIT=1
```

Falha:

```text
FAIL src/__tests__/security-regression.test.ts
Error: Hook timed out in 10000ms.
```

Efeito: o `beforeAll` não terminou dentro dos 10 s por omissão. A suite é reportada como falhada e todos os seus testes ficam skipped; os outros oito ficheiros continuam a passar.

## 4. Os 33 testes skipped

Todos os 33 pertencem a `security-regression.test.ts`:

| Grupo | Testes | O que cobre |
|---|---:|---|
| Redirects legítimos `/api/*` → `/api/v1/*` | 13 | 11 rotas reais via `supertest`, preservação de `%20` e não-redirect de `/api/v1/*` |
| Ataques com bytes crus | 13 | 9 paths maliciosos, espaço literal, injeção CRLF, travessia de path e ausência de `Location` externo |
| `resolveAllowedOrigin` | 4 | allowlist, prefixo enganador, ausência de `Origin` e proibição de wildcard |
| CORS sem wildcard | 3 | pedido sem `Origin`, origem não permitida e preflight |

Contagem: 13 + 13 + 4 + 3 = 33.

Não foi observada falha de asserção nesses testes; eles não chegam a correr por causa do timeout do hook.

## 5. Causa do timeout

O `beforeAll` faz importação dinâmica de `../app`:

```ts
app = (await import("../app")).default;
```

`app.ts` importa o router principal, que carrega a árvore completa de rotas, middlewares, bibliotecas e schema. Medições de diagnóstico:

| Medição | Tempo |
|---|---:|
| Importação de `app` | ~8,2 s |
| `drizzle-orm` (cold) | ~2,9 s |
| `@workspace/db/schema` (cumulativo) | ~4,5 s |
| Suite completa com hook alargado | 35,26 s |

O valor de ~8,2 s já consome a maior parte do limite de 10 s; o restante (transformação, `app.listen`, carregamento de dependências e cache frio no Windows) faz o hook exceder o limite. O problema é de **tempo de importação/arranque**, não de lógica dos testes.

Factores que aumentam o custo:

- Árvore de rotas extensa (22 módulos de rotas agregados).
- `@workspace/db/schema` importa Drizzle e muitas tabelas.
- `packages/api-zod` tem 111 ficheiros gerados; o setup mocka o entrypoint, mas o restante workspace e a transformação de módulos continuam pesados.
- Cache frio e sistema de ficheiros Windows.
- Nenhum `hookTimeout` explícito em `vitest.config.ts`.

## 6. API — hook alargado

Comando:

```powershell
pnpm --filter @workspace/api-server exec vitest run --hookTimeout=60000
```

Resultado:

```text
Test Files  9 passed (9)
Tests       125 passed (125)
Duration    35.26s
EXIT=0
```

O flag altera apenas o limite do hook; não altera código de produção nem o comportamento dos testes. Confirma que os 33 testes de segurança passam quando têm tempo para arrancar.

### Correção futura (não aplicada neste módulo)

Opções a avaliar num módulo de correção:

1. Definir `hookTimeout` adequado em `vitest.config.ts` (por exemplo, 60 s) e documentar o motivo.
2. Evitar importar a aplicação completa num único hook; criar uma factory de app testável e reutilizável.
3. Pré-construir ou reduzir a árvore de imports do schema/route tree.
4. Separar testes de segurança que precisam de socket cru dos testes de contrato.

Nenhuma destas alterações foi implementada.

## 7. Testes standalone

Comando:

```powershell
npm test --prefix standalone-server
```

Resultado:

```text
tests 25
pass 25
fail 0
skipped 0
duration_ms 3362.6563
EXIT=0
```

Cobertura observada:

- canonicalização de aliases e eventos de automação;
- outbox, idempotência e dry-run;
- opt-out;
- HMAC e challenge do WhatsApp;
- envio, normalização de telefone, timeout e erros da Meta;
- webhook inbound idempotente;
- portal e resposta genérica;
- É-kwanza fail-closed;
- CSRF;
- revogação de sessão e reset de password;
- timing de login e limite por conta;
- `audit_logs`;
- headers, CORS e cookies;
- leituras públicas do widget Cademi;
- `/admin` e RBAC;
- conversão de promos legadas;
- integração Studio (registo, API key, upsert e delete).

### Limitação importante

`standalone-server/node_modules` não existe e não foi executado `npm ci` real no diretório. O runner usa módulos locais e harnesses que extraem lógica do `index.js`; não arranca o servidor completo com Express, pool Postgres e variáveis de produção. Portanto:

- os 25/25 validam lógica e proteções extraídas;
- não validam o arranque do contentor;
- não validam migrações/DDL de bootstrap;
- não substituem um smoke test Docker/Render.

## 8. Typecheck e build

### Typecheck

Estado inicial: `pnpm run typecheck` → `EXIT=2`.

Erros principais:

- `packages/api-client-react`: `TS2307` para `@tanstack/react-query`;
- erros implícitos `TS7006`/`TS7031` no código gerado;
- `apps/web`: `TS6305` por falta de `dist` do pacote gerado e `TS7006` em `App.tsx`.

Causa imediata: instalação incompleta do workspace; `packages/api-client-react/node_modules` não existia. Após instalação pnpm, o typecheck da raiz passou (`EXIT=0`). Isto é uma condição de ambiente, mas deve ser verificada numa instalação limpa.

### Build

Comando: `pnpm run build` com `PORT=5173` e `BASE_PATH=/` definidos no ambiente.

Resultado: `EXIT=0`.

- API: `dist/index.mjs` com 2,3 MB.
- Frontend: 2471 módulos transformados; `dist/public` gerado.
- Aviso não fatal de sourcemap em `tooltip.tsx`.

## 9. Qualidade e automação

- Não há script `lint` na raiz, em `apps/api`, `apps/web` ou `standalone-server`.
- Não há script de teste na raiz.
- Não foi encontrada configuração CI do projeto.
- Não foram executados: `pnpm audit`, testes E2E, testes de carga, testes de acessibilidade, build Docker, smoke test Render, migrações.
- Não houve acesso a base de dados real.

## 10. Reprodução recomendada

```powershell
# 1. Instalação congelada
pnpm install --frozen-lockfile

# 2. Typecheck
pnpm run typecheck

# 3. Testes standalone
npm test --prefix standalone-server

# 4. Testes da API por omissão
pnpm --filter @workspace/api-server test

# 5. Testes da API com timeout de hook explícito
pnpm --filter @workspace/api-server exec vitest run --hookTimeout=60000

# 6. Build
$env:PORT="5173"; $env:BASE_PATH="/"; pnpm run build
```

O passo 4 deve continuar a falhar até o `hookTimeout` ser corrigido; o passo 5 é a baseline funcional válida.

## 11. Critérios de aceitação para o próximo baseline

- `pnpm install --frozen-lockfile` numa máquina/CI limpa.
- `pnpm run typecheck` sem erros.
- Testes standalone 25/25.
- Testes da API 125/125 com timeout documentado.
- Build da raiz sem erros.
- Build Docker sem deploy.
- Smoke test do contentor em `/healthz` e rotas críticas.
- Nenhum teste skipped sem justificação.
- Relatório de lint e auditoria de dependências, quando existirem ferramentas definidas.

## 12. Limitações

- Os resultados foram obtidos numa máquina Windows com cache aquecido após instalação; numa CI limpa os tempos podem variar.
- O timeout é sensível ao desempenho do sistema; 8,2 s de importação é uma medição, não uma garantia.
- A suite da API usa mocks; não prova integração real com Postgres.
- Os testes standalone extraem lógica e não exercitam o servidor completo.
- Não foi possível afirmar paridade entre `apps/api` e `standalone-server` apenas pelos testes.
- A contagem de 33 skipped refere-se à execução por omissão; não é uma lista de testes permanentemente ignorados.

## 13. Ficheiros consultados

- `apps/api/package.json`, `apps/api/vitest.config.ts`, `apps/api/src/__tests__/setup.ts`.
- `apps/api/src/__tests__/*.test.ts`, com destaque para `security-regression.test.ts`.
- `apps/api/src/app.ts`, `apps/api/src/routes/index.ts`, `apps/api/src/routes/*`, `apps/api/src/lib/cors.ts`.
- `packages/db/src/schema/index.ts`, `packages/api-zod/src/generated/**`.
- `standalone-server/package.json`, `standalone-server/tests/*.test.mjs`, `standalone-server/tests/harnesses/*`, `standalone-server/index.js`.
- `package.json`, `pnpm-lock.yaml`, `Dockerfile`.

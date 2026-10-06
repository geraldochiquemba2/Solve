# Estrutura do Repositório

Mapa completo do que existe em disco e em Git, verificado em 2026-10-05.

> **316 ficheiros rastreados** (depois da limpeza desta auditoria).
> Complementos: `docs/architecture.md` (o quê e porquê), `docs/workflows.md` (como corre), `docs/database.md` (base de dados).

---

## 1. Visão geral

| | |
|---|---|
| Tipo | Monorepo **pnpm** + 1 projeto npm isolado |
| Branch ativa | `main` |
| Paketes no workspace | `apps/*` (2), `packages/*` (4), `scripts` (1) |
| Fora do workspace | **`standalone-server`** (npm próprio, produção) |
| Deploy | Render, via `Dockerfile` multi-stage |
| CI/CD | **Nenhum.** Não existe `.github/`. Deploy = `git push main` |

---

## 2. Árvore

```text
Solve-1/
├── apps/
│   ├── api/                          @workspace/api-server   API local/catraca (Express+TS+Drizzle)
│   │   ├── build.mjs                 build (bundle -> dist/index.mjs)
│   │   ├── package.json               dev | build | start | test | typecheck
│   │   └── src/
│   │       ├── __tests__/            testes vitest
│   │       ├── lib/                  cademi, ekwanza, ovg, ovg-sync, whatsapp, logger, automation-engine
│   │       ├── middlewares/          auth, rate-limit
│   │       ├── routes/               22 modulos (auth, leads, payments, portal, cademi, ...)
│   │       ├── app.ts, index.ts, openapi.ts
│   │       └── types.ts
│   └── web/                          @workspace/solve-crm    Frontend (React+Vite+Wouter)
│       ├── components.json           design-system shadcn
│       ├── dev.ps1                   script de dev (corrigido nesta auditoria)
│       ├── index.html, vite.config.ts, tsconfig.json
│       ├── public/                   estaticos servidos como /...
│       └── src/
│           ├── App.tsx               ⚠️ 2748 linhas, 122 `any`
│           ├── components/           componentes partilhados
│           ├── hooks/                use-auth, use-api, use-cms, use-dashboard, use-leads, ...
│           ├── landing/              Login, FitStudio, sections/, layout/, services/
│           ├── lib/                  api.ts, relatorios.ts, cn.ts
│           └── portal/               PortalShell, api.ts
│
├── packages/
│   ├── api-spec/                     @workspace/api-spec     Contrato OpenAPI + orval
│   ├── api-zod/                      @workspace/api-zod      Schemas Zod GERADOS
│   ├── api-client-react/             @workspace/api-client-react   Cliente React Query GERADO
│   └── db/                           @workspace/db           Schema Drizzle + migrations + 20 scripts .cjs
│       ├── drizzle/                  0000..0003 + meta/_journal.json
│       ├── src/schema/index.ts       8 enums, 21 tabelas, 4 relations
│       ├── drizzle.config.ts
│       ├── migrate-delta.cjs, add-indexes.cjs, push-schema.{cjs,mjs}
│       ├── ovg-reseed.cjs            ⭐ usado por sincronizar-ovg.cmd
│       ├── seed-plans.cjs, clear-data.cjs, ...
│       └── package.json              push | push-force
│
├── standalone-server/                solve-crm-api           ⭐ PRODUÇÃO (npm, FORA do workspace pnpm)
│   ├── index.js                      ⚠️ 3667 linhas, ~95 rotas, SQL raw, DDL no arranque
│   ├── public/pay-widget.js          checkout embebido (XSS corrigido nesta auditoria)
│   ├── package.json                  sem scripts
│   └── package-lock.json             ⭐ OBRIGATÓRIO (npm ci no Docker)
│
├── scripts/                          @workspace/scripts      push-schema (SQL bruto da migration 0000)
│
├── supabase/                         Funil Fit90 (base separada)
│   ├── .temp/                        ignorado
│   ├── functions/push-lead-to-crm/   edge function
│   └── migrations/0001_fit90_leads.sql
│
├── tools/                            ignorado — cache local do Supabase CLI (~170 MB)
│
├── correr-este-script-no-pc-para-atualizar-os-dados-do-ovg/
│   └── instalar-sync.cmd, LEIA-ME.txt     ⭐ usar NO PC DO GINÁSIO
│
├── docs/
│   ├── cliente/                      5 manuais para o ginásio (português de Angola)
│   ├── tecnica/                      13 documentos: arquitetura, deploy, BD, runbook, segurança
│   ├── architecture.md               ⭐ NOVO — referência técnica
│   ├── workflows.md                  ⭐ NOVO — fluxos passo-a-passo
│   ├── database.md                   ⭐ NOVO — ERD, drift, operações
│   └── repository-structure.md       ⭐ NOVO — este ficheiro
│
├── iniciar-crm.cmd                   ⭐ API local + Cloudflare tunnel
├── iniciar-tunnel.cmd                ⭐ mesmo, com tunnel
├── sincronizar-ovg.cmd               ⭐ sync OVG (PC do ginásio, 4x/dia)
│
├── Dockerfile                        multi-stage: build web -> runtime standalone
├── render.yaml                       deploy Render (sync: false nos segredos)
├── pnpm-workspace.yaml               politica de supply-chain (ver §5)
├── tsconfig.base.json, tsconfig.json
├── package.json, pnpm-lock.yaml, .npmrc
├── .env.example                      chaves sem valores
├── .gitignore, .dockerignore
├── README.md                         entrada principal (UTF-8, sem BOM)
├── CHANGELOG.md, ENTREGA-SAMORAFIT.md
```

---

## 3. Ficheiros por directório (rastreados)

| Directório | Ficheiros |
|---|---|
| `packages` | 154 |
| `apps` | 115 |
| `docs` | 18 |
| `supabase` | 4 |
| `standalone-server` | 4 |
| `correr-este-script-...` | 2 |
| `scripts` | 2 |
| raiz | 17 |
| **Total** | **316** |

---

## 4. Inventário de comandos

### Raiz

| Comando | O que faz |
|---|---|
| `pnpm run typecheck:libs` | `tsc --build` nos project references |
| `pnpm run typecheck` | libs + `apps/**` + `packages/**` + `scripts` |
| `pnpm run build` | ⚠️ `typecheck` **e depois** build de todos ⚠️ passa (verificado nesta auditoria) |
| `pnpm install` | instala tudo |

### Por pacote

| Comando | Efeito |
|---|---|
| `pnpm --filter @workspace/solve-crm dev` | Vite em `0.0.0.0` (`apps/web`) |
| `pnpm --filter @workspace/solve-crm build` | build Vite — **exige `PORT` e `BASE_PATH`** |
| `pnpm --filter @workspace/solve-crm typecheck` | `tsc --noEmit` — **0 erros** |
| `pnpm --filter @workspace/api-server build` | bundle -> `apps/api/dist/index.mjs` |
| `pnpm --filter @workspace/api-server start` | arranca `:3000` |
| `pnpm --filter @workspace/api-server test` | `vitest run` — **99/101 passam** |
| `pnpm --filter @workspace/db push` | `drizzle-kit push` |
| `pnpm --filter @workspace/api-spec codegen` | ⭐ regenera `api-zod` + `api-client-react` |
| `pnpm --filter @workspace/scripts push-schema` | SQL bruto da migration `0000` |

### Atalhos Windows

| Ficheiro | O que faz |
|---|---|
| `iniciar-crm.cmd` | compila `apps/api`, arranca, abre Cloudflare tunnel (precisa `cloudflared` no PATH) |
| `iniciar-tunnel.cmd` | idem, com tunnel |
| `sincronizar-ovg.cmd` | `packages/db/ovg-reseed.cjs` — **no PC do ginásio** |
| `correr-este-script-.../instalar-sync.cmd` | instala sync OVG no PC do ginásio |
| `apps/web/dev.ps1` | dev do frontend (corrigido: removido `cd` para outra máquina) |

### Deploy

```sh
git push main       # Render constrói o Docker, 5-10 min
```

Segredos vivem no dashboard do Render (`render.yaml` usa `sync: false`). Documentação: `docs/tecnica/06-DEPLOY-OPERACAO.md`.

---

## 5. Invariantes — NÃO quebrar

Estas regras estão em comentários do código. Violá-las causa incidentes.

### 5.1 Supply chain (`pnpm-workspace.yaml`)

| Regra | Efeito |
|---|---|
| `minimumReleaseAge: 10080` | nenhuma versão com menos de **7 dias** é instalável |
| `trustPolicy: no-downgrade` | recusa pacotes com provenance mais fraca que a de uma versão anterior |
| `blockExoticSubdeps: true` | impede dependências transitivas de git/URL/caminho |
| `onlyBuiltDependencies` | allowlist: `@swc/core`, `esbuild`, `msw`, `unrs-resolver` |
| `allowBuilds` | `core-js`, `esbuild` |
| `overrides` | ~50 entradas: `-` para binários de outras plataformas (só Windows/Linux x64, os necessários), `esbuild: 0.27.3`, `qs: 6.16.0` (CVE-2026-82562/82417) |
| `.npmrc: min-release-age=7` | mesma política para npm |

⚠️ O `.npmrc` tem `package-manager-strict=false` e `strict-peer-dependencies=false` — decisão deliberada de ambiente, não um acidente.

### 5.2 Comandos operacionais dependem de ficheiros "parecidos com lixo"

| Ficheiro | Consumido por | Se remover |
|---|---|---|
| `packages/db/ovg-reseed.cjs` | `sincronizar-ovg.cmd` | sync OVG diário **pára** |
| `packages/db/*.cjs` (20 scripts) | docs de operação, `docs/tecnica/07-BASE-DADOS.md` | correcções de dados param de ser aplicáveis |
| `packages/db/push-schema.cjs` / `.mjs` | execução manual | perdem-se correcções de dados pointed |
| `standalone-server/package-lock.json` | `Dockerfile` (`npm ci`) | **deploy falha** |
| `apps/api/dist/` (gerado) | `iniciar-crm.cmd` | rebuild local necessário |

⚠️ **`sincronizar-ovg.cmd` tem de ser executado no PC do ginásio** — a OVG só autoriza o IP dessa máquina. Executar na cloud falha.

### 5.3 Regras de dados (`docs/tecnica/07-BASE-DADOS.md:39`)

1. Não alterar colunas `_del` (arquivo por registo).
2. Não mexer em `sync_state`.
3. Linhas apagadas são intencionais.
4. Cota Neon: 5.99 GB/mês — **os intervalos longos de polling são deliberados** (`CHANGELOG.md:54-60`).

### 5.4 Pacotes gerados

`packages/api-zod/src/generated/**` e `packages/api-client-react/src/generated/**` são **gerados** por orval a partir de `packages/api-spec/openapi.yaml`. Alterar o contrato = editar o YAML e correr `codegen`. **Nunca editar à mão.**

---

## 6. O que **não** está no Git (e é esperado)

| Caminho | Motivo |
|---|---|
| `node_modules/` | dependências (`.gitignore`) |
| `dist/`, `out-tsc/`, `*.tsbuildinfo` | build (`.gitignore`) |
| `apps/web/dist/` | build do Vite |
| `packages/*/dist/` | `tsc --build` |
| `.env*` (exceto `.env.example`) | `.gitignore:44-45` — **NUNCA commitar** |
| `supabase/.temp/`, `tools/` | CLI local (`.gitignore:50-51`) |
| `.claude/`, `.impeccable/` | configuração local do utilizador (untracked) |
| `lib/`, `artifacts/`, `apps/mockup-sandbox/` | **removidos nesta auditoria** (resíduo da reorg `CHANGELOG.md:63`) |

⚠️ `.dockerignore` exclui `docs/` — a imagem de produção **não** leva documentação.

---

## 7. Convenções

| Item | Convenção |
|---|---|
| Commits | `security: …`, `cleanup: …`, `feat: …` (ver `CHANGELOG.md`) |
| Ramas | Só `main` em produção |
| Idiomas | Código e comentários técnicos em PT/EN conforme o ficheiro; docs `cliente/` em **português de Angola** |
| Formatação | `prettier` declarado na raiz; não há script de lint |
| Tipos | TypeScript estrito nos `apps` e `packages`; `standalone-server` é JS puro |
| Estilos | Tailwind v4 via `@tailwindcss/vite`; sem CSS modules |
| Fontes de dados no browser | `fetch` directo em `App.tsx` (18×) + cliente gerado + `portal/api.ts` |
| Rotas | wouter (`apps/web`), express (`standalone-server` e `apps/api`) |

---

## 8. Hotspots — onde mexer com cuidado

| Ficheiro | Linhas | Porquê |
|---|---|---|
| `apps/web/src/App.tsx` | 2748 | um só ficheiro para 40+ páginas; 122 `any`; 18 `apiBase` repetidos |
| `standalone-server/index.js` | 3667 | toda a produção num ficheiro; DDL no arranque; SQL raw |
| `packages/db/src/schema/index.ts` | 288 | schema canónico; `drizzle-kit push` propaga directamente para a BD |
| `pnpm-workspace.yaml` | 182 | política de segurança; editá-lo afecta o supply-chain de todos |
| `apps/web/vite.config.ts` | ~45 | **falha o build** sem `PORT`/`BASE_PATH` |
| `standalone-server/public/pay-widget.js` | ~200 | código de terceiros; sem CSP; endurecido nesta auditoria |

---

## 9. Onde está o quê (índice rápido)

| Pergunta | Ficheiro |
|---|---|
| Como está o deploy? | `Dockerfile`, `render.yaml`, `docs/tecnica/06-DEPLOY-OPERACAO.md` |
| Quais as rotas de produção? | `standalone-server/index.js` |
| Quais as rotas locais? | `apps/api/src/routes/index.ts` |
| Quais as rotas do site? | `apps/web/src/App.tsx`, `apps/web/src/landing/` |
| Quais as tabelas? | `packages/db/src/schema/index.ts` |
| Que SQL corre no arranque? | `standalone-server/index.js:266-319` |
| Quais os clientes externos? | `apps/api/src/lib/{cademi,ekwanza,ovg,whatsapp}.ts` |
| O que há de inseguro? | `docs/tecnica/10-SEGURANCA.md`, `docs/architecture.md` §9 |
| Como recupero de um problema? | `docs/tecnica/RUNBOOK.md` |
| O que o cliente precisa saber? | `docs/cliente/` |

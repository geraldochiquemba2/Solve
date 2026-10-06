# Arquitectura

Documento de referência técnica. Descreve **a arquitectura que existe no código**, verificada por leitura directa em 2026-10-05.

> Documentação operacional para o cliente continua em `docs/cliente/`.
> Runbook e operação: `docs/tecnica/RUNBOOK.md`. Detalhe de BD: `docs/database.md`.

---

## 1. Visão geral

O projecto é um monorepo **pnpm** com **duas aplicações deployáveis** (frontend + backend) e **três APIs distintas** no mesmo domínio de negócio.

```text
                        NAVEGADOR
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
  Landing / Portal / CRM                  standalone-server
  (apps/web, React+Vite)                   (Express + pg, produção)
        │                                       │
        └──────────────┬────────────────────────┘
                       │  HTTPS /api/v1/*
              ┌────────┴─────────┐
              │                  │
      standalone-server      apps/api
      (PRODUÇÃO)             (local: PC da catraca)
      Express + SQL raw      Express + Drizzle + TS
              │                  │
              └────────┬─────────┘
                       │
              Neon Postgres (+ CRM DB)
                       │
        ┌──────────────┼──────────────┐
   OVG (ginásio)   É-kwanza       Cademi
   VirtualGym      (GPO/GPR)     (cursos)
```

### O facto mais importante desta arquitectura

**O que corre em produção é `standalone-server/index.js`, não `apps/api`.**

Prova directa (`Dockerfile:1-16`, `render.yaml:1-6`):

| Estágio | Acção |
|---|---|
| `frontend` | `pnpm --filter @workspace/solve-crm run build` → `apps/web` |
| runtime | `COPY standalone-server/ ./` → `npm ci --omit=dev` → `CMD ["node", "index.js"]` |

`apps/api` **não é referido** pelo `Dockerfile`, `render.yaml` ou `.dockerignore`. É executado localmente pelos scripts `.cmd` (ver §5).

Consequência prática: **o esquema autoritativo de produção é o SQL raw de `standalone-server/index.js`**, não o schema Drizzle. Ver `docs/database.md` §5 para o drift entre os dois.

---

## 2. Componentes

| Componente | Caminho | Responsabilidade | Runtime | Build |
|---|---|---|---|---|
| **Frontend** | `apps/web` | Landing pública, portal do cliente, backoffice CRM | Sim | Sim (`dist/public`) |
| **API de produção** | `standalone-server/index.js` | Monólito: auth, pagamentos, Cademi, OVG, leads, clientes, planos, dashboard, jobs, SSE, webhooks | Sim (Render) | Não (cópia directa) |
| **API local/catraca** | `apps/api` | Mesma área em Express + TypeScript + Drizzle, com testes | Sim (local) | Sim (`dist/index.mjs`) |
| **Contrato OpenAPI** | `packages/api-spec` | Fonte do `openapi.yaml` + geração de código | Não | Não |
| **Cliente gerado** | `packages/api-client-react` | Cliente React Query tipado a partir do OpenAPI | Não (library) | Sim (`tsc --build`) |
| **Schemas gerados** | `packages/api-zod` | Schemas Zod a partir do OpenAPI | Não (library) | Sim (`tsc --build`) |
| **Schema de BD** | `packages/db` | Schema Drizzle + migrations + scripts de seeds/manutenção | Não (library) | Não |
| **Tarefas de operação** | `scripts` | `push-schema` | Não | Não |
| **Edge function** | `supabase/functions` | `push-lead-to-crm` (varrimento Fit90) | Sim (Supabase) | Não |
| **Widget de pagamento** | `standalone-server/public/pay-widget.js` | Checkout embebido em código de terceiros (Cademi) | Sim | Não |

---

## 3. Comunicação entre componentes

### 3.1 Frontend → API

Não existe uma camada de API única. Existem **quatro** implementações de cabeçalhos de autenticação:

| Local | Chave de sessão | Ficheiro |
|---|---|---|
| Cliente gerado | `token` (Bearer) | `apps/web/src/lib/api.ts:1-9` |
| Hooks do CRM | `token` (Bearer) ou `X-API-Key` | `apps/web/src/hooks/use-api.ts:8-26` |
| Portal do cliente | `portal_token` (Bearer) | `apps/web/src/portal/api.ts:55-73` |
| Páginas do CRM | `token` (Bearer) ou `X-API-Key` | `apps/web/src/App.tsx:136-159` |

Para além disso, `App.tsx` repete `const apiBase = import.meta.env.VITE_API_URL || ''` **18 vezes**, uma por página, com `fetch()` directo.

**Consequência:** trocar a base da API ou o esquema de autenticação exige alterações em vários sítios. Isto é dívida estrutural **documentada, não corrigida** (ver §8).

### 3.2 Frontend → base de dados

O frontend **nunca** acede directamente à base de dados. Todas as operações passam pelo backend. Confirmado: zero referências a `pg`, `drizzle` ou `DATABASE_URL` em `apps/web/src`.

### 3.3 API → serviços externos

| Serviço | Protocolo | Onde | Usado para |
|---|---|---|---|
| **OVG / VirtualGym** | HTTPS + API key | `standalone-server/index.js` (rotas `/api/v1/ovg/*`, `/api/v1/access/ovg-*`), `apps/api/src/lib/ovg.ts`, `ovg-sync.ts` | Sincronizar membros do ginásio, mapear planos, registar entradas |
| **É-kwanza** | HTTPS OAuth2 client-credentials | `standalone-server/index.js` (webhook, autosync), `apps/api/src/lib/ekwanza.ts`, `ekwanza-callback.ts` | Cobranças GPO, referências, reconciliação |
| **WiPay** | HTTPS OAuth2 | `standalone-server/index.js` (fluxo `mcx_express`) | Checkout hospedado |
| **Cademi** | HTTPS + API key | `standalone-server/index.js` (`/api/v1/cademi/*`), `apps/api/src/lib/cademi.ts` | Matrículas, entregas, progresso de aulas |
| **Supabase** | HTTPS service key | `supabase/functions/push-lead-to-crm`, `standalone-server` (job Fit90) | Leads de landings externas |
| **WhatsApp Cloud API** | HTTPS | `apps/api/src/lib/whatsapp.ts`, portal OTP | Envio de OTP |
| **Pay4All** | — | `apps/web/src/landing/services/pay4all.ts` | **MOCK** — código real comentado (`TODO` em `:16`) |
| **Render** | — | `render.yaml` | Deploy; pings de keep-alive |
| **Cloudflare Tunnel** | — | `iniciar-crm.cmd`, `iniciar-tunnel.cmd` | Expor o PC da catraca |

### 3.4 Comunicação server-to-server

- `standalone-server` **proxy** para `SOLVE_ACCESS_URL` (`/api/v1/access/*`): o PC da catraca empurra eventos de acesso para a cloud.
- `supabase/functions/push-lead-to-crm` chama `CRM_API_URL` com `CRM_API_KEY`.
- O job Fit90 no `standalone-server` faz `PATCH` a `fit90_leads` no Supabase.

---

## 4. Autenticação e autorização

Duas sessões **independentes** no mesmo browser:

| Sessão | Chave | Emitida por | Protecção |
|---|---|---|---|
| Staff (CRM) | `token` (localStorage) | `POST /api/v1/auth/login` | `ProtectedRoute` → `App.tsx:2520-2528` |
| Cliente (portal) | `portal_token` (localStorage) | `POST /api/v1/portal/otp/verify` (OTP WhatsApp) | `ProtectedPortal` → `App.tsx:2530-2545` |

A landing usa uma terceira chave, `samora_user` (`apps/web/src/landing/context/AuthContext.tsx:30-31`), para estado de UI.

**Fail-closed no servidor** (`standalone-server/index.js:63-69`): em `NODE_ENV=production`, `API_KEY` e `JWT_SECRET` são obrigatórios e o processo **termina** se faltarem.

**RBAC:** `requireRole` no `standalone-server`, `authorize()` no `apps/api`. Papéis: `admin`, `gestor`, `comercial`, `financeiro`, `operacional`.

---

## 5. Ambientes e como correr

| Cenário | Comando | Notas |
|---|---|---|
| Deploy Render | `git push main` | `render.yaml` → Docker → `standalone-server` |
| Frontend local | `cd apps/web && .\dev.ps1` | Define `PORT`, `BASE_PATH`, `VITE_API_URL` |
| API local (catraca) | `iniciar-crm.cmd` ou `iniciar-tunnel.cmd` | Compila `apps/api`, arranca `:3000`, abre túnel |
| Sync OVG (PC do ginásio) | `sincronizar-ovg.cmd` | Corre `packages/db/ovg-reseed.cjs`; agendado 4×/dia |

### Variáveis de ambiente obrigatórias para build

`vite.config.ts` **falha o build** se faltarem `PORT` e `BASE_PATH` (`vite.config.ts:8-28`). O `Dockerfile` define ambos (`:11-13`); o `.env.example` documenta-os. **Não existe `.env` no repositório** — um `pnpm build` local sem estas variáveis falha. Detalhe em `docs/repository-structure.md` §6.

---

## 6. Decisões arquitecturais observadas

Estas decisões **existem no código** e são load-bearing:

1. **Duas implementações paralelas do mesmo backend.** `standalone-server/index.js` (3667 linhas, ~95 rotas, SQL raw) e `apps/api` (22 módulos de rotas, Drizzle, 101 testes) cobrem o mesmo domínio. O deploy usa a primeira; os `.cmd` operacionais usam a segunda. *Porquê:* não documentado no código. *Impacto:* qualquer correcção de segurança precisa de ser aplicada nos dois. Ver `docs/tecnica/10-SEGURANCA.md` — rondas anteriores fizeram exactamente isso ("parte 1: apps/api · parte 2: standalone").

2. **O schema Drizzle não é a fonte de verdade em produção.** O `standalone-server` executa DDL no arranque (`index.js:266-319`) para criar tabelas que **não existem** em nenhuma migration (`ovg_members`, `sync_log`). Migrar dados exige acesso ao `DATABASE_URL` real.

3. **Defesas de supply-chain no pnpm.** `pnpm-workspace.yaml`: `minimumReleaseAge: 10080` (7 dias), `trustPolicy: no-downgrade`, `blockExoticSubdeps: true`, allowlist de `onlyBuiltDependencies`, e ~50 `overrides` que eliminam binários de outras plataformas e fixam `esbuild`, `qs`.

4. **Cota do Neon como restrição de desenho.** O CHANGELOG documenta um corte de consumo (intervalos de polling aumentados) por exceder a transferência mensal. **Não remover** os intervalos longos em `use-api.ts` — reintroduzir polling agressivo satura a cota.

5. **`packages/api-*` são 100% gerados.** `api-spec/openapi.yaml` → orval → `api-client-react` + `api-zod`. Para alterar os tipos, regenerar (`pnpm --filter @workspace/api-spec codegen`), **nunca editar à mão** os ficheiros em `src/generated/`.

6. **Scripts de manutenção one-off são parte do arsenal operacional.** `packages/db/*.cjs` (20 scripts) aplicam correcções de dados e são referenciados na documentação operacional. **Não remover sem confirmação** — ver `docs/repository-structure.md` §5.

---

## 7. Mapa de dependências entre módulos

```text
apps/web  ──► @workspace/api-client-react ──► (types) @workspace/api-zod
   │                    │
   │                    └──► definido por @workspace/api-spec/openapi.yaml
   └──► jspdf, jspdf-autotable, wouter, react-query, lucide-react
          (XLSX: escritor próprio em `src/lib/xlsx.ts`, sem dependência externa)

apps/api  ──► @workspace/db ──► drizzle-orm ──► @neondatabase/serverless
   │              │
   │              └──► schema/index.ts (21 tabelas) + drizzle/*.sql
   ├──► @workspace/api-zod (validação)
   └──► express, jsonwebtoken, cookie-parser, bcryptjs, pino, ws, zod

standalone-server ──► express, pg, jsonwebtoken, bcryptjs, cors
   └──► SQL raw (SEM drizzle, SEM packages/*)

supabase/functions/push-lead-to-crm ──► fetch → CRM_API_URL

@workspace/api-spec ──► orval ──► api-client-react + api-zod   (GERAÇÃO)
@workspace/api-client-react, api-zod ──► @tanstack/react-query, zod
```

### Dependências circulares

Nenhuma detectada. `packages/*` não importam `apps/*`.

### Módulos centrais

- `packages/db` — consumido por 11 ficheiros de `apps/api` (rotas, `automation-engine`, `ekwanza-callback`, `ovg-sync`, `cademi`).
- `standalone-server/index.js` — **o** módulo central de produção; 3667 linhas, sem decomposição.

### Módulos aparentemente mortos

| Módulo | Estado | Decisão |
|---|---|---|
| `apps/api/src/routes/whatsapp.ts`, `lib/whatsapp.ts` | Parcialmente consumidos: o portal OTP usa `whatsapp.ts`; a rota `/whatsapp` usa a lib. `docs/tecnica/08-WHATSAPP.md` descreve o envio como "parcial, não vai a produção". | **Mantido** — não confirmado como morto |
| `packages/api-zod/src/generated/types/*` (~120 ficheiros) | Gerados; só `HealthCheckResponse` é importado em runtime (`apps/api/src/routes/health.ts:2`). | **Mantido** — artefacto de geração; regenerável |
| `react-router-dom` (`apps/web/package.json:81`) | Declarada, **nunca importada** (o router é `wouter`). | **Mantido** — ver §8 |
| ~35 `devDependencies` do `apps/web` | Declaradas, nunca importadas (23 primitivas `@radix-ui/react-*`, `cmdk`, `date-fns`, `recharts`, `vaul`, `sonner`, `next-themes`, `lenis`, `react-icons`, `react-day-picker`, `react-resizable-panels`, `embla-carousel-react`, `input-otp`, `tw-animate-css`, `@tailwindcss/typography`, 2 plugins `@replit/vite-plugin-*`) | **Mantido** — ver §8 |

---

## 8. Dívida técnica conhecida (não corrigida)

Registrada para não ser redescoberta. **Nenhuma destas correcções foi feita nesta auditoria**, porque todas alteram comportamento ou exigem decisão de produto.

| # | Dívida | Impacto | Porquê não corrigida |
|---|---|---|---|
| D1 | ~35 dependências declaradas e nunca importadas em `apps/web` | ~peso de `node_modules`, superfície de supply-chain | `components.json` declara um design-system shadcn completo; remover libs altera o que um `pnpm add` futuro traria. Decisão de produto. |
| D2 | 24 imports não usados e 16 ícones `lucide` não renderizados em `App.tsx` | Ruído | `App.tsx` tem 2748 linhas e 122 `any`; uma poda parcial não melhora a legibilidade. Risco de introduzir erro. |
| D3 | 4 implementações duplicadas de cabeçalhos de auth; 18 `apiBase` repetidos | Manutenção | Reorganizar exigiria tocar em dezenas de call-sites num único ficheiro de 2748 linhas. Alteraria comportamento. |
| D4 | ~~17 erros TypeScript pré-existentes, todos em `App.tsx`~~ — **resolvido** | `pnpm run typecheck` e `pnpm run build` na raiz passam | Corrigido nesta auditoria. Causa raiz: orval 8.23.0 emite `query?: UseQueryOptions<…>`, que em react-query v5 ainda exige `queryKey` (4× `TS2741`); `useListAutomations`/`useListUsersAll` não acceptavam argumentos (2× `TS2554`); `useAccessStats`/`useAccessLogs` devolviam `any` (9× `TS7006`); anotações erradas no escritor XLSX (9×). Detalhe em §9. |
| D5 | ~~`apps/web/src/hooks/use-auth.ts:47` — `role: (parsed.role === 'admin' ? 'admin' : 'admin')`~~ — **resolvido** | Qualquer `samora_user` no localStorage era lido como `admin` | Era resíduo da remoção da credencial `DEFAULT_ADMIN_IDENTITY` no commit `3550812`. `normalizarRole()` valida contra o enum `UserRole` e mapeia `'admin'` (formato da landing) → `'administrador'`; desconhecido cai no papel mais restrito. Detalhe em §9. |
| D6 | Nomenclatura de leads em 3 dialetos: Zod `ultimoContactoAt`, coluna `ultimo_contato_at`, UI/OpenAPI `ultimoContactoAt` | Bugs de mapeamento | Mudar exigiria renomear coluna + regenerar OpenAPI + alterar UI. Contrato de API. |
| D7 | `AccessStreamEvent`, `reducer`, `randomInt`, `nomeRelatorio`, `API_BASE_URL` exportados sem consumidor | Ruído | Exports fazem parte de API pública dos pacotes; remover é API break. |
| D8 | 7 rotas `/admin/*` registadas sem link na navegação | Descoberta | Podem ser acedidas por URL directo de propósito. **Não confirmado** que sejam acidentais. |
| D9 | `CartContext.addToCart` nunca é chamada | O carrinho é inalcançável por UI | Pode ser functionality planeada para o `FitStudio`. **Não confirmado** como bug. |
| D10 | `landing/services/pay4all.ts` é mock; código real comentado | Pay4All não funciona | `TODO:16` indica integração pendente do cliente. |
| D11 | `landing/sections/CTAFinal.tsx:74` — `wa.me/244000000000` | Número de WhatsApp placeholder em produção | Requer o número real do cliente. |

---

## 9. Segurança — resumo

Detalhe em `docs/tecnica/10-SEGURANCA.md` (17 vulnerabilidades, rondas anteriores).

**Estado actual (verificado nesta auditoria):**

| Verificação | Resultado |
|---|---|
| Segredos literais em ficheiros rastreados | **0** |
| Chaves privadas / certificados | **0** |
| `.env` versionado | **0** (só `.env.example` com placeholders) |
| `.env` real em disco | **0** |
| `API_KEY` no bundle do browser | `""` (vazio) |
| Auth fail-closed em produção | **Sim** (`index.js:63-66` → `process.exit(1)`) |
| OTP exposto em produção | **Não** (`portal-otp.ts:84-87`; teste em `portal.test.ts:105`) |
| Endpoint `/api/v1/debug/egress-ip` | Protegido por `requireAuth` (`index.js:244`) |
| Endpoints `/api/v1/db-*` | Removidos → `410 Gone` (`index.js:262-263`) |
| Redact de headers nos logs | `apps/api/src/lib/logger.ts:7-11` |

**Corigido nesta auditoria:**

| Severidade | Item | Resolução |
|---|---|---|
| **Alta** | `CVE-2023-30533` (prototype pollution) + `CVE-2024-22363` (ReDoS) — `xlsx@0.18.5` instalado; `0.20.2` não existe no registry npm; ambos com `patched_versions` vazio | Dependência removida. `apps/web/src/lib/xlsx.ts` é um escritor XLSX próprio, sem dependências (ZIP "store" + SpreadsheetML), a última versão npm do `xlsx` só existe via CDN e usá-la exigiria desactivar `blockExoticSubdeps`. Validado de forma independente (CRC32, partes obrigatórias, XML, escaping, round-trip de valores). `pnpm audit` sem advisories para `xlsx`. Bundle principal do web: 1 579 kB → **1 299 kB**. |
| **Média** | `return_url` HTTP(S) arbitrário aceite num endpoint público e encaminhado para o WiPay | `sanitizarReturnUrl()` com allowlist exacta de origens (`RETURN_URL_ALLOWED_ORIGINS` + `FRONTEND_URL`, `CORS_ORIGIN`, `APP_URL`, `RENDER_EXTERNAL_URL`), só HTTP(S), limite de 300 chars. Fail-closed: sem allowlist ou origem desconhecida, o campo é ignorado e o pagamento continua sem `success_url`/`failure_url`. 20 casos de teste, incluindo sufixo enganador, userinfo, downgrade de esquema e porta diferente. A origem da página Cademi tem de ser declarada explicitamente. |
| **Média** | D5 acima (`? 'admin' : 'admin'`) | `normalizarRole()` valida o papel contra o enum do contrato e aplica o princípio do menor privilégio. Efeito colateral corrigido: `App.tsx` decide `canAddStaff` por `meRole === 'administrador'`, condição que o bug deixava sempre falsa. |
| **Baixa** | Email registado em logs | Removido de 3 pontos: reset de password, divergência de email em pagamentos, entrega Cademi. |

**Pendentes:**

| Severidade | Item | Local |
|---|---|---|
| **Informativo** | 10 vulnerabilidades HIGH adicionais no `pnpm audit` (`fast-uri`, `brace-expansion`, `esbuild`, …), transitivas e sem versão corrigida | — |
| **Informativo** | `peakHours` e `accessByDay` devolvidos como `[]` pelo endpoint `/api/v1/access/stats`, pelo que o gráfico "Atividade por hora" nunca mostra dados | `standalone-server/index.js:611-612` |
| **Informativo** | 2 testes da API falham por causas pré-existentes: rate-limit partilhado em `auth.test.ts`, mock incompleto em `payments.test.ts` | `apps/api/src/__tests__/` |

---

## 10. Referências

| Documento | Conteúdo |
|---|---|
| `docs/workflows.md` | Fluxos reais passo-a-passo |
| `docs/database.md` | Tabelas, ERD, migrations, drift |
| `docs/repository-structure.md` | Estrutura de pastas, comandos, invariantes |
| `docs/cliente/` | Documentação comercial (português de Angola) |
| `docs/tecnica/10-SEGURANCA.md` | Auditoria de segurança detalhada (VULN-01..17) |
| `docs/tecnica/RUNBOOK.md` | Runbook operacional |
| `CHANGELOG.md` | Histórico de rondas de segurança e limpeza |

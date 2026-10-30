# Arquitetura do Repositório — Módulo 0

**Data:** 2026-10-30  
**Repositório:** `Solve/`  
**Objetivo:** descrever o que existe e como está ligado, sem propor alterações de código.

## 1. Visão geral

O Solve é um monorepo pnpm com dois produtos executáveis:

1. **Frontend SPA** (`apps/web`) — React 19 + Vite, com área administrativa em `/admin`, portal de cliente em `/conta` e landing/login em `/`.
2. **Backend** — existem duas implementações:
   - `apps/api` — TypeScript, Express, Drizzle, testes Vitest; usada no desenvolvimento local.
   - `standalone-server` — JavaScript monolítico, Express + `pg`; é a implementação efetivamente usada pelo Docker/Render em produção.

Além disso, o workspace contém pacotes partilhados (`packages/db`, `packages/api-spec`, `packages/api-zod`, `packages/api-client-react`), scripts de operação, configuração Supabase, documentação e testes standalone.

> **Regra prática:** `apps/api` é a referência de comportamento documentada, mas o código que corre em produção é `standalone-server/index.js`. Qualquer correção funcional tem de ser aplicada e validada nas duas implementações, ou a divergência aumenta.

## 2. Árvore do repositório

```text
Solve/
├─ apps/
│  ├─ api/                  API TypeScript (Express + Drizzle)
│  │  ├─ src/
│  │  │  ├─ index.ts        entrypoint: lê PORT, arranca app.listen
│  │  │  ├─ app.ts          Express, middlewares, /healthz, /api/v1, SSE, webhooks
│  │  │  ├─ routes/         23 ficheiros de rotas (inclui index)
│  │  │  ├─ middlewares/    auth, portal-auth, rate-limit, validação, erros
│  │  │  ├─ lib/            Cademi, É-kwanza, WhatsApp, portal OTP, automação, etc.
│  │  │  └─ __tests__/      9 suites Vitest + setup
│  │  ├─ build.mjs          bundle esbuild para dist/index.mjs
│  │  └─ vitest.config.ts
│  └─ web/                  SPA React/Vite
│     ├─ src/
│     │  ├─ App.tsx         rotas e composição principal
│     │  ├─ components/     UI, admin, CRM, landing
│     │  ├─ portal/         área /conta
│     │  ├─ landing/        landing/login
│     │  ├─ hooks/          hooks de dados
│     │  └─ lib/            utilitários
│     ├─ dev.ps1            dev local em :5173
│     └─ vite.config.ts
├─ packages/
│  ├─ db/                   Drizzle ORM, schema e migrations 0000–0008
│  ├─ api-spec/             especificação OpenAPI
│  ├─ api-zod/               schemas Zod gerados
│  └─ api-client-react/      cliente React Query gerado
├─ standalone-server/       backend de produção
│  ├─ index.js              servidor completo + bootstrap DDL (4372 linhas)
│  ├─ portal.js             portal de cliente
│  ├─ whatsapp.js           Cloud API / webhook / envio
│  ├─ automation.js         motor de automações e outbox
│  ├─ studio-integration.js integração SamoraFit Studio
│  ├─ public/               widget de pagamento e assets servidos
│  └─ tests/                testes Node + harnesses
├─ scripts/                 importação, backup, bootstrap e schema
├─ supabase/                configuração e edge functions
├─ docs/                    documentação técnica e de cliente
├─ Dockerfile               build do frontend + runtime standalone
├─ render.yaml              serviço web Docker no Render
├─ iniciar-crm.cmd          API local + túnel Cloudflare
├─ iniciar-tunnel.cmd       variante do túnel
└─ migrar-render-env.cmd    migração de variáveis entre serviços Render
```

## 3. Topologia de execução

### Desenvolvimento local

```text
Browser
  └─ Vite :5173 (apps/web)
       └─ VITE_API_URL=http://localhost:3000
            └─ apps/api/dist/index.mjs :3000
                 └─ Postgres configurado por DATABASE_URL / CRM_DATABASE_URL
```

- `apps/web/dev.ps1` define `PORT=5173`, `BASE_PATH=/` e `VITE_API_URL=http://localhost:3000`, e executa `pnpm dev` em `apps/web`.
- `pnpm --filter @workspace/api-server dev` executa primeiro `build.mjs` e depois `node ./dist/index.mjs`.
- `iniciar-crm.cmd` e `iniciar-tunnel.cmd` arrancam `apps/api/dist/index.mjs` na porta 3000 e abrem um túnel Cloudflare.
- O frontend pode ser servido separado da API; em produção usa URLs same-origin por omissão.

### Produção (Docker/Render)

```text
Internet
  └─ Render (Docker)
       └─ standalone-server/index.js :3000
            ├─ /api/v1/*              API
            ├─ /healthz               health check simples
            ├─ /webhooks/*            callbacks
            ├─ /admin, /conta, /      SPA estática em public/
            └─ Postgres
```

- O `Dockerfile` tem dois estágios:
  1. `frontend`: instala o workspace com `pnpm --frozen-lockfile`, compila `apps/web` e produz `apps/web/dist/public`.
  2. runtime: copia `standalone-server/`, executa `npm ci --omit=dev`, copia o build do frontend para `./public`, expõe `3000` e arranca `node index.js` como utilizador `node`.
- O `render.yaml` usa `runtime: docker`, `healthCheckPath: /healthz`, `autoDeploy: true` e define as variáveis de ambiente; os segredos usam `sync: false`.
- O `healthz` atual responde apenas com `{ status: "ok" }`; não verifica a base de dados.

### Serviços externos e integrações

- **Postgres** — base principal; `render.yaml` referencia o pooler Supabase e o workspace inclui o driver Neon serverless.
- **Supabase** — configuração e edge functions; existe uma função de push de leads para o CRM.
- **Cademi** — sincronização de cursos/entregas e webhooks.
- **É-kwanza / WiPay / Pay4All** — pagamentos; o fluxo Pay4All está assinalado como simulado na auditoria.
- **WhatsApp Cloud API (Meta)** — envio, webhook e automações.
- **SamoraFit Studio** — ingestão autenticada por API key e leitura no CRM.
- **Fit90/Supabase** — ingestão de leads e sincronização.
- **Cloudflare Tunnel** — apenas no fluxo local, para expor a API ao PC da catraca.

## 4. Entrypoints

| Entrypoint | Função |
|---|---|
| `apps/web/index.html` → `apps/web/src/main.tsx` → `App.tsx` | Arranque da SPA e definição de rotas |
| `apps/api/src/index.ts` | Lê `PORT`, importa `app.ts` e chama `app.listen` |
| `apps/api/src/app.ts` | Constrói a aplicação Express, middlewares, `/healthz`, `/api/v1`, SSE e webhooks |
| `apps/api/build.mjs` | Gera `apps/api/dist/index.mjs` com esbuild |
| `standalone-server/index.js` | Servidor de produção: pool, bootstrap DDL, rotas, jobs e estáticos |
| `standalone-server/public/pay-widget.js` | Widget público de pagamento/Cademi |
| `supabase/functions/push-lead-to-crm/index.ts` | Edge function de integração de leads |
| `scripts/*.mjs`, `scripts/*.ps1`, `*.cmd` | Operação, importação, backup, schema e migração de ambiente |
| `Dockerfile` | Empacotamento do frontend + backend de produção |
| `render.yaml` | Definição do serviço Render |

## 5. Frontend

### Rotas principais

- Público: `/`, `/login`, `/fit-studio`.
- Portal: `/conta`, `/conta/login`, `/conta/pagamentos`, `/conta/recibos/:id`.
- Administração: `/admin`, `/admin/leads/:etapa?`, `/admin/meu-progresso`, `/admin/fit90-leads`, `/admin/pipeline`, `/admin/clientes`, `/admin/clientes/:id`, `/admin/planos`, `/admin/promocodes`, `/admin/pagamentos`, `/admin/integracoes`, `/admin/academia`, `/admin/samorafit-studio`, `/admin/automacoes`, `/admin/api-webhooks`, `/admin/utilizadores`, `/admin/equipa`, `/admin/auditoria`, `/admin/definicoes`.
- Fallback: página “não encontrada” dentro do shell admin.

### Camadas

- `App.tsx` concentra o estado de autenticação e a composição das rotas.
- `components/` contém o shell, CRM, páginas administrativas e primitivas de UI.
- `portal/` contém a área de cliente e recibos.
- `landing/` contém a landing e o login.
- `hooks/` e `lib/` suportam dados e utilitários.
- O acesso a dados usa o cliente gerado em `packages/api-client-react` e React Query.

### Build

- Vite exige `PORT` e `BASE_PATH`.
- `VITE_API_URL` vazio significa URLs relativas/same-origin; é o modo usado no contentor.
- O build produz `apps/web/dist/public`, que é copiado para o runtime standalone.

## 6. Backend local (`apps/api`)

### Pipeline

1. `index.ts` carrega `dotenv/config`, valida `PORT` e arranca o Express.
2. `app.ts` aplica:
   - `trust proxy` em produção;
   - headers de segurança;
   - logs Pino;
   - CORS com origens explícitas;
   - `express.json`/`urlencoded` com limite de 100 kb;
   - cookie parser;
   - rate limiting global, de autenticação e de webhooks;
   - `/healthz`;
   - `/api/v1` com o router principal;
   - SSE autenticado em `/api/v1/payments/stream`;
   - webhook É-kwanza fora de `/api/v1`.
3. O router agrega 22 módulos de rotas (auth, clientes, leads, pagamentos, planos, portal, promoções, WhatsApp, automações, integrações, auditoria, utilizadores, etc.).
4. `build.mjs` gera um bundle ESM com esbuild e plugins para Pino.

### Autenticação e segurança

- Staff: JWT/API key através de `middlewares/auth.ts`.
- Portal: OTP e cookie de portal através de `middlewares/portal-auth.ts`.
- Rate limits específicos para login, portal e webhooks.
- SSE usa cookie `httpOnly` com `withCredentials`; a chave não é colocada no URL.
- CORS usa `CORS_ORIGIN`/`APP_URL`, com fallback local.
- `app.ts` mantém um redirect de compatibilidade de `/api/*` para `/api/v1/*`, exceto o próprio `/api/v1`.

## 7. Backend de produção (`standalone-server`)

### Responsabilidades

- Criar o `Pool` Postgres e remover variáveis `PG*` injetadas pelo Render para evitar ligação a um host errado.
- Ler `CRM_DATABASE_URL` primeiro e `DATABASE_URL` como fallback.
- Recusar arranque em produção sem `API_KEY` e `JWT_SECRET`.
- Aplicar bootstrap idempotente de colunas, índices e tabelas em falta (`ALTER TABLE`, `CREATE TABLE IF NOT EXISTS`), porque o schema de produção não é gerido apenas pelas migrations Drizzle.
- Registar rotas de CRM, portal, WhatsApp, automações, Studio e pagamentos.
- Servir a SPA compilada em `public/`.
- Executar jobs periódicos (expiração de pagamentos, autosync Cademi, retry, Fit90, self-ping).
- Expor `/healthz` e um endpoint temporário de diagnóstico de IP de saída.

### Módulos

- `index.js` — servidor, auth, RBAC, pagamentos, Cademi, webhooks, bootstrap e jobs.
- `portal.js` — rotas do portal de cliente.
- `whatsapp.js` — validação HMAC, envio e tratamento de webhook.
- `automation.js` — canonicalização de eventos, outbox, idempotência e dry-run.
- `studio-integration.js` — ingestão/leitura SamoraFit Studio com API key.

### Testes

`standalone-server/tests` usa `node --test`:

- `modules.test.mjs` testa WhatsApp, automação e portal.
- `studio.test.mjs` testa a integração Studio.
- `security.test.mjs` lança harnesses separados que extraem e executam lógica do `index.js`.
- Os testes não arrancam o servidor real com Express + Postgres; são testes de lógica/harness.
- Resultado atual: 25/25.

## 8. Dados e schema

- ORM local: Drizzle (`packages/db/src/index.ts`, schema em `packages/db/src/schema/index.ts`).
- Migrations: `packages/db/drizzle/0000_empty_hydra.sql` a `0008_studio.sql`.
- `0007_drop_gym.sql` é destrutiva e contém `CASCADE`; não deve ser executada sem decisão explícita.
- O standalone faz DDL em runtime para colunas/tabelas que não estão nas migrations, incluindo `cademi_id`, `lead_contacts`, `notifications`, campos de leads, pagamentos e subscrições.
- Este DDL de runtime cria potencial **drift** entre migrations, schema Drizzle e base real.
- Entidades centrais: utilizadores, clientes, leads, planos, pagamentos, subscrições, promoções, OTPs do portal, notificações, automações, auditoria, API keys, integrações, webhooks e check-ins.
- Existe documentação de mapa de dados em `docs/database.md`; parte está desatualizada.

## 9. Integrações e fluxos

### Login e sessão

1. O browser autentica-se via API.
2. O backend emite JWT/cookie de sessão.
3. `auth`/`portal-auth` validam o pedido.
4. O frontend usa o cliente gerado para pedidos autenticados.

### Pagamentos

1. O checkout cria um pagamento e uma referência no provedor.
2. O provedor chama o webhook.
3. O backend atualiza o estado e, quando aplicável, publica no SSE.
4. O frontend recebe a atualização em tempo real.
5. O fluxo Pay4All atual é simulado e não deve ser usado como cobrança real.

### WhatsApp e automações

1. A Meta envia o webhook assinado.
2. `whatsapp.js` valida HMAC e idempotência.
3. Eventos são canonicalizados e colocados no outbox.
4. O motor de automação envia mensagens, respeita opt-out e regista o resultado.
5. `AUTOMATION_DRY_RUN` permite simular sem envio.

### Cademi e Studio

- Cademi sincroniza entregas/cursos e recebe callbacks; a autenticação do webhook é um risco apontado na auditoria.
- Studio usa uma API key dedicada e regista eventos de upsert/delete de clientes.

### Landing/Fit90

- A landing e o Fit90 enviam leads para a API/CRM.
- A edge function Supabase faz push de leads para o CRM.
- A idempotência de leads usa `external_id`.

## 10. Configuração e deploy

### Variáveis principais

- Base de dados: `DATABASE_URL`, `CRM_DATABASE_URL`, `DB_SSL_REJECT_UNAUTHORIZED`.
- Segurança: `JWT_SECRET`, `API_KEY`, `STUDIO_API_KEY`, `CORS_ORIGIN`, `APP_URL`.
- Pagamentos: `EKWANZA_*`, `WIPAY_*`, `VITE_PAY4ALL_*`.
- WhatsApp: `WHATSAPP_*`.
- Cademi: `CADEMI_*`.
- Supabase: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`/`SUPABASE_SERVICE_ROLE_KEY`.
- Jobs: `EXPIRY_INTERVAL_MS`, `AUTOSYNC_INTERVAL_MS`, `CADEMI_RETRY_INTERVAL_MS`, `FIT90_SYNC_INTERVAL_MS`, `SELF_PING_*`.
- Frontend: `PORT`, `BASE_PATH`, `VITE_API_URL`.

Não existem valores reais de segredos neste documento.

### Build e release

1. `pnpm install --frozen-lockfile` no estágio frontend.
2. `pnpm --filter @workspace/solve-crm run build`.
3. `npm ci --omit=dev` no runtime.
4. Copiar `apps/web/dist/public` para `standalone-server/public`.
5. Arrancar `node index.js` na porta 3000.
6. Render faz health check em `/healthz`.

Não há passo de migração no Dockerfile/render.yaml; o standalone aplica DDL de bootstrap no arranque.

## 11. Inconsistências e dívida técnica observadas

- Duas implementações do backend, com código e testes separados; risco elevado de divergência.
- `apps/api` não é incluída na imagem Docker; o deploy usa apenas `standalone-server`.
- `docs/repository-structure.md` está desatualizado (316 vs 346 ficheiros; árvores antigas).
- `docs/architecture.md` e parte de `docs/tecnica/*` mantêm referências históricas a OVG/catraca que já não correspondem ao runtime.
- Não existe script `lint` nem CI do projeto.
- Não existe script de teste na raiz; os testes são executados por workspace.
- O typecheck depende da ordem de build dos pacotes gerados (`api-client-react`).
- `packages/api-zod` tem 111 ficheiros gerados; contribui para o custo de importação dos testes.
- `packages/api-client-react` não tinha `node_modules` numa instalação parcial.
- `standalone-server` concentra 4372 linhas num único `index.js` e aplica DDL em runtime.
- `0007_drop_gym.sql` é destrutiva.
- `healthz` não verifica a base de dados.
- Existe `react-router-dom` declarado no frontend sem uso observado; a aplicação usa Wouter.
- Os documentos de auditoria e classificação estão fora do Git.
- A versão local de Node/pnpm difere da imagem Docker (`node:20`, `pnpm@latest`).

## 12. Ficheiros consultados

- `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.base.json`, `Dockerfile`, `render.yaml`, `.env.example`.
- `apps/api/package.json`, `apps/api/build.mjs`, `apps/api/vitest.config.ts`, `apps/api/src/index.ts`, `apps/api/src/app.ts`, `apps/api/src/routes/*`, `apps/api/src/__tests__/*`.
- `apps/web/package.json`, `apps/web/vite.config.ts`, `apps/web/src/App.tsx`, `apps/web/dev.ps1`.
- `packages/db/package.json`, `packages/db/src/index.ts`, `packages/db/src/schema/index.ts`, `packages/db/drizzle/0000–0008`.
- `packages/api-spec`, `packages/api-zod`, `packages/api-client-react`.
- `standalone-server/package.json`, `standalone-server/package-lock.json`, `standalone-server/index.js`, `standalone-server/portal.js`, `standalone-server/whatsapp.js`, `standalone-server/automation.js`, `standalone-server/studio-integration.js`, `standalone-server/public/*`, `standalone-server/tests/*`.
- `docs/architecture.md`, `docs/repository-structure.md`, `docs/database.md`, `docs/workflows.md`, `docs/tecnica/ARQUITETURA.md`, `docs/tecnica/00-VISAO-GERAL.md`, `docs/tecnica/06-DEPLOY-OPERACAO.md`, `docs/tecnica/10-SEGURANCA.md`, `docs/tecnica/RUNBOOK.md`.
- `PRODUCTION_READINESS_AUDIT.md`, `REPOSITORY_CLEANUP_REPORT.md`, `REPOSITORY_FILE_CLASSIFICATION.md`.

## 13. Conclusão

A arquitetura atual é funcional em duas trilhas: uma de desenvolvimento/teste (`apps/api` + Vite) e outra de produção (`standalone-server` + SPA compilada em Docker/Render). A compreensão correta do repositório exige tratar essa dualidade como facto central, não como detalhe de implementação.

Antes de qualquer correção funcional, é necessário decidir como garantir paridade entre as duas trilhas e como evitar que a migração destrutiva e os riscos de segurança apontados na auditoria cheguem a produção.

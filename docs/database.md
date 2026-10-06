# Mapa do Banco de Dados

Verificado por leitura directa do schema, migrations, scripts e SQL runtime em 2026-10-05.

> **Leia primeiro:** o que corre em produção é `standalone-server/index.js`, e ele executa DDL no arranque. O schema Drizzle e as migrations versionadas **não** descrevem todo o banco real. Ver §5 (drift).

---

## 1. SGBD e ligação

| Item | Valor | Prova |
|---|---|---|
| SGBD | PostgreSQL (Neon, serverless) | `packages/db/src/index.ts:1-30` |
| Driver (Drizzle) | `@neondatabase/serverless` | `apps/api/package.json`, `packages/db/package.json` |
| Driver (standalone) | `pg` | `standalone-server/package.json` |
| URL de ligação | `CRM_DATABASE_URL \|\| DATABASE_URL` | `packages/db/src/index.ts:7`, `standalone-server/index.js:12-20` |
| TLS | Verificado por omissão; `DB_SSL_REJECT_UNAUTHORIZED=false` só para BD local self-signed | `.env.example:8-10` |

### Segmentos de base de dados

`.env.example:6-7` documenta **dois** segmentos:
- `DATABASE_URL` — BD do ginásio (produção, Render)
- `CRM_DATABASE_URL` — BD do Cademi CRM (fase 2)

**Não confirmado no código atual.** `render.yaml` declara **apenas** `DATABASE_URL`, pelo que em produção ambas as variáveis caem no mesmo URL. `packages/db/drizzle.config.ts:11-21` também só exige `DATABASE_URL`.

---

## 2. Tabelas

Fonte canónica: `packages/db/src/schema/index.ts` (8 enums, 21 tabelas, 4 `relations`).

### 2.1 Tabelas com FK declarada

| Tabela | PK | Colunas | FK | Definição |
|---|---|---|---|---|
| `users` | `id` uuid | 11 | — | `schema/index.ts:13-25` |
| `leads` | `id` uuid | 21 | `owner_id`→`users.id` | `schema/index.ts:27-52` |
| `lead_contacts` | `id` uuid | 10 | `lead_id`→`leads` **cascade**; `staff_id`→`users` **set null** | `schema/index.ts:54-65` |
| `lead_campaigns` | `id` uuid | 6 | `lead_id`→`leads` **cascade** | `schema/index.ts:72-83` |
| `customers` | `id` uuid | 17 | `lead_id`→`leads.id` | `schema/index.ts:85-103` |
| `plans` | `id` uuid | 10 | — | `schema/index.ts:105-116` |
| `subscriptions` | `id` uuid | 9 | `customer_id`→`customers` **NN**; `plan_id`→`plans` **NN** | `schema/index.ts:118-128` |
| `payments` | `id` uuid | 17 | `customer_id`→`customers` **NN**; `subscription_id`→`subscriptions` | `schema/index.ts:130-148` |
| `checkins` | `id` uuid | 5 | `customer_id`→`customers` **NN** | `schema/index.ts:163-169` |
| `webhook_deliveries` | `id` uuid | 9 | `webhook_id`→`webhooks` **NN** | `schema/index.ts:208-218` |
| `api_keys` | `id` uuid | 9 | `user_id`→`users` | `schema/index.ts:251-261` |
| `courses` | `id` uuid | 5 | — | `schema/index.ts:171-177` |
| `customer_courses` | `id` uuid | 5 | `customer_id`→`customers` **NN**; `course_id`→`courses` **NN** | `schema/index.ts:179-185` |

### 2.2 Tabelas sem FK

| Tabela | PK | Notas | Definição |
|---|---|---|---|
| `access` | `id` uuid | **Sem consumidor runtime** | `schema/index.ts:150-161` |
| `integrations` | `id` uuid | `name` unique | `schema/index.ts:187-196` |
| `webhooks` | `id` uuid | — | `schema/index.ts:198-206` |
| `automations` | `id` uuid | — | `schema/index.ts:220-230` |
| `audit_logs` | `id` uuid | `actor_id`/`entity_id` uuid **sem FK** | `schema/index.ts:232-242` |
| `settings` | `id` uuid | `key` unique, `value` jsonb | `schema/index.ts:244-249` |
| `solve_access_logs` | `id` uuid | `customer_id` é **integer** (não uuid) | `schema/index.ts:264-275` |
| `portal_otps` | `id` uuid | `code_hash`, `consumed` | `schema/index.ts:278-286` |

### 2.3 Tabelas que existem **apenas** por DDL de runtime

Criadas por `standalone-server/index.js:266-319` e `packages/db/ovg-reseed.cjs:43-46`. **Não existem** em nenhuma migration nem no schema Drizzle.

| Tabela | Definição |
|---|---|
| `sync_log` | `standalone-server/index.js:269-274` (`id` SERIAL, `synced_at`, `records_synced`, `source`) |
| `ovg_members` | `standalone-server/index.js:277-291` (`customer_number` TEXT PK, `name`, `sex`, `nif`, `mobile_number`, `email`, `status`, `club`, `last_entry`, `entry_date`, `synced_at`) |

### 2.4 Espelho legacy do ginásio

`clientes`, `acessos`, `terminais` — inventariadas em comentários de `standalone-server/index.js:22-47`. JOINs `clientes`↔`acessos`↔`ovg_members` em `:786-899`. Query SQL contra `terminais`: **Não confirmado no código atual.**

### 2.5 Terceira base de dados (Supabase)

| Tabela | Definição |
|---|---|
| `fit90_leads` | `supabase/migrations/0001_fit90_leads.sql:1-38` — `crm_lead_id`, `pushed`, `pushed_at`, CHECK de `source` |

---

## 3. Enums

| Enum | Valores | Linha |
|---|---|---|
| `user_role` | administrador, gestor, comercial, financeiro, operacional | `schema/index.ts:4` |
| `lead_status` | novo_lead, contacto, qualificado, proposta, negociacao, convertido, perdido | `schema/index.ts:5` |
| `customer_state` | activo, inactivo, em_atraso, suspenso | `schema/index.ts:6` |
| `payment_status` | pendente, confirmado, rejeitado, reembolsado, em_atraso, **expirado** | `schema/index.ts:7` |
| `integration_status` | operacional, atencao, erro, inativo | `schema/index.ts:8` |
| `plan_periodicity` | mensal, trimestral, semestral, anual | `schema/index.ts:9` |
| `webhook_status` | pendente, entregue, falha, reprocessado | `schema/index.ts:10` |
| `automation_status` | activo, inactivo | `schema/index.ts:11` |

---

## 4. Migrations

| Ficheiro | Conteúdo |
|---|---|
| `drizzle/0000_empty_hydra.sql` | 8 enums, **16 tabelas**, 11 FKs (`:209-219`) |
| `drizzle/0001_bruno_samora.sql` | `leads.external_id` + índice único **parcial** |
| `drizzle/0002_lead_tracking.sql` | 4 colunas de tracking em `leads` + tabela `lead_contacts` |
| `drizzle/0003_user_login_count.sql` | `users.login_count` + backfill `=1` |

### Migraciones fora do fluxo Drizzle

`packages/db/migrate-delta.cjs:7-61` — idempotente, fecha lacunas da snapshot `0000`:
1. `ALTER TYPE payment_status ADD VALUE 'expirado'`
2. `payments.entity`, `payments.expires_at`, `customers.joined_at`, `customers.gender`
3. `subscriptions.lessons_total`, `subscriptions.lessons_done`
4. `CREATE TABLE IF NOT EXISTS api_keys`, `portal_otps`, `solve_access_logs`
5. `idx_payments_status_expires`, `idx_portal_otps_phone`

`packages/db/add-indexes.cjs:6-18` — 7 índices com `IF NOT EXISTS`:
`idx_payments_status_expires`, `idx_payments_created`, `idx_payments_customer`, `idx_payments_code`, `idx_customers_email`, `idx_customers_cademi`, `idx_audit_created`.

`packages/db/package.json:10-13` **só expõe** `push` e `push-force` (via `drizzle-kit push`, não `migrate`). `drizzle-kit` **não** está configurado para gerar migrations neste fluxo.

---

## 5. Drift schema ↔ migrations ↔ runtime

**Isto é o achado mais importante deste documento.**

| # | Drift | Impacto |
|---|---|---|
| 1 | `leads.ultimo_contato_at` existe **só no schema** (`schema:48`); ausente de `0000`, `0002` e `migrate-delta`. O `apps/api` escreve-o (`routes/leads.ts:403,440`). | **Erro em runtime** se a BD só tiver as migrations versionadas. Depende de `drizzle-kit push` manual. |
| 2 | `lead_campaigns` **não é criada** por nenhuma migration nem script (única ocorrência: `schema:73`), mas é consultada por `apps/api/src/routes/leads.ts:136,361`. | Erro em runtime se não existir na BD. |
| 3 | `subscriptions.lessons_total` / `lessons_done` existem na BD (`migrate-delta:21-22`), usados por `standalone-server:867,2197`, mas **ausentes do schema**. | Clientes Drizzle não os veem. |
| 4 | `users.login_count` existe na BD (`0003`), usado por `standalone-server:312,1006`, **ausente do schema**. | Idem. |
| 5 | `payments.customer_id` é **NOT NULL** no schema/`0000`, mas o standalone faz `DROP NOT NULL` (`index.js:295`) para permitir pagamentos criados por webhook. | **Dois esquemas divergentes** conforme o ambiente. |
| 6 | `settings`: `0000:152-158` e `schema:244-249` usam `id uuid PK` + `key unique` + `value jsonb`; o standalone cria `key TEXT PRIMARY KEY, value TEXT` (`index.js:315-319`). | `CREATE TABLE IF NOT EXISTS` torna o DDL do standalone **no-op** onde o `0000` já correu. |
| 7 | `audit_logs` nunca é consultada pelo standalone — o endpoint `/api/v1/audit-logs` **sintetiza** eventos a partir de `sync_log`, `payments` e `clientes` (`index.js:2578`). | Só o `apps/api` escreve na tabela. |
| 8 | Divergência de estado no primeiro contacto: `apps/api` marca `qualificado` (`leads.ts:289`), o standalone marca `contacto` (`index.js:3038`). | **Comportamento observável diferente** entre as duas APIs. |
| 9 | `sync_log` e `ovg_members` só existem por DDL de runtime. O arranque do standalone pressupõe que o módulo do ginásio está desligado (comentário `index.js:3546`, flag `ENABLE_OVG_SYNC`). | Banco de produção ≠ conjunto de migrations. |

**Nenhuma conexão foi aberta a nenhuma BD nesta auditoria.** O estado real das tabelas é **Não confirmado no código atual.**

---

## 6. ERD

Apenas relações **comprovadas por FK declarada** nas migrations.

```mermaid
erDiagram
    users ||--o{ leads : "owner_id"
    users ||--o{ lead_contacts : "staff_id (set null)"
    users ||--o{ api_keys : "user_id"
    leads ||--o{ lead_contacts : "lead_id (cascade)"
    leads ||--o{ lead_campaigns : "lead_id (cascade)"
    leads ||--o| customers : "lead_id"
    customers ||--o{ payments : "customer_id"
    customers ||--o{ subscriptions : "customer_id"
    customers ||--o{ checkins : "customer_id"
    customers ||--o{ access : "customer_id"
    customers ||--o{ customer_courses : "customer_id"
    plans ||--o{ subscriptions : "plan_id"
    subscriptions ||--o{ payments : "subscription_id"
    courses ||--o{ customer_courses : "course_id"
    webhooks ||--o{ webhook_deliveries : "webhook_id"

    users { uuid id PK; string email UK; string password_hash; user_role role; bool active; timestamp last_login_at }
    leads { uuid id PK; uuid owner_id FK; string code UK; string external_id; lead_status status; date ultimo_contato_at }
    lead_contacts { uuid id PK; uuid lead_id FK; uuid staff_id FK; string canal; string resultado }
    lead_campaigns { uuid id PK; uuid lead_id FK; string source }
    customers { uuid id PK; uuid lead_id FK; string code UK; customer_state state; string ovg_id; string cademi_id }
    plans { uuid id PK; int price; plan_periodicity periodicity; string ovg_plan_id }
    subscriptions { uuid id PK; uuid customer_id FK; uuid plan_id FK; date start_date; bool ovg_synced }
    payments { uuid id PK; uuid customer_id FK; uuid subscription_id FK; string code UK; int amount; payment_status status; string reference_code; string entity; jsonb metadata }
    checkins { uuid id PK; uuid customer_id FK; timestamp checked_in_at }
    webhooks { uuid id PK; string url; string event; string secret }
    webhook_deliveries { uuid id PK; uuid webhook_id FK; jsonb payload; int attempts }
    api_keys { uuid id PK; uuid user_id FK; string key UK }
    courses { uuid id PK; string cademi_course_id }
    customer_courses { uuid id PK; uuid customer_id FK; uuid course_id FK }
    access { uuid id PK; uuid customer_id FK; string platform; string status }
    solve_access_logs { uuid id PK; int customer_id; int remote_id UK; string customer_name }
```

### Relações lógicas (sem FK) — NÃO estão no ERD acima

| Ligação | Mecanismo | Prova |
|---|---|---|
| `solve_access_logs.customer_id` (int) ↔ clientes | por `pin` + `customer_name`; **`customers.id` é uuid** → incompatível | `index.js:3338-3341`, `/api/edge/sincronizar:3363` |
| `customers.ovg_id` ↔ `ovg_members.customer_number` | Sync OVG | `lib/ovg-sync.ts:21-45`, `index.js:2776-2810` |
| `customers.cademi_id` ↔ id Cademi | Webhook Cademi | `index.js:2419-2436` |
| `customers` ↔ `plans` ↔ `subscriptions` | via `subscriptions.customer_id`/`plan_id`; `plans.name` é chave de correspondência com produtos Cademi | `index.js:864-867`, `seed-plans.cjs:48-58` |
| `leads.external_id` ↔ `fit90_leads.id` | Idempotência | `index.js:3489-3497`, `:3643-3654` |
| `payments` ↔ cliente | `metadata->>'email'` | `docs/tecnica/07-BASE-DADOS.md:8-9` |

### Tabelas com Written access automático

| Writers | Tabelas |
|---|---|
| Job `EXPIRY` (`index.js:3547-3559`, `apps/api/src/app.ts:194-210`) | `payments` (`status='expirado'`) |
| Job `AUTOSYNC` (`index.js:3566-3620`) | `payments`, `subscriptions`, `customers` |
| Job `FIT90_SYNC` (`index.js:3626-3667`) | Supabase `fit90_leads` |
| Login (`index.js:1006`, `apps/api/src/routes/auth.ts:102`) | `users.last_login_at`, `users.login_count` |
| Sync Cademi (`index.js:2073-2101`) | `customers`, `subscriptions`, `payments` |
| Edge Agent (`index.js:3326-3370`) | `solve_access_logs` (upsert por `remote_id`) |
| `packages/db/*.cjs` | 17 tabelas (`clear-data.cjs:16-35` faz `DELETE`) |

---

## 7. Tabelas abandonadas — classificação

| Tabela | Classificação | Evidência |
|---|---|---|
| `access` | **Confirmadamente abandonada** | Criada por `0000`, apagada por `clear-data.cjs:26`, **zero consumidores runtime**. O acesso real usa `solve_access_logs` (API/standalone) e o espelho legacy `acessos`. |
| `courses` | **Confirmadamente abandonada** | Criada por `0000`, apagada por `clear-data.cjs:26`, **zero consumidores**. A entrega de cursos Cademi vive em `plans`/`subscriptions`. |
| `customer_courses` | **Confirmadamente abandonada** | Idem. |
| `audit_logs` | **Não confirmada** | Escrita pelo `apps/api`; o standalone **não a consulta**. Testada em `dashboard.ts`. |
| `terminais` | **Não confirmada** | Só aparece em comentários (`index.js:26,51`); a "rota" em `:262` é o `410` de `/db-*`. |
| `lead_campaigns` | **Não confirmada** | Consultada por `apps/api`, mas criada por nada. |

> ⚠️ **Nenhuma tabela foi removida nesta auditoria.** Eliminar tabelas altera schema e é operação do cliente com conhecimento do negócio.

---

## 8. Regras de operação do banco

De `docs/tecnica/07-BASE-DADOS.md:39`:

1. **Não alterar** colunas com sufixo `_del` (dados arquivados por registo).
2. **Não mexer** em `sync_state`.
3. **Filas apagadas** são intencionais; restaurar pode reativar clientes.
4. **Cota Neon**: 5.99 GB/transferência. Aumentar polling satura a cota (ver `CHANGELOG.md:54-60`).

---

## 9. Como aplicar o schema

```bash
# Drizzle push (CANONICO do repo)
pnpm --filter @workspace/db push

# Deltas idempotentes fora do Drizzle
node packages/db/migrate-delta.cjs
node packages/db/add-indexes.cjs

# SQL bruto da migration 0000
pnpm --filter @workspace/scripts push-schema
```

Todos usam `CRM_DATABASE_URL || DATABASE_URL` e verificam o certificado TLS por omissão.

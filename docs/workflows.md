# Workflows

Fluxos **verificados por leitura do código** em 2026-10-05. Cada fluxo indica ficheiro de entrada, função principal, tabelas, integrações e resultado.

> **Regra de leitura:** existem **duas APIs** a implementar o mesmo domínio. `standalone-server/index.js` é a de **produção**; `apps/api` é a **local/catraca**. Onde divergem, assinalado.

---

## Convenções

| Símbolo | Significado |
|---|---|
| ⛔ | Requer token de staff (`Authorization: Bearer`) |
| 👤 | Sessão de cliente (`portal_token`) |
| 🔑 | Requer `X-API-Key` |
| 📡 | Superfície HTTP pública |

---

## 1. Autenticação

### 1.1 Login de staff (⛔)

```text
POST /api/v1/auth/login { email, password }
  ↓ validação (zod)
  ↓ SELECT * FROM users WHERE email = $1
  ↓ bcrypt.compare(password, users.password_hash)
  ↓ UPDATE users SET last_login_at = NOW(), login_count = login_count + 1
  ↓ JWT sign { sub: id, role }, expiração JWT_EXPIRES_IN (default 24h)
  ↓ SET-Cookie httpOnly + resposta { token, user }
```

| | |
|---|---|
| Ficheiro prod. | `standalone-server/index.js:961-1019` |
| Ficheiro local | `apps/api/src/routes/auth.ts` |
| Tabelas | `users` |
| Resultado | `token` JWT + cookie httpOnly; `login_count` incrementado |

Rate limit dedicado: `authRateLimit` em `/api/v1/auth` (`apps/api/src/app.ts:87`); global 200/15min (`index.js:236`).

### 1.2 Registo público (📡)

`POST /api/v1/auth/register` (`index.js:1020-1061`) — limitado a `comercial | financeiro | operacional`. Papéis privilegiados exigem convite. **Backdoor de registo em dev removido** (`CHANGELOG.md:22`).

### 1.3 Recuperação de password (📡)

```text
POST /api/v1/auth/forgot-password { email }
  ↓ SELECT FROM users WHERE email = $1
  ↓ gera token → guarda como settings['password_reset_<hash>']
  ↓ resposta GENÉRICA (mesma para email existente e inexistente)
  ↓ NUNCA regista o token nos logs
POST /api/v1/auth/reset-password { token, password }
  ↓ valida expiração + password mínima (8 chars)
  ↓ bcrypt.hash → UPDATE users SET password_hash
```

Ficheiro: `index.js:1074-1142`. Chave daBD fora da tabela `settings` é filtrada da API por `SECRET_RE` (`index.js:324,328`).

### 1.4 OTP do portal do cliente (📡 → 👤)

```text
POST /api/v1/portal/otp/request { phone }
  ↓ normaliza para formato AO, valida
  ↓ INSERT INTO portal_otps (phone, code_hash, expires_at)
  ↓ se WHATSAPP_TOKEN ausente:
      NODE_ENV=production → NÃO devolve código, falha segura (index 84-87)
      senão → loga e devolve devCode (apenas dev)
  ↓ senão → WhatsApp Cloud API sendText
POST /api/v1/portal/otp/verify { phone, code }
  ↓ SELECT portal_otps WHERE phone AND consumed=false
  ↓ timing-safe compare do hash
  ↓ UPDATE consumed = true
  ↓ JWT { sub: customer_id, scope: 'cliente' } → portal_token
```

Ficheiro: `apps/api/src/routes/portal-auth.ts`, `apps/api/src/lib/portal-otp.ts`. Tabela: `portal_otps`.

**Teste de guarantee:** `apps/api/src/__tests__/portal.test.ts:105,122` afirma `devCode` é `undefined`.

---

## 2. Pagamentos

### 2.1 Checkout público por referência (📡) — método `referencia`

```text
POST /api/v1/payments { amount, method: 'referencia', phone, email, name, cademi_produto }
  ↓ valida preço contra settings['cademi_entregas']      ← anti-tampering
  ↓ SELECT clientes/ customers por (telefone OU email)  ← 9 dígitos, indexada
  ↓ INSERT INTO payments (code, customer_id, amount, method, status='pendente',
                          reference_code, metadata{phone,email,name,cademi_produto,description},
                          expires_at = NOW() + 24h)
  ↓ response 201 imediata
  ↓ background: gera entidade + número de referência
```

| | |
|---|---|
| Ficheiro | `standalone-server/index.js:1753-1874` |
| Tabelas | `payments`, `customers`/`clientes`, `settings` |
| metadata | Allowlist explícita — `hosted_url` **não** é controlável pelo cliente (`:1843`) |

✅ **`return_url`** é validado contra uma allowlist exacta de origens (`sanitizarReturnUrl()`): origens de `RETURN_URL_ALLOWED_ORIGINS`, `FRONTEND_URL`, `CORS_ORIGIN`, `APP_URL` e `RENDER_EXTERNAL_URL`. Só HTTP(S), URL canónica, tamanho máximo de 300 caracteres. Sem correspondência — ou sem allowlist configurada — o campo é **ignorado** e o pagamento é criado sem `success_url`/`failure_url` (fail-closed; não quebra o checkout). A origem da página de origem do Cademi tem de ser declarada pelo operador em `RETURN_URL_ALLOWED_ORIGINS`. Corrigido nesta auditoria — ver `docs/architecture.md` §9.

### 2.2 Checkout WiPay hospedado — método `mcx_express` (📡)

```text
POST /api/v1/payments { ..., method: 'mcx_express', return_url? }
  ↓ INSERT (igual a 2.1)
  ↓ response 201
  ↓ background: fireWipayCharge()
      POST https://api.wipay.ao  (OAuth2 client-credentials)
      → 303 Location: <hosted_url>
      ↓ guarda payments.metadata->>'hosted_url'
      ↓ UPDATE metadata
GET /api/v1/payments/:code  (check-status)
  ↓ devolve hosted_url → o widget mostra o botão "Pagar"
```

Ficheiros: `index.js:1166-1424` (cobrança), `:1389-1424` (webhook). Integração: `WIPAY_CLIENT_ID`, `WIPAY_CLIENT_SECRET`.

O widget embebido (`standalone-server/public/pay-widget.js`) consome isto. **XSS corrigido nesta auditoria** — sinks de `innerHTML` com `hosted_url` migrados para APIs DOM + guard de esquema `http(s)` (`safeHttpUrl`).

### 2.3 É-kwanza GPO (📡)

```text
POST /api/v1/payments { method: 'mcx_express', phone }
  ↓ sem WIPAY_HOST → cai para push É-kwanza
  ↓ OAuth2 token (cache) → POST /charges
  ↓ guarda ekwanza_code, ekwanza_operation_code
POST /webhooks/ekwanza            ← callback do banco
  ↓ VALIDA formato da notificação
  ↓ NUNCA cria pagamentos
  ↓ só muda estado se confirmação GPO + divergência de valor + confirmação
  ↓ caso contrário fica 'pendente' + metadata
```

Ficheiros prod.: `index.js:1166-1388`. Locais: `apps/api/src/lib/ekwanza.ts`, `ekwanza-callback.ts`, `routes/payments-ekwanza.ts`.

Tabela `payments`: `ekwanza_code`, `ekwanza_operation_code`, `status`, `paid_at`, `reconciled_at`.

### 2.4 Cancelamento (⛔)

```text
POST /api/v1/payments/:code/cancel { email?, phone? }
  ↓ RBAC: financeiro+ (standalone) / authorize() (apps/api)
  ↓ verifica identidade do dono (email OU telefone normalizado)
  ↓ UPDATE payments SET status='rejeitado'
  ↓ broadcast SSE payment_update
  ↓ remove bloco da referência no widget
```

Ficheiro: `index.js:1501-1620`. Semântica do estado inicial no primeiro contacto **divergente** entre APIs (`apps/api`: `qualificado`; standalone: `contacto`).

### 2.5 Jobs de pagamento (automáticos)

| Job | Intervalo | Acção | Ficheiro |
|---|---|---|---|
| `EXPIRY` | — | `payments.status='expirado'` onde `expires_at < NOW()` | `index.js:3547-3559`; `apps/api/src/app.ts:194-210` |
| `AUTOSYNC` | 5 min | Reconcilia pendentes ≤48h via WiPay e GPO | `index.js:3566-3620` |
| `KEEP-ALIVE` | — | GET `/healthz` (sem BD) | `index.js:3528-3543` |
| `FIT90_SYNC` | 5 min | `PATCH` `fit90_leads` no Supabase | `index.js:3626-3667` |

---

## 3. Portal do cliente (👤)

Rotas: `/conta/login`, `/conta`, `/conta/pagamentos`, `/conta/recibos/:id` (`App.tsx:2728-2731`). Guard: `ProtectedPortal` (`App.tsx:2530-2545`).

```text
GET  /api/v1/portal/minha-conta          → customer + subscriptions + progresso aulas
GET  /api/v1/portal/pagamentos?limit=   → histórico do cliente
POST /api/v1/portal/pagar               → cria pagamento GPO (portal.ts:215)
GET  /api/v1/portal/recibos/:id         → recibo
```

Camada: `apps/web/src/portal/api.ts`. Token em `portal_token` (localStorage), sessão **separada** da staff.

---

## 4. Entrega de cursos Cademi

```text
POST /api/v1/cademi/sync                ⛔
  ↓ autentica na Cademi (CADEMI_API_KEY)
  ↓ GET /products, /users, /users/:id/access
  ↓ upsert customers (por cademi_id)
  ↓ upsert subscriptions (por nome de plano)
  ↓ upsert payments confirmados
  ↓ escreve subscriptions.lessons_total / lessons_done
GET  /api/v1/cademi/entregas             ⛔ → entregas por aluno
GET  /api/v1/cademi/alunos-cobranca      ⛔
POST /api/v1/webhooks/cademi             📡 → cria acesso após pagamento confirmado
POST /api/v1/payments/:code/cademi-delivery  ⛔ → entrega manual
```

Ficheiros: `index.js:1919-2494`. Tabelas: `customers`, `subscriptions`, `payments`, `settings`. **Acesso real é gravado em `solve_access_logs`, não em `access`.**

---

## 5. Acesso físico / ginásio (catraca)

### 5.1 PC da catraca → cloud (🔑)

```text
POST /api/edge/evento     { remote_id, pin, customer_name, ... }
  ↓ auth (X-API-Key)
  ↓ INSERT INTO solve_access_logs ... ON CONFLICT (remote_id) DO NOTHING
  ↓ customer_id = parseInt(pin)
GET  /api/edge/comandos    → comandos pendentes
GET  /api/edge/sincronizar → SELECT DISTINCT customer_id, customer_name
```

Ficheiro: `index.js:3326-3370`.

### 5.2 Cloud → PC da catraca (⛔, proxy)

O `standalone-server` faz **proxy** para `SOLVE_ACCESS_URL` (o PC da catraca):
`/api/v1/access/stats`, `/api/v1/access/logs`, `/api/v1/terminal/status`, `/api/v1/terminal/unlock`, `/api/v1/access/stream` (SSE).

Ficheiro: `index.js:580-814`, `:3387-3427`.

### 5.3 Sincronização OVG

```text
POST /api/v1/access/ovg-sync   ⛔  → busca membros na OVG → upsert ovg_members + customers
GET  /api/v1/access/ovg-status ⛔
POST /api/v1/access/ovg-reseed ⛔
```

Local: `sincronizar-ovg.cmd` → `packages/db/ovg-reseed.cjs` (corre **no PC do ginásio**, IP autorizado pela OVG; agendado 4×/dia).

⚠️ O arranque do runtime pressupõe o módulo do ginásio **desligado** (`ENABLE_OVG_SYNC`, comentário `index.js:3546`).

---

## 6. CRM — leads, clientes, planos, dashboard

| Fluxo | Ficheiro prod. | Ficheiro local | Tabelas |
|---|---|---|---|
| CRUD de leads | `index.js:2888-3143` | `routes/leads.ts` | `leads`, `lead_contacts`, `lead_campaigns`, `users`, `customers` |
| Resumo de leads | `index.js:2942-2975` | `routes/dashboard.ts` | `leads` |
| CRUD de clientes | `index.js:814-930` | `routes/customers.ts` | `customers`, `subscriptions`, `payments` |
| CRUD de planos | `index.js:3144-3205` | `routes/plans.ts` | `plans` |
| **Delete de plano** | `index.js:3184-3208` — 409 com contagens; cascade manual `payments`→`subscriptions`→`plans` | `routes/plans.ts` | `plans`, `subscriptions`, `payments` |
| Dashboard | `index.js:2495-2566` | `routes/dashboard.ts` | `customers`, `leads`, `payments`, `subscriptions`, `checkins`, `integrations`, `plans` |
| Utilizadores | `index.js:2693-2773` | `routes/users.ts` | `users` |
| Integrações | `index.js:2567-2577` | `routes/integrations.ts` | `integrations` |
| Automações | `index.js:2622-2692` | `lib/automation-engine.ts` | `automations` |
| Auditoria | `index.js:2578-2621` — **sintetiza** eventos | `routes/audit-logs.ts` | ⚠️ **não** consulta `audit_logs` |

### Conversão de lead → cliente

```text
POST /api/v1/leads/:id/convert   ⛔
  ↓ INSERT customers (lead_id, code, state='activo')
  ↓ UPDATE leads SET status='convertido'
```

`index.js:3131-3143`; `routes/leads.ts`.

---

## 7. Relatórios (100% no browser)

`apps/web/src/lib/relatorios.ts` — **sem backend**.

| Função | Usada em | Lib |
|---|---|---|
| `exportarExcel` | `App.tsx:476, 1252, 1876` | escritor próprio `src/lib/xlsx.ts` (ZIP + SpreadsheetML, sem dependências) |
| `exportarPDF` | `App.tsx:485, 1253, 1877` | `jspdf` + `jspdf-autotable` |
| `formatarData` | `App.tsx:1874` | — |

✅ O `xlsx` foi removido (`CVE-2023-30533` + `CVE-2024-22363`). `apps/web/src/lib/xlsx.ts` escreve o `.xlsx` directamente: células de texto e número, várias folhas, larguras de coluna e nomes de folha sanitizados. Sem fórmulas, sem datas interpretadas, sem estilos. Ver `docs/architecture.md` §9.

---

## 8. Landing pages

| Página | Ficheiro | Fluxo |
|---|---|---|
| `/`, `/login` | `apps/web/src/landing/Login.tsx` | AuthContext → `POST /api/v1/auth/login` |
| `/fit-studio` | `apps/web/src/landing/FitStudio.tsx` | `useCMS` → `ProgramCheckoutModal` → `pay4all.ts` (**mock**) |
| Footer CTA | `sections/CTAFinal.tsx:94` → `ui/ContactForm.tsx` | `POST /api/v1/leads` |
| `pay-widget.js` | `standalone-server/public/` | Checkout embebido em código de terceiros |

### Leads de landings externas (Fit90)

```text
Supabase function push-lead-to-crm
  ↓ trigger na tabela fit90_leads
  ↓ valida, chama CRM_API_URL com CRM_API_KEY
  ↓ POST /api/v1/leads/fit90-hook  📡
  ↓ UPSERT por external_id (idempotente)
  ↓ actualiza pushed / pushed_at / crm_lead_id
```

Ficheiros: `supabase/functions/push-lead-to-crm/index.ts`, `index.js:3479-3504`, job `:3626-3667`.

---

## 9. Subsistemas sem fluxo completo confirmado

| Item | Estado |
|---|---|
| `apps/web/src/landing/services/pay4all.ts` | **Mock.** Código real comentado; `TODO:16`. |
| `CartContext` | `addToCart` nunca é chamada → carrinho inalcançável por UI. **Não confirmado** se é planeado. |
| `apps/api/src/routes/whatsapp.ts` | `docs/tecnica/08-WHATSAPP.md:6` descreve como "parcial, não vai a produção". |
| `access`, `courses`, `customer_courses` | Tabelas criadas e apagadas, sem consumidor. Ver `docs/database.md` §7. |
| `lib/python` (referenciado em `index.js:3323`, `ovg-reseed.cjs:1-4`) | **Não confirmado no código atual.** A pasta `correr-este-script-no-pc-para-atualizar-os-dados-do-ovg/` só contém `LEIA-ME.txt` e `instalar-sync.cmd`. |

---

## 10. Fluxos não verificados

| Limitação | Motivo |
|---|---|
| Nenhuma BD foi contactada | Sem credenciais; `DATABASE_URL` é placeholder |
| Nenhum serviço externo foi chamado | Evita custo e efeitos reais |
| E2E inexistente | Não há Playwright/Cypress no repositório |
| Widget não testado em browser real | Validado com DOM stub (60 checks) |
| Deploy não verificado | `git push` não foi executado |

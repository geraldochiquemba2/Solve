# 10 — Segurança (auditoria Set/2026 + regras)

## O que foi corrigido

**Crítico (explorável antes, fechado agora):**
1. **Chaves default públicas removidas** — `API_KEY`/`JWT_SECRET` tinham fallback
   `solve-crm-api-key-2024` / `solve-corporate-crm-secret` no código. Qualquer
   pessoa entrava na API. Agora: em produção o servidor **recusa arrancar** sem
   segredos; comparação timing-safe (`crypto.timingSafeEqual`).
2. **Auto-registo a admin fechado** — `POST /auth/register` aceitava
   `role: administrador`. Agora só `comercial|financeiro|operacional`.
3. **Backdoor dev removido** — login devolvia JWT admin sem password com
   `NODE_ENV=development` ou erro de BD.
4. **Rotas `/db-*` apagadas** — despejavam `SELECT *` de clientes/acessos e a
   lista de tabelas sem login. Agora dão `410 Gone`.
5. **Catraca sem auth fechada** — `POST /terminal/unlock` era público. Agora
   exige staff logado; falha reporta `502 ok:false` (antes dizia `ok:true`).
6. **Ingestão das máquinas com chave** — `/access/sync`, `/access/ovg-sync`,
   `/api/edge/*` exigem `X-API-Key` (ver § Máquinas do ginásio).
7. **Webhook É-kwanza verificado** — qualquer POST marcava `confirmado` e até
   **criava** pagamentos. Agora: valida formato, nunca cria, só muda estado com
   confirmação server-side (consulta GPO); sem confirmação fica `pendente` +
   `metadata.ekwanza_unverified_callback` para revisão. Divergência de valor
   nunca confirma.
8. **OTP anti-enumeração** — `otp/request` dizia `404`/`403` (oráculo de números)
   e devolvia o código (`devCode`) na resposta. Agora responde sempre genérico,
   sem código (em dev o código sai só no log do servidor), e não cria OTP para
   números estranhos. Comparação do código timing-safe.
9. **Segredos fora do código** — 12 scripts `packages/db/*.cjs` + `fix-password.mjs`
   tinham a connection string Neon e a chave Cademi escritas dentro, e passwords
   de admin fracas em plaintext. Agora tudo via env (`CRM_DATABASE_URL`,
   `DATABASE_URL`, `CADEMI_API_KEY`, `ADMIN_PASSWORD`, `ADMIN_PHONE`,
   `ADMIN_EMAIL`), bcrypt 10 rounds, abortam sem env.
10. **Frontend sem chaves** — `App.tsx`, `use-api.ts`, `pay-widget.js`, `dev.ps1`
    traziam a chave default no bundle. Agora `""` (fail-closed → 401).
11. **Streams com login** — `/payments/stream` e `/access/stream` exigiam nada e
    mandavam `Access-Control-Allow-Origin: *`. Agora exigem auth, sem `*`.
12. **Logs limpos** — token de reset de password e corpos OVG/É-kwanza já não vão
    para logs. `GET /settings` no standalone mascara segredos (`SECRET_RE`).
13. **Deploy** — `Dockerfile` corre como `USER node` + `npm ci --omit=dev`;
    ficheiro morto `apps/api/src/standalone.ts` (rotas abertas duplicadas) apagado.

**Alto/médio (endurecido):** headers (`nosniff`, `DENY`, `Referrer-Policy`,
HSTS em prod), rate-limit em memória (200/min geral, 20 auth/edge, 60 webhooks),
`express.json({limit:"100kb"})`, CORS por lista, logout limpa cookie com flags,
registo com password ≥ 8, `PUT /settings` continua a proteger `password_reset_*`.

## Máquinas do ginásio (ação obrigatória no PC)

`sync_crm.py`, `sync_ovg.py`, `edge_agent.py` têm de enviar a chave em cada pedido:

```python
headers = {"X-API-Key": API_KEY, "Content-Type": "application/json"}
# POST https://solve-sqoh.onrender.com/api/v1/access/sync
# POST https://solve-sqoh.onrender.com/api/v1/access/ovg-sync
# POST https://solve-sqoh.onrender.com/api/edge/evento
# GET  https://solve-sqoh.onrender.com/api/edge/comandos
# GET  https://solve-sqoh.onrender.com/api/edge/sincronizar
```

`API_KEY` = o mesmo valor do Render. Opcional: `EDGE_API_KEY` dedicado no Render
para as máquinas (se vazio, vale o `API_KEY`). Sem header → `401`.

## Rodar segredos (fazer antes da assinatura)

Trocar no Render + Neon + OVG + É-kwanza + Cademi: `JWT_SECRET`, `API_KEY`,
`OVG_PASSWORD`, `EKWANZA_CLIENT_SECRET`, `CADEMI_API_KEY`, `DATABASE_URL`/
`CRM_DATABASE_URL` (a password Neon circulou em ficheiros até Set/2026).
Depois: novo login para todos (JWT antigo morre), atualizar PC do ginásio,
Supabase (`CRM_API_KEY`) e `.env` local. Nunca commitar `.env`.

## Resposta ao relatório externo de 24/09/2026 (17 itens)

Auditoria grey-box independente confirmou o que já tínhamos fechado e achou
mais 4 pontos. Estado após a ronda 2 (código já no ar):

| ID | Item | Estado |
|---|---|---|
| VULN-01 | Credenciais hardcoded | Código limpo. **Falta (cliente): rodar password Neon `neondb_owner` + `OVG_PASSWORD` e purgar histórico Git** (ver abaixo) |
| VULN-02 | Chave estática + JWT default | Fechado: fail-closed + timing-safe. Retestar: `X-API-Key: solve-crm-api-key-2024` → 401 |
| VULN-03 | Webhook forjável | Fechado: confirmação GPO obrigatória. Prova viva apagada: linha falsa `AUDIT_NONEXISTENT_TEST` removida da BD |
| VULN-04 | Unlock + `/db-*` abertos | Fechado: unlock com login; `/db-*` → 410 |
| VULN-05 | Registo a admin | Fechado (whitelist) + convites com papel validado |
| VULN-06 | Sem RBAC | **Fechado ronda 2**: `requireRole` no standalone (settings/planos/automações→gestor+; users→admin; cancelamento→financeiro+; syncs externas→gestor+). `apps/api` já tinha `authorize()` |
| VULN-07 | IDOR | Parcial: `GET /users/:id` próprio-ou-chefia; gestão de users só admin. Leituras/edições de clientes/leads partilhadas **por desenho** (um ginásio, equipa partilha carteira) |
| VULN-08 | Bypass frontend | Fechado: sem fallback local, CRM exige JWT |
| VULN-09 | SSE + CORS `*` | Fechado: streams com login (cookie httpOnly), sem `*` |
| VULN-10 | Sem rate-limit | Fechado: rate-limit em memória (200/20/60) |
| VULN-11 | Reset em logs | Fechado: sem token em logs. SMTP continua TODO |
| VULN-12 | JWT em localStorage | Aceite (ver riscos). Sem blacklist: logout invalida cookie; token expira em 24h |
| VULN-13 | Stack traces | **Fechado ronda 2**: 500 genérico em 52 rotas + handler global + `x-powered-by` off |
| VULN-14 | SSL `rejectUnauthorized:false` | **Fechado**: os 20 clientes `pg` (`packages/db/*`, `scripts/push-schema.mjs`) verificam o certificado por omissão. Só se desliga com `DB_SSL_REJECT_UNAUTHORIZED=false` (BD local self-signed) |
| VULN-15 | Headers | Parcial: nosniff/DENY/Referrer/HSTS + `x-powered-by` off. **Sem CSP** (SPA Vite com inline — CSP quebraria; reavaliar com nonce) |
| VULN-16 | `?api_key=` no URL | **Fechado ronda 2**: chave só via header; streams usam cookie (`withCredentials`) |
| VULN-17 | Passwords fracas | Fechado: mínimo 8 em registo + reset (front e back) |

## VULN-01 restante: rotação + histórico (ação do cliente, P0)

1. **Neon**: dashboard do projeto → Roles → reset da password de `neondb_owner` →
   atualizar `DATABASE_URL`/`CRM_DATABASE_URL` no Render + `.env` local.
2. **OVG**: nova password → `OVG_PASSWORD` no Render + `settings`.
3. **É-kwanza/Cademi**: rodar `EKWANZA_CLIENT_SECRET`, `CADEMI_API_KEY`, `API_KEY`, `JWT_SECRET`
   (os dois últimos já têm valores novos gerados em Set/2026 — confirmar no Render).
4. **Histórico Git**: os segredos existem em commits antigos. Purgar com
   `git filter-repo` (reescreve hashes — coordenar com a equipa) ou, no mínimo,
   nunca dar acesso ao histórico a terceiros e rodar tudo acima (password rodada
   = histórico inofensivo).

## Riscos residuais aceites (documentados, não ignorados)

- **`?api_key=` removido (ronda 2)**: streams usam cookie httpOnly; chave só em
  header para máquinas/scripts. Fallback de chave no frontend só quando não há JWT.
- **Leituras/edições de clientes e leads partilhadas por desenho**: um ginásio,
  uma carteira — toda a equipa staff vê e edita. Apagar lead e gerir users exigem
  chefia. Se um dia houver várias lojas, implementar tenancy.
- **JWT em `localStorage`** — XSS roubaria sessão. Mitigado com headers,
  sem `dangerouslySetInnerHTML` com input de user, e sem `eval`. Migração para
  cookie-only exige mudar o frontend (fora deste âmbito).
- **TLS do Postgres** — os clientes `pg` verificam o certificado por omissão
  (`rejectUnauthorized: true`). Desligar só com
  `DB_SSL_REJECT_UNAUTHORIZED=false`, e apenas para BD local com certificado
  self-signed; em produção isso deixa a ligação aberta a MITM. Nota: a imagem
  de produção corre `standalone-server/index.js`, que tem o seu próprio `pg.Pool`
  e **mantém** `rejectUnauthorized: false` por não estar no âmbito da ronda.
- **Registo público continua aberto** (comercial/financeiro/operacional) —
  se houver spam, pôr por convite (desligar `POST /auth/register` público).
- **Callback É-kwanza sem HMAC do fornecedor** — compensado com confirmação
  server-side; se a API É-kwanza estiver em baixo, callbacks ficam pendentes
  até ao auto-sync (5 min) ou "Sincronizar".
- **WhatsApp inativo** — `POST /whatsapp/webhook` sem verificação Meta; ao ativar,
  exigir verificação de assinatura (ver `08-WHATSAPP.md`).

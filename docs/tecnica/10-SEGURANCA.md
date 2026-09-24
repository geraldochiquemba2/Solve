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

## Riscos residuais aceites (documentados, não ignorados)

- **JWT em `localStorage`** — XSS roubaria sessão. Mitigado com headers,
  sem `dangerouslySetInnerHTML` com input de user, e sem `eval`. Migração para
  cookie-only exige mudar o frontend (fora deste âmbito).
- **`?api_key=` no EventSource** — `EventSource` não envia headers; a chave vai
  no query (fica em logs). Mitigado: chave rotativa + só streams de leitura.
- **SSL `rejectUnauthorized:false`** no driver `pg` — aceite por compatibilidade
  Neon; a string exige `sslmode=require` (cifrado, sem verificação total).
- **Registo público continua aberto** (comercial/financeiro/operacional) —
  se houver spam, pôr por convite (desligar `POST /auth/register` público).
- **Callback É-kwanza sem HMAC do fornecedor** — compensado com confirmação
  server-side; se a API É-kwanza estiver em baixo, callbacks ficam pendentes
  até ao auto-sync (5 min) ou "Sincronizar".
- **WhatsApp inativo** — `POST /whatsapp/webhook` sem verificação Meta; ao ativar,
  exigir verificação de assinatura (ver `08-WHATSAPP.md`).

# Deploy e operação

## Produção (Render, plano Free)
Serviço `solve-crm-api`, Docker (`Dockerfile` multi-stage: build frontend com
`PORT=5173 BASE_PATH=/`, runtime `node index.js` porta 3000), `autoDeploy` do
`main` no GitHub `geraldochiquemba2/Solve` (~5–10 min por deploy). Healthcheck:
`/healthz`. Após cada deploy: hard refresh (Ctrl+Shift+R) — o bundle tem hash.

## Anti-hibernação
Free adormece após 15 min sem tráfego. Mitigações ativas: self-ping interno
`/healthz` a cada 10 min (`RENDER_EXTERNAL_URL` automática) + 750h/mês chegam.
Se dormir: 1º acesso demora ~1 min. Garantia total só no plano pago.

## Variáveis (Render → Environment; segredos com sync off)
`DATABASE_URL`, `NODE_ENV=production`, `PORT=3000`, `OVG_*`, `JWT_SECRET`,
`EKWANZA_*` (client/secret/resource, GPO_URL, chaves, conta `06100363`,
métodos GPO/REF), `CADEMI_API_URL/KEY`, `CORS_ORIGIN`, `API_KEY`.
Prioridade: **env > tabela `settings`** (editável em Integrações/Definições).

## Integração Supabase → CRM (Fit 90)

### Arquitectura
```
Landing Fit90 ──POST──▶ Supabase (fit90_leads) ──Edge Function──▶ CRM API (POST /api/v1/leads)
     (JS client)              (tabela local)          (push-lead-to-crm)         (Neon Postgres)
```

A landing Fit 90 só comunica com a **Supabase**; a tabela `fit90_leads` guarda
o registo local e a edge function `push-lead-to-crm` encaminha para o CRM.

### Setup no Supabase (projeto `fslrkrhuatzfqxbzilnd`)
1. **Tabela**: correr o SQL em `supabase/migrations/0001_fit90_leads.sql` no
   SQL Editor do Supabase Dashboard (cria `fit90_leads` + RLS: anon só INSERT,
   service_role tudo).
2. **Edge Function**: deploy do `supabase/functions/push-lead-to-crm/`:
   ```bash
   supabase functions deploy push-lead-to-crm --project-ref fslrkrhuatzfqxbzilnd
   ```
3. **Secrets da edge function**:
   ```bash
   supabase secrets set CRM_API_URL=https://solve-sqoh.onrender.com \
     CRM_API_KEY=<API_KEY_forte> --project-ref fslrkrhuatzfqxbzilnd
   ```
   `CRM_API_KEY` deve ser o mesmo `API_KEY` definido no Render (não o default
   `solve-crm-api-key-2024` em produção).

### CRM (lado receptor)
Endpoint: `POST /api/v1/leads`, autenticado com `X-API-Key: <API_KEY>`.
Body: `name` (obrigatório), `email`, `phone`, `company`, `source`,
`estimatedValue`, `notes`, `externalId` (UUID do `fit90_leads.id`).
Idempotência: `externalId` duplicado → UPDATE + 200 (não cria novo lead).
Novo contacto recebe automaticamente `novo_lead`.

### Credenciais Supabase (para a landing page)
```
URL:   https://fslrkrhuatzfqxbzilnd.supabase.co
anon:  sb_publishable_bCQNFzX2kFbX4gM9zZwrsw_9-yhIbRj
```
Usar a **anon key** (publishable) no JS client da landing — **nunca** a service
role key no frontend.

### Teste rápido
```bash
# Simular a landing a submeter um lead
curl -X POST https://fslrkrhuatzfqxbzilnd.supabase.co/functions/v1/push-lead-to-crm \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"name":"João Teste","email":"joao@test.com","phone":"+244900000000","source":"fit90_landing"}'
```
Espera-se: `201` com o lead criado no CRM. Verificar no CRM:
```bash
curl https://solve-sqoh.onrender.com/api/v1/leads \
  -H "X-API-Key: <API_KEY>"
```

## Jobs (dentro do servidor)
Expiração 5min, auto-sync É-kwanza 5min (quota Neon), OVG 30min,
keep-alive 10min, SSE acessos 10–15s (só com clientes ligados).
Frontend: dashboards/listas 5min, pagamentos 2min, catraca 1min, sem refetch ao focar janela.

## Problemas comuns
| Sintoma | Ver |
|---|---|
| Site lento 1ª vez | hibernado; aguardar ~1 min |
| Página velha após deploy | hard refresh; confirmar Live no Render |
| `0 alunos` / secção vazia | endpoint em falta = deploy pendente |
| Pagamento preso pendente | Sincronizar; webhook/callback É-kwanza |
| Referência sem número | `metadata.ekwanza_error`; Verificar Estado regenera |
| Cademi "Com erro" | Vendas na Cademi mostra o motivo |
| Login loop | limpar cookies/localStorage (`token`, `portal_token`) |

## Local (dev)
Backend: `apps/api/` com env de `apps/api/.env`
(`PORT=3000`, mata processo antigo na porta primeiro). Frontend:
`apps/web` com `VITE_API_URL=http://localhost:3000`
(`PORT=5173 BASE_PATH=/ pnpm dev`). URLs: `localhost:5173` + `:3000`.

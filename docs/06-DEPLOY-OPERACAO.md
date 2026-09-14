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

## Jobs (dentro do servidor)
Expiração 5min, auto-sync É-kwanza 60s, keep-alive 10min, SSE acessos 5s.

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
Backend: `standalone-server/` com env de `artifacts/api-server/.env`
(`PORT=3000`, mata processo antigo na porta primeiro). Frontend:
`artifacts/solve-crm` com `VITE_API_URL=http://localhost:3000`
(`PORT=5173 BASE_PATH=/ pnpm dev`). URLs: `localhost:5173` + `:3000`.

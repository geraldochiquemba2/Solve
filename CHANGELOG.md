# Changelog

## Segurança Set/2026 (parte 1: apps/api · parte 2: standalone · parte 3: scripts/front/deploy)
- Auth fail-closed (`JWT_SECRET`/`API_KEY` sem fallbacks públicos; recusa
  arranque em prod; timing-safe); portal isolado (tokens `cliente` fora do staff).
- Registo público só `comercial|financeiro|operacional`; removido backdoor dev;
  reset token fora dos logs; logout com flags de cookie.
- OTP anti-enumeração (resposta genérica, sem `devCode`, sem OTP para
  desconhecidos; comparação timing-safe). Testes atualizados ao novo contrato.
- Webhook É-kwanza verificado (`lib/ekwanza-callback.ts` + standalone):
  valida formato, nunca cria pagamentos, só muda estado com confirmação GPO,
  divergência de valor e falta de confirmação ficam `pendente` + metadata.
- Standalone: `/db-*` removido (410); `/terminal/unlock`, streams, `ovg-status`,
  `sync-status`, proxy `solve-access` e ingestão (`sync`, `ovg-sync`, `edge/*`)
  com auth (`X-API-Key` nas máquinas do ginásio); headers mínimos; rate-limit
  em memória; `express.json` 100kb; webhook Cademi validado; logs OVG
  sem despejos; unlock `502 ok:false` em falha.
- Scripts `packages/db/*` + `apps/api/fix-password.mjs` sem segredos (tudo via
  env, bcrypt, abortam sem env); `apps/api/src/standalone.ts` morto apagado.
- Frontend sem chaves (`App.tsx`, `use-api.ts`, `pay-widget.js`, `dev.ps1`);
  Supabase `push-lead-to-crm` fail-closed; `Dockerfile` com `USER node` +
  `npm ci --omit=dev`.
- Docs: `docs/tecnica/10-SEGURANCA.md` (auditoria, máquinas do ginásio, rotação,
  riscos residuais). Verificação: typecheck `apps/api` 0 erros; `apps/web`
  16 erros pré-existentes (eram 17); testes API com 48 falhas pré-existentes
  de mocks neste ambiente (iguais antes/depois) + 1 teste novo de segurança.

## Limpeza entrega Set/2026 (não publicado)
- Removidos scripts de diagnóstico com segredos hardcoded (`check-data.cjs`,
  `check-today.cjs`, `check-ghosts.py`, `check-neon.py`, `packages/db/check-data.cjs`),
  `temp-install.json`, `apps/mockup-sandbox/`, ficheiros Replit
  (`replit.md`, `.replit`, `.replitignore`, `.replit-artifact/`),
  pastas vazias `artifacts/`, `.agents/skills/`.
- `.gitignore` passa a ignorar `.replit-artifact/`.
- Docs reescritos para entrega: `README.md`, `ENTREGA-SAMORAFIT.md`,
  `docs/cliente/00–04` em português simples de Angola.
- Entrega exclui sempre: `node_modules/`, `dist/`, `*.tsbuildinfo`, `.env*` com valores.

## Quota Neon Set/2026 (não publicado)
- Causa do login cair: projeto `academia` excedeu transferência (5.99/5GB) → Neon bloqueia.
- Corte de consumo: frontend dashboards/listas 30s→5min, pagamentos 20–30s→2min,
  catraca crítica 1min, `refetchOnWindowFocus/Reconnect: false`; OVG 2min→30min;
  auto-sync É-kwanza standalone 60s→5min; SSE 3–5s→10–15s (só com clientes).
- Typecheck: `apps/api` passa; `apps/web` mantém 17 erros pré-existentes.
- Desbloqueio exige upgrade do plano Neon ou reset do ciclo (ação no dashboard).

## Reorg Set/2026 (não publicado)
- `artifacts/*` → `apps/*`, `lib/*` → `packages/*` (histórico preservado com `git mv`).
- `render.yaml` sem segredos (tudo `sync: false`); `.gitignore` saneado; `.env.example` criado.
- `Dockerfile` com `ARG VITE_API_URL`; `.dockerignore` com `.env*`.
- `iniciar-crm.cmd` / `iniciar-tunnel.cmd` portáteis (path relativo + `cloudflared` no PATH).
- Docs: `docs/tecnica/*` + `docs/cliente/*` + `ARQUITETURA.md` + `RUNBOOK.md` + `README.md` + `ENTREGA-SAMORAFIT.md`.
- Segurança pendente: rodar `OVG_PASSWORD` / `EKWANZA_SECRET` / `JWT_SECRET` expostos; fechar `db-*`/sync/unlock sem auth; remover fallbacks hardcoded.

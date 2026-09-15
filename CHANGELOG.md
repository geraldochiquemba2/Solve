# Changelog

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

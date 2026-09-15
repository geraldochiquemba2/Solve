# Solve Corporate CRM (SamoraFit)

Sistema de gestão da SamoraFit (Luanda): sócios, catraca, cobranças
Multicaixa Express/Referência via É-kwanza, cursos Cademi e portal do cliente.

- Admin: https://solve-sqoh.onrender.com/admin
- Portal: https://solve-sqoh.onrender.com/conta
- Saúde: https://solve-sqoh.onrender.com/healthz

## Estrutura

```
apps/web/       frontend (/admin + /conta)
apps/api/       backend fonte (TypeScript)
packages/db/    base de dados Drizzle (Neon Postgres)
standalone-server/  backend de deploy (Render/Docker)
docs/cliente/   manuais simples para o ginásio
docs/tecnica/   arquitetura, deploy, BD, runbook
```

Ver `docs/tecnica/ARQUITETURA.md` (fonte da verdade) e `docs/cliente/00-BEM-VINDO.md`.

## Dev rápido

Pré-requisitos: Node 20, pnpm 9+.

```sh
cp .env.example .env
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm --filter @workspace/api-server run dev   # :3000 (legado: apps/api)
```

Frontend: `pnpm --filter @workspace/solve-crm run dev` → `localhost:5173`
com `VITE_API_URL=http://localhost:3000`, `PORT=5173 BASE_PATH=/`.

## Deploy

`git push main` → Render `solve-crm-api` (Docker, ~5–10 min) → hard refresh.
Segredos só no dashboard Render (`render.yaml` usa `sync: false`).
Nunca commitar `.env*`. Rodar `OVG_PASSWORD` exposta antes de Set/2026.

Detalhes: `docs/tecnica/06-DEPLOY-OPERACAO.md` + `RUNBOOK.md`.
Entrega: `ENTREGA-SAMORAFIT.md`.

# Arquitetura (fonte da verdade)

## Estrutura (pós-reorg Set/2026)

```
apps/web/       frontend React+Vite — /admin (staff) + /conta (portal cliente)
apps/api/       backend TypeScript Express — FONTE do backend
apps/mockup-sandbox/  protótipos, sem deploy
packages/db/    Drizzle schema + drizzle/ (Postgres Neon)
packages/api-spec/  OpenAPI spec (orval)
packages/api-zod/   schemas Zod gerados
packages/api-client-react/  hooks React gerados
standalone-server/  backend JS que VAI para o Docker/Render (cópia de deploy)
scripts/        ops (push-schema, seeds)
docs/tecnica/   docs técnicos (estes ficheiros)
docs/cliente/   manuais SamoraFit em linguagem simples
```

## Dualidade backend (decisão registada)

- **Fonte:** `apps/api/src/` (TypeScript, com testes vitest).
- **Deploy atual:** `standalone-server/index.js` (JS monolito ~2600 linhas, o que o `Dockerfile` copia).
- **Regra:** corrigir primeiro em `apps/api`, depois portar para `standalone-server/`.
  Eliminar `standalone-server/` manual quando o build passar a compilar `apps/api/dist`.
- Ficheiro morto: `apps/api/src/standalone.ts` (duplica `routes/access.ts`, não usar).

## Frontend

- App principal: `apps/web/src/App.tsx` (monolito ~1600 linhas — partir em `src/admin/*` quando possível).
- Portal cliente: `apps/web/src/portal/` (`portal_token` separado de `token` staff).
- Gerado: `packages/api-client-react` (usar em vez de `fetch` direto + `localStorage.getItem('token')`).

## Integrações

- É-kwanza/Pay4All → `apps/api/src/lib/ekwanza.ts` + `routes/payments-ekwanza.ts` (standalone tem `fireEkwanzaCharge`, mais completo).
- Cademi → `apps/api/src/lib/cademi.ts` (throttle 550ms + paginação no standalone).
- OVG → `apps/api/src/lib/ovg*.ts` (sync 2min, desligado em development).
- ZKTeco → sem driver; `POST /terminal/unlock` via `http://192.168.1.182:8080` (PC ginásio).
- WhatsApp → inativo (`docs/tecnica/08-WHATSAPP.md`).

## Jobs

Expiração 5min, auto-sync É-kwanza 60s (só standalone), keep-alive 10min (só standalone),
SSE acessos 3–5s, OVG 2min. Centralizar quando unificar backends.

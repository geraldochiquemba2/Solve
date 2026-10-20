# Deploy: Render (servidor) + Supabase (base de dados)

Arquitetura actual depois do incidente Neon/Render. Sem custos.

```
Landing Fit90 ──► Supabase A (fslrkrhuatzfqxbzilnd)   [fit90_leads + edge function]
                        │ push-lead-to-crm
                        ▼
Cademi widget ──► Render (standalone-server, Node) ──► Supabase B (CRM)
CRM admin ──────►        (serve UI + API)                [users, payments, ...]
                          pooler:6543
```

- **Supabase A** = landing Fit90 (tabela `fit90_leads` + edge `push-lead-to-crm`).
- **Supabase B** = BD do CRM (projeto próprio: limite de quota separado).
- **Render** = servidor Node (UI + API). Conecta à BD B pelo **pooler** (6543).

## Porque assim (e não Neon/Render puros)

- A BD saiu do Neon (compute limitado → quota esgotada, erro `53000`).
- A BD do CRM tem projeto Supabase dedicado → quotas separadas da landing.
- Polling reduzido ~80% (webhook-first) para poupar compute:
  `EXPIRY=30m`, `AUTOSYNC=15m`, `CADEMI_RETRY=10m`, `FIT90_SYNC=15m`.

## Variáveis na Render (Environment, segredos com `sync: false`)

| Variável | Valor |
|---|---|
| `DATABASE_URL` | `postgresql://postgres.<ref>:<senha>@aws-0-<reg>.pooler.supabase.com:6543/postgres` |
| `CRM_DATABASE_URL` | (mesma URL; o standalone lê esta primeiro) |
| `DB_SSL_REJECT_UNAUTHORIZED` | `false` (pooler usa cert self-signed) |
| `JWT_SECRET`, `API_KEY` | segredos próprios |
| `SUPABASE_URL` | `https://fslrkrhuatzfqxbzilnd.supabase.co` (landing A, para o sync Fit90) |
| `SUPABASE_SERVICE_KEY` | service key da landing A |
| `OVG_*`, `EKWANZA_*`, `WIPAY_*`, `CADEMI_*` | conforme `render.yaml` |

> **Pooler, não directo:** usar a porta **6543** (transaction mode). A porta 5432
> esgota conexões e não tem IPv4 em redes sem IPv6.

## Preparar a BD B (uma vez)

```bash
# 1. Schema completo
DATABASE_URL="postgresql://postgres.<ref>:<senha>@aws-0-<reg>.pooler.supabase.com:6543/postgres" \
  DB_SSL_REJECT_UNAUTHORIZED=false node scripts/bootstrap-db.mjs

# 2. Admin + integrações
CRM_DATABASE_URL="<mesma URL>" DB_SSL_REJECT_UNAUTHORIZED=false \
  ADMIN_EMAIL="admin" ADMIN_PHONE="+244..." ADMIN_PASSWORD="<forte>" \
  node packages/db/seed-cademi-db.cjs

# 3. Leads Fit90 (do Supabase A para o CRM)
SUPABASE_URL=https://fslrkrhuatzfqxbzilnd.supabase.co SUPABASE_SERVICE_KEY=... \
  CRM_API_URL=https://<crm>.onrender.com CRM_API_KEY=<API_KEY> \
  node scripts/import-leads.mjs
```

## Repontar integrações após o deploy

1. **Supabase A** (edge `push-lead-to-crm`):
   ```bash
   supabase secrets set CRM_API_URL=https://<crm>.onrender.com CRM_API_KEY=<API_KEY> --project-ref fslrkrhuatzfqxbzilnd
   supabase functions deploy push-lead-to-crm --project-ref fslrkrhuatzfqxbzilnd
   ```
2. **Cademi**: `<script src="https://<crm>.onrender.com/pay-widget.js">`.
3. **Webhook fit90** no Supabase A → `https://<crm>.onrender.com/api/v1/leads/fit90-hook`.
4. **Suspender** o serviço Render antigo (evita jobs/webhooks duplicados).

## Nunca repetir o incidente

1. **Não deixar a BD 7 dias sem atividade** — o Supabase free pausa o projeto.
   Os jobs + um monitor externo (UptimeRobot) a cada 5 min evitam-no.
2. **Webhook > polling.** O É-kwanza/WiPay já confirmam em tempo real; o polling
   é só rede de segurança.
3. **Segredos fora do git.** `.env*` ignorado; `.env.example` só com chaves.
4. **Backup regular** — `scripts/backup-neon.mjs` serve de base (adaptar URL);
   o Supabase free não tem backups descarregáveis.

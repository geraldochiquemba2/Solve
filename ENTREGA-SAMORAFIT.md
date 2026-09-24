# Entrega SamoraFit — ata oficial

Versão: limpeza e organização Set/2026 (branch `main`).
Ponto de restauro: tag `backup-pre-reorg` (antes da reorg).
URLs: https://solve-sqoh.onrender.com/admin • /conta • /healthz.

## 1. O que foi entregue

- **CRM admin** (`/admin`): dashboard, pipeline/leads, clientes/sócios, pagamentos,
  academia Cademi, acesso físico (catraca), integrações/definições.
- **Portal do cliente** (`/conta`): login por telefone, ver plano, pagar,
  gerar referência Multicaixa.
- **API** (`/api/v1` + `/healthz`): fonte em `apps/api/`, deploy em `standalone-server/`.
- **Widget** `pay-widget.js`: botão de pagamento para embutir na Cademi/landing.
- **Integrações**: É-kwanza (Multicaixa Express + Referência, conta **06100363**),
  Cademi (libertação automática de cursos), OVG (sócios do ginásio),
  catraca ZKTeco via PC do ginásio (`http://192.168.1.182:8080`), funil Fit90
  (Supabase `fit90_leads` → `POST /api/v1/leads`).
- **Documentos**: `docs/cliente/00–04` (ginásio), `docs/tecnica/00–09 + ARQUITETURA + RUNBOOK`
  (técnico), este ficheiro (ata), `README.md` (índice), `CHANGELOG.md` (histórico).

## 2. O que foi removido antes de entregar (Set/2026)

Para a entrega ir limpa e sem segredos:

- Scripts de diagnóstico com password da BD escrita dentro:
  `check-data.cjs`, `check-today.cjs`, `check-ghosts.py`, `check-neon.py`,
  `packages/db/check-data.cjs`. Eram só para despistar erros, não fazem parte do sistema.
- `temp-install.json` (lista temporária de instalação).
- `apps/mockup-sandbox/` (protótipos de ecrãs, nunca foi para o ar).
- Ficheiros Replit (`replit.md`, `.replit`, `.replitignore`, `.replit-artifact/`)
  — o deploy real é Render/Docker, não Replit.
- Pastas vazias `artifacts/`, `.agents/skills/`.

O que **nunca** segue no zip/entrega: `node_modules/`, `dist/`, `*.tsbuildinfo`,
`.env` / `apps/*/​.env*` com valores. Só segue `.env.example` (mapa sem valores).

## 3. Contas que o cliente passa a ser dono

| Conta | Para quê | Transferir |
|---|---|---|
| Render `solve-crm-api` | Site + API no ar | Email empresa + MFA + dono do serviço |
| Neon Postgres (`academia` + CRM) | Base de dados | Email empresa + MFA |
| GitHub `geraldochiquemba2/Solve` | Código | Adicionar dono SamoraFit como owner |
| Cademi (`brunosamora`) | Cursos | Email empresa + MFA |
| É-kwanza (conta 06100363) | Cobranças | Titular + extrato + callback |
| OVG SamoraFit (`LUA`) | Sócios ginásio | Utilizador `solvecorporate@partners...` + nova password |
| Supabase `fslrkrhuatzfqxbzilnd` | Funil Fit90 | Email empresa + anon key na landing |
| PC ginásio + ZKTeco | Catraca | IP, utilizador, TeamViewer/anydesk |

Cada conta com email da empresa, recuperação e MFA. **Rodar** (trocar) antes de
assinar: `OVG_PASSWORD`, `EKWANZA_CLIENT_SECRET`, `JWT_SECRET`, `API_KEY` —
circularam em ficheiros antes de Set/2026.

## 4. Custos recorrentes (registar antes de assinar)

- Render: Free hiberna (~1 min no 1.º acesso). Recomendado **Starter pago** para não hibernar.
- Neon: projeto `academia` já bateu 5.99/5GB em Set/2026 e bloqueou. Ver plano/quota.
- Domínios + emails empresa.
- Valores e quem paga: ______ / mês. Responsável: ______.

## 5. Fora do âmbito

- WhatsApp inativo (código parcial, ver `docs/tecnica/08-WHATSAPP.md`). Ativar exige
  conta Meta Business + número + aprovação de templates (orçamento à parte).
- App nativa iOS/Android (só web). Hardware da catraca (só integração).

## 6. Teste de receção (UAT) — fazer junto

1. Criar sócio em `/admin` → Clientes → Novo. OK [ ]
2. Criar cobrança Multicaixa Express e aprovar no telefone. OK [ ]
3. Estado fica **confirmado** sozinho (~1 min). OK [ ]
4. Curso liberta sozinho na Cademi. OK [ ]
5. Recibo/extrato confere na É-kwanza. OK [ ]
6. Entrada aparece em Acesso físico. OK [ ]
7. Portal `/conta` entra com telefone e mostra plano. OK [ ]

## 7. Assinatura

Data: ___/___/___

Responsável SamoraFit: _______________ Ass.: _______

Técnico: _______________ Ass.: _______

> Ao assinar, o cliente confirma que recebeu código + docs, tem acesso a todas
> as contas acima, fez o UAT com OK e aceita custos e limites (hibernação Free,
> quota Neon, WhatsApp fora de âmbito).

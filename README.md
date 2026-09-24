# Solve Corporate CRM — SamoraFit (Luanda)

Sistema de gestão do ginásio SamoraFit: sócios, mensalidades, cobranças
Multicaixa Express / Referência (É-kwanza), cursos Cademi, catraca e portal do cliente.

- **Admin (equipa):** https://solve-sqoh.onrender.com/admin
- **Portal (cliente):** https://solve-sqoh.onrender.com/conta
- **Saúde (ver se está vivo):** https://solve-sqoh.onrender.com/healthz

> Conta comerciante É-kwanza: **06100363**. Plano Render Free adormece após
> ~15 min sem uso — o primeiro acesso do dia demora ~1 min. É normal.

## O que vem nesta entrega

| Pasta | O que é | Mexe quem? |
|---|---|---|
| `apps/web/` | Site: `/admin` (equipa) + `/conta` (cliente) | Programador |
| `apps/api/` | Motor (API) — fonte em TypeScript | Programador |
| `standalone-server/` | Motor que está no ar (Render/Docker): `index.js` + `public/pay-widget.js` | Programador |
| `packages/db/` | Base de dados (tabelas + migrações + seeds) | Programador |
| `packages/api-spec/`, `api-zod/`, `api-client-react/` | Contrato da API (gerado, não editar à mão) | Automático |
| `scripts/` | Tarefas de operação (`push-schema`, seeds) | Técnico |
| `supabase/` | Funil Fit90: tabela `fit90_leads` + função `push-lead-to-crm` | Técnico |
| `docs/cliente/` | **Manuais simples para o ginásio (começar aqui)** | Todos |
| `docs/tecnica/` | Manual técnico (arquitetura, deploy, BD, runbook) | Técnico |
| `Dockerfile`, `render.yaml` | Como o sistema vai para o ar | Técnico |
| `.env.example` | Lista de chaves sem valores (copiar para `.env`) | Técnico |
| `iniciar-crm.cmd`, `sincronizar-ovg.cmd` | Atalhos Windows para correr local / sincronizar OVG | Técnico |
| `ENTREGA-SAMORAFIT.md` | **Ata de entrega: o que foi entregue, contas, custos, assinatura** | Todos |
| `CHANGELOG.md` | Histórico de mudanças | Técnico |

O que **não** vai para o cliente: `node_modules/`, `dist/`, `*.tsbuildinfo`,
`.env` com valores, ficheiros de diagnóstico temporários (removidos em Set/2026).

## Começar em 5 minutos (ginásio)

1. Abrir `docs/cliente/00-BEM-VINDO.md` — visão geral sem palavras técnicas.
2. Cobrar: `docs/cliente/01-CAIXA-E-PAGAMENTOS.md`.
3. Sócios e catraca: `docs/cliente/02-SOCIOS-E-ACESSOS.md`.
4. Cursos: `docs/cliente/03-CURSOS-CADEMI.md`.
5. Quando algo falha: `docs/cliente/04-O-QUE-FAZER-QUANDO.md`.

Teste de receção (UAT): criar sócio → cobrar Multicaixa → confirmar →
curso liberta na Cademi → ver entrada na catraca. Assinar em `ENTREGA-SAMORAFIT.md`.

## Correr local (técnico)

Pré-requisitos: Node 20, pnpm 9+.

```sh
cp .env.example .env        # preencher DATABASE_URL, JWT_SECRET, etc.
pnpm install
pnpm run typecheck
pnpm --filter @workspace/api-server run dev   # API em :3000
```

Noutra janela:

```sh
# apps/web/.env → VITE_API_URL=http://localhost:3000
pnpm --filter @workspace/solve-crm run dev    # site em localhost:5173
```

Windows: `iniciar-crm.cmd` arranca API + túnel Cloudflare (precisa `cloudflared` no PATH).

## Ir para o ar (deploy)

`git push main` → Render `solve-crm-api` (Docker, ~5–10 min) → hard refresh
(Ctrl+Shift+R). Segredos só no dashboard do Render (`render.yaml` usa `sync: false`).
**Nunca** commitar `.env`. Detalhes em `docs/tecnica/06-DEPLOY-OPERACAO.md`.

## Regras de segurança

- `.env` nunca entra no git nem no zip de entrega — só `.env.example`.
- Rodar no dashboard (Render/Neon/OVG/É-kwanza) qualquer palavra-passe que já circulou por ficheiros ou chat antes de Set/2026.
- 1 cobrança pendente por aluno de cada vez; nunca cobrar duas vezes sem ver o extrato É-kwanza.
- WhatsApp está **fora de âmbito** (ver `docs/tecnica/08-WHATSAPP.md`).

Fonte da verdade técnica: `docs/tecnica/ARQUITETURA.md`.

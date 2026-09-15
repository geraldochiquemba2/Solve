# Solve Corporate CRM — Visão Geral (cliente final)

Sistema de gestão da **SamoraFit** (ginásio, Luanda): sócios, acessos da catraca,
cobranças **Multicaixa Express / Referência** via É-kwanza (Pay4All), cursos na
**Cademi** e portal do cliente.

## Peças do sistema

| Peça | Onde vive | URL |
|---|---|---|
| CRM admin (staff) | `solve-sqoh.onrender.com/admin` | https://solve-sqoh.onrender.com/admin |
| Portal do cliente | `solve-sqoh.onrender.com/conta` | https://solve-sqoh.onrender.com/conta |
| API + backend | `standalone-server/` (Render, Docker) | https://solve-sqoh.onrender.com |
| Widget pagar na Cademi | `standalone-server/public/pay-widget.js` | https://solve-sqoh.onrender.com/pay-widget.js |
| Base de dados | Neon Postgres (nuvem) | — |
| Academia/cursos | Cademi `brunosamora.cademi.com.br` | painel próprio |
| Sócios/origem | OnVirtualGym (OVG) + catraca ZKTeco (PC do ginásio) | — |

## Papéis

- **Administrador/Gestor/Financeiro/Comercial/Operacional** — CRM admin (permissões em
  `Admin → Utilizadores`).
- **Cliente/aluno** — portal `/conta` (login por OTP via telefone) e área Cademi.
- **Sistema** — jobs automáticos: sync É-kwanza 60s, expiração 5min, anti-hibernação 10min.

## Fluxo de dinheiro (resumo)

1. Cobrança criada (CRM, portal ou widget) → estado **pendente** (resposta < 1s).
2. Cliente aprova no Multicaixa / paga referência → É-kwanza confirma.
3. Servidor deteta (webhook ou sync 60s) → **confirmado** → liberta curso na Cademi sozinho.
4. Conta comerciante de destino: **06100363** (É-kwanza/Pay4All).

## Documentos

- `01-CRM-ADMIN.md` — manual do painel staff, página a página.
- `02-PAGAMENTOS.md` — estados, regras, erros, reconciliação.
- `03-ACADEMIA-CADEMI.md` — cursos, entregas, acesso automático, widget.
- `04-PORTAL-CLIENTE.md` — conta, pagar, recibos.
- `05-ACESSO-FISICO.md` — catraca, Solve Access, PC do ginásio.
- `06-DEPLOY-OPERACAO.md` — deploy, variáveis, jobs, problemas comuns.
- `07-BASE-DADOS.md` — tabelas, estados, queries úteis.
- `08-WHATSAPP.md` — estado atual e o que falta.

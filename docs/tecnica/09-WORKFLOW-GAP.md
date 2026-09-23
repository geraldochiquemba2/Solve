# Workflow SamoraFit × Projeto — análise de aderência e gaps

Data: 23/09/2026. Documentos analisados (pasta `test1`, fora do repo):
- `Workflow SamoraFit Studio 24-04-2026.pdf` — workflow operacional do ginásio
  (tarefas comerciais, avaliações, agenda, automatismos, régua de cobrança).
- `Arquitetura_Workflow_SamoraFit.docx` — arquitetura ideal em 10 grupos
  (WF-01 Lead … WF-10 Reporting) + motor de regras Evento→Condição→Ação.

Verificação feita no código (somente leitura). Legenda: ✅ existe · ⚠️ parcial ·
❌ em falta. Fase atual do projeto: **Cademi-CRM** (cursos online; módulo
ginásio desligado) e produção = `standalone-server/` (JS).

## O que condiz ✅

| Workflow | Cobertura no projeto |
|---|---|
| WF-03 Pagamento (Pay4All) | Cobranças É-kwanza Express/Referência, webhook `operationStatus` 1/3/4/5, auto-sync, estados `pendente→confirmado/rejeitado/expirado`, recibos no portal, entrega Cademi (`standalone-server/index.js`, `apps/api/src/lib/ekwanza.ts`) |
| Jornada Lead→Cliente→Plano→Pagamento | `leads` (pipeline), `customers`, `plans`/`subscriptions`, `payments` (`packages/db/src/schema/index.ts`) |
| WF-05 Check-in (dados) | `checkins`, `solve_access_logs`, SSE (`apps/api/src/routes/checkins.ts`, `access.ts`) |
| WF-04 Acesso (parcial) | Unlock remoto ZKTeco via PC do ginásio (`192.168.1.182:8080`); sem driver nativo (`docs/tecnica/05-ACESSO-FISICO.md`, `ARQUITETURA.md:38`) |
| WF-10 Reporting (base) | `audit_logs`, webhooks genéricos com retry, export CSV auditoria (`apps/web/src/App.tsx:1384`) |

## O que falta ❌ / parcial ⚠️

### 1. Motor de Automações desligado e com defeito (gap mais grave)
- Triggers do ecrã (`pagamento.confirmado`, `acesso.negado`, … em
  `apps/web/src/App.tsx` ~1269–1298) **não casam** com os 5 do backend
  (`payment_confirmed`, `payment_overdue`, `lead_created`, `lead_no_activity`,
  `ovg_lead_qualified` em `apps/api/src/lib/automation-engine.ts:13-18` e
  `routes/automations.ts:15-21`) — regra criada na UI nunca dispara.
- `processEvent` é órfão: nada o chama (só `POST /automations/trigger` manual);
  rotas de payments/leads/ovg/access/checkins nunca o importam.
- Ações: só `update_customer_state` executa de verdade; `create_task` (sem
  tabela `tasks`), `send_notification` (só log, sem canal) e `sync_to_*` (não
  chamam as APIs) são fachada (`automation-engine.ts:115-242`).
- Sem scheduler (nada corre em datas), sem condições/encadeamento
  (Evento→Condição→Ação→Próximo WF do docx não existe).
- Produção (`standalone-server/index.js:2205-2264`) só tem CRUD de automações.

### 2. Operação do ginásio (PDF OVG)
- ❌ Agenda (visitas, avaliações físicas, treinos assistidos, sessões PT) —
  sem tabelas nem rotas (só marketing em `landing/sections/Agenda.tsx`).
- ❌ Tarefas comerciais com questionários (1ºCL/VE/2ºCL/FL/CS8/CS/CA7/CA22/CA45)
  e filtro "Tarefas Receção" — sem tabela `tasks`.
- ❌ Avaliações físicas / anamnese / planos de treino e alimentar com validade
  e alertas 7 dias antes.
- ❌ Deteção de ausência 7/22/45 dias sem catraca (o dado existe, a regra não;
  sem thresholds em lado nenhum).
- ❌ Régua dia 27/4/5 e transições automáticas ativo→pendente→bloqueio
  (estados existem; scheduler e notificação não; bloqueio é manual).
- ❌ Aniversários e NPS automáticos (`birthDate` existe sem consumidor).

### 3. Canal de notificações
- ⚠️ WhatsApp **inativo** (`docs/tecnica/08-WHATSAPP.md`, `ARQUITETURA.md:39`):
  código parcial só em `apps/api` (não vai a produção); sem token, sem tabela
  `whatsapp_messages`, sem template aprovado. Quase todas as mensagens dos
  docs dependem dele.

### 4. BI
- ⚠️ Sem exportador dedicado (só webhooks genéricos + CSV de auditoria).

## Notas
- O PDF descreve o motor de Workflow **dentro do próprio OVG** — parte desse
  workflow vive no OVG, não no nosso CRM. O projeto espelha dados OVG mas não
  replica o motor de tarefas.
- Desalinhamento estratégico: docs descrevem o estúdio físico; o projeto está
  em fase Cademi-CRM (cursos). Decidir: replicar a operação do ginásio no CRM
  ou manter CRM em pagamentos/cursos e tarefas/agenda no OVG.

## Roadmap sugerido
1. Ligar triggers reais + canal WhatsApp (ou email/SMS) — sem isto nenhum
   workflow automático funciona.
2. Tabela `tasks` + questionários + scheduler datado (27/4/5, ausências 7/22/45,
   aniversários, NPS).
3. Agenda (visitas, avaliações, PT) + avaliações/planos com validades e alertas.
4. Exportador de eventos para Power BI.

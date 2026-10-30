# Anexo — Classificação do Inventário Versionado

**Data:** 2026-10-30  
**Fonte:** `git ls-files` na raiz `Solve/`; 346 caminhos versionados nesta verificação.  
**Relação:** anexo de `REPOSITORY_CLEANUP_REPORT.md`.

## Como interpretar

A classe indicada é a **categoria predominante**, não uma autorização de remoção. A inclusão nesta lista confirma que o caminho foi enumerado; não significa leitura integral ou verificação de todas as referências dinâmicas. Para código, assets, manifests, migrations e scripts, a classe é provisória por função/extensão e pelo papel do diretório. A remoção só pode ser considerada depois da análise de referências, runtime, build, operação, testes e documentação prevista no relatório principal.

| Código | Categoria | Regra aplicada |
|---|---|---|
| A | Essencial | Runtime, configuração, build/deploy, integração, schema ou artefacto exigido pelo fluxo/produto. |
| B | Desenvolvimento/manutenção | Testes, geração, scripts de manutenção, configs de desenvolvimento ou ferramentas do workspace. |
| C | Documentação | Guias de produto, operação, suporte, entrega e histórico. |
| D | Opcional | Candidato sem uso direto observado; manter até prova completa e decisão. |
| E | Obsoleto | Nenhum ficheiro foi confirmado nesta categoria nesta inspeção. |
| F | Temporário | Artefacto local de ferramenta; proposta de remoção ainda não executada. |
| G | Sensível | Contém ou pode conter configuração privada, credencial ou informação específica do cliente. Marca adicional (`A/G`, `B/G` ou `C/G`) quando a categoria predominante também se aplica. |

## Contagem por categoria predominante

| Categoria | Ficheiros | Observação |
|---|---:|---|
| A — Essencial | 134 | Classificação provisória por função/caminho; nem todos foram lidos linha a linha. |
| B — Desenvolvimento/manutenção | 183 | Inclui uma configuração de ambiente marcada adicionalmente B/G. |
| C — Documentação | 26 | Inclui dois documentos marcados adicionalmente C/G. |
| D — Opcional | 0 | A dependência candidata `react-router-dom` não é ficheiro versionado e está fora do total. |
| E — Obsoleto | 0 | Nenhuma obsolescência foi comprovada para um ficheiro. |
| F — Temporário | 3 | Candidatos locais de ferramenta; não removidos. |
| **Total de caminhos versionados** | **346** | `git ls-files`; uma única categoria predominante por caminho. |

As marcas `/G` são adicionais e não aumentam o total. A classificação por caminho é preliminar; a confirmação semântica, de uso dinâmico e de runtime continua pendente.

## A — Essencial (provisório por caminho)

Estes ficheiros participam de execução, build, deploy, dados ou configuração do produto. “Essencial” não significa que cada função interna tenha sido verificada linha a linha.

- `.dockerignore`
- `.env.example` (exemplo de configuração; não incluir valores secretos)
- `.gitignore`
- `Dockerfile`
- `render.yaml`
- `apps/api/package.json`
- `apps/api/src/app.ts`
- `apps/api/src/index.ts`
- `apps/api/src/lib/automation-engine.ts`
- `apps/api/src/lib/cademi-delivery.ts`
- `apps/api/src/lib/cademi.ts`
- `apps/api/src/lib/cors.ts`
- `apps/api/src/lib/ekwanza-callback.ts`
- `apps/api/src/lib/ekwanza.ts`
- `apps/api/src/lib/logger.ts`
- `apps/api/src/lib/portal-otp.ts`
- `apps/api/src/lib/promo.ts`
- `apps/api/src/lib/webhook-delivery.ts`
- `apps/api/src/lib/whatsapp.ts`
- `apps/api/src/middlewares/auth.ts`
- `apps/api/src/middlewares/error.ts`
- `apps/api/src/middlewares/portal-auth.ts`
- `apps/api/src/middlewares/rate-limit.ts`
- `apps/api/src/middlewares/validate.ts`
- `apps/api/src/routes/api-keys.ts`
- `apps/api/src/routes/audit-logs.ts`
- `apps/api/src/routes/auth.ts`
- `apps/api/src/routes/automations.ts`
- `apps/api/src/routes/cademi.ts`
- `apps/api/src/routes/checkins.ts`
- `apps/api/src/routes/customers.ts`
- `apps/api/src/routes/dashboard.ts`
- `apps/api/src/routes/health.ts`
- `apps/api/src/routes/index.ts`
- `apps/api/src/routes/integrations.ts`
- `apps/api/src/routes/leads.ts`
- `apps/api/src/routes/notifications.ts`
- `apps/api/src/routes/payments-ekwanza.ts`
- `apps/api/src/routes/payments.ts`
- `apps/api/src/routes/plans.ts`
- `apps/api/src/routes/portal-auth.ts`
- `apps/api/src/routes/portal.ts`
- `apps/api/src/routes/promos.ts`
- `apps/api/src/routes/settings.ts`
- `apps/api/src/routes/users.ts`
- `apps/api/src/routes/webhooks.ts`
- `apps/api/src/routes/whatsapp.ts`
- `apps/web/index.html`
- `apps/web/package.json`
- `apps/web/public/favicon.svg`
- `apps/web/public/robots.txt`
- `apps/web/public/samorafit-logo-dark.png`
- `apps/web/public/samorafit-logo.png`
- `apps/web/public/solve-corporate-logo.png`
- `apps/web/src/App.tsx`
- `apps/web/src/components/error-boundary.tsx`
- `apps/web/src/components/ui/toast.tsx`
- `apps/web/src/components/ui/toaster.tsx`
- `apps/web/src/components/ui/tooltip.tsx`
- `apps/web/src/hooks/use-api.ts`
- `apps/web/src/hooks/use-auth.ts`
- `apps/web/src/hooks/use-notifications.ts`
- `apps/web/src/hooks/use-toast.ts`
- `apps/web/src/index.css`
- `apps/web/src/landing/FitStudio.tsx`
- `apps/web/src/landing/LandingLayout.tsx`
- `apps/web/src/landing/Login.tsx`
- `apps/web/src/landing/context/AuthContext.tsx`
- `apps/web/src/landing/context/CMSContext.tsx`
- `apps/web/src/landing/context/CartContext.tsx`
- `apps/web/src/landing/context/OrderContext.tsx`
- `apps/web/src/landing/context/ThemeContext.tsx`
- `apps/web/src/landing/hooks/useScrollProgress.ts`
- `apps/web/src/landing/layout/Footer.tsx`
- `apps/web/src/landing/layout/Header.tsx`
- `apps/web/src/landing/legal/PoliticaCookies.tsx`
- `apps/web/src/landing/legal/PoliticaPrivacidade.tsx`
- `apps/web/src/landing/legal/TermosCondicoes.tsx`
- `apps/web/src/landing/sections/CTAFinal.tsx`
- `apps/web/src/landing/services/pay4all.ts` (runtime real, mas implementação observada é mock; ver achado no relatório de produção)
- `apps/web/src/landing/ui/BackToTopButton.tsx`
- `apps/web/src/landing/ui/CheckoutModal.tsx`
- `apps/web/src/landing/ui/ContactForm.tsx`
- `apps/web/src/landing/ui/CookieBanner.tsx`
- `apps/web/src/landing/ui/FormModal.tsx`
- `apps/web/src/landing/ui/LegalModal.tsx`
- `apps/web/src/landing/ui/ProgramCheckoutModal.tsx`
- `apps/web/src/landing/ui/ScrollToTop.tsx`
- `apps/web/src/landing/ui/ThemeToggle.tsx`
- `apps/web/src/lib/api.ts`
- `apps/web/src/lib/marca.ts`
- `apps/web/src/lib/random.ts`
- `apps/web/src/lib/relatorios.ts`
- `apps/web/src/lib/utils.ts`
- `apps/web/src/lib/xlsx.ts`
- `apps/web/src/main.tsx`
- `apps/web/src/portal/ContaLogin.tsx`
- `apps/web/src/portal/MinhaConta.tsx`
- `apps/web/src/portal/Pagamentos.tsx`
- `apps/web/src/portal/PortalShell.tsx`
- `apps/web/src/portal/Recibo.tsx`
- `apps/web/src/portal/api.ts`
- `packages/api-zod/src/generated/api.ts`
- `packages/api-zod/src/index.ts`
- `packages/api-client-react/src/custom-fetch.ts`
- `packages/api-client-react/src/generated/api.schemas.ts`
- `packages/api-client-react/src/generated/api.ts`
- `packages/api-client-react/src/index.ts`
- `packages/api-spec/openapi.yaml`
- `packages/db/drizzle.config.ts`
- `packages/db/drizzle/0000_empty_hydra.sql`
- `packages/db/drizzle/0001_bruno_samora.sql`
- `packages/db/drizzle/0002_lead_tracking.sql`
- `packages/db/drizzle/0003_user_login_count.sql`
- `packages/db/drizzle/0004_add_promo_codes.sql`
- `packages/db/drizzle/0005_promo_usages_user_key.sql`
- `packages/db/drizzle/0006_notifications.sql`
- `packages/db/drizzle/0007_drop_gym.sql` (migração destrutiva; não aplicar sem confirmação e backup)
- `packages/db/drizzle/0008_studio.sql`
- `packages/db/drizzle/meta/0000_snapshot.json`
- `packages/db/drizzle/meta/_journal.json`
- `packages/db/src/index.ts`
- `packages/db/src/schema/index.ts`
- `standalone-server/automation.js`
- `standalone-server/index.js`
- `standalone-server/package-lock.json` (necessário ao `npm ci` no Docker)
- `standalone-server/package.json`
- `standalone-server/portal.js`
- `standalone-server/public/pay-widget.js`
- `standalone-server/studio-integration.js`
- `standalone-server/whatsapp.js`
- `supabase/config.toml`
- `supabase/functions/push-lead-to-crm/index.ts`
- `supabase/migrations/0001_fit90_leads.sql`

## B — Necessário para desenvolvimento, testes ou manutenção (provisório por caminho)

Manter para reproduzir builds, testar, gerar contratos, operar ou manter o sistema. Scripts potencialmente destrutivos ou com ligação a BD exigem revisão operacional antes de qualquer execução.

- `.npmrc`
- `iniciar-crm.cmd`
- `iniciar-tunnel.cmd`
- `migrar-render-env.cmd`
- `supabase/.env.supabase.example` — **B/G**: template de configuração; verificar e manter valores secretos fora do versionamento.
- `apps/api/build.mjs`
- `apps/api/fix-password.mjs`
- `apps/api/src/__tests__/auth.test.ts`
- `apps/api/src/__tests__/customers.test.ts`
- `apps/api/src/__tests__/ekwanza.test.ts`
- `apps/api/src/__tests__/health.test.ts`
- `apps/api/src/__tests__/payments.test.ts`
- `apps/api/src/__tests__/plans.test.ts`
- `apps/api/src/__tests__/portal.test.ts`
- `apps/api/src/__tests__/promos.test.ts`
- `apps/api/src/__tests__/security-regression.test.ts`
- `apps/api/src/__tests__/setup.ts`
- `apps/api/tsconfig.json`
- `apps/api/vitest.config.ts`
- `apps/web/components.json`
- `apps/web/dev.ps1`
- `apps/web/tsconfig.json`
- `apps/web/vite.config.ts`
- `packages/api-zod/src/generated/types/access.ts`
- `packages/api-zod/src/generated/types/accessInput.ts`
- `packages/api-zod/src/generated/types/apiKey.ts`
- `packages/api-zod/src/generated/types/apiKeyInput.ts`
- `packages/api-zod/src/generated/types/checkin.ts`
- `packages/api-zod/src/generated/types/checkinInput.ts`
- `packages/api-zod/src/generated/types/createCustomer201.ts`
- `packages/api-zod/src/generated/types/createCustomerBody.ts`
- `packages/api-zod/src/generated/types/createCustomerBodyState.ts`
- `packages/api-zod/src/generated/types/createLead201.ts`
- `packages/api-zod/src/generated/types/createLeadBody.ts`
- `packages/api-zod/src/generated/types/createLeadBodyStatus.ts`
- `packages/api-zod/src/generated/types/createPayment201.ts`
- `packages/api-zod/src/generated/types/createPaymentBody.ts`
- `packages/api-zod/src/generated/types/createPlan201.ts`
- `packages/api-zod/src/generated/types/createPlanBody.ts`
- `packages/api-zod/src/generated/types/createPlanBodyPeriodicity.ts`
- `packages/api-zod/src/generated/types/createWebhook201.ts`
- `packages/api-zod/src/generated/types/createWebhookBody.ts`
- `packages/api-zod/src/generated/types/customer.ts`
- `packages/api-zod/src/generated/types/customerDetail.ts`
- `packages/api-zod/src/generated/types/customerState.ts`
- `packages/api-zod/src/generated/types/customerUpdate.ts`
- `packages/api-zod/src/generated/types/customerUpdateState.ts`
- `packages/api-zod/src/generated/types/dashboardCharts.ts`
- `packages/api-zod/src/generated/types/dashboardChartsLeadsBySourceItem.ts`
- `packages/api-zod/src/generated/types/dashboardChartsPaymentMethodsItem.ts`
- `packages/api-zod/src/generated/types/dashboardChartsRevenueByMonthItem.ts`
- `packages/api-zod/src/generated/types/dashboardStats.ts`
- `packages/api-zod/src/generated/types/dashboardStatsIntegrationsItem.ts`
- `packages/api-zod/src/generated/types/dashboardStatsLeadsByStatusItem.ts`
- `packages/api-zod/src/generated/types/dashboardStatsOverview.ts`
- `packages/api-zod/src/generated/types/getCustomer200.ts`
- `packages/api-zod/src/generated/types/getDashboardCharts200.ts`
- `packages/api-zod/src/generated/types/getDashboardStats200.ts`
- `packages/api-zod/src/generated/types/getIntegration200.ts`
- `packages/api-zod/src/generated/types/getLead200.ts`
- `packages/api-zod/src/generated/types/getLeadsFollowupsHoje200.ts`
- `packages/api-zod/src/generated/types/getLeadsResumo200.ts`
- `packages/api-zod/src/generated/types/getPayment200.ts`
- `packages/api-zod/src/generated/types/getPlan200.ts`
- `packages/api-zod/src/generated/types/getUser200.ts`
- `packages/api-zod/src/generated/types/healthCheck200.ts`
- `packages/api-zod/src/generated/types/index.ts`
- `packages/api-zod/src/generated/types/integration.ts`
- `packages/api-zod/src/generated/types/integrationConfig.ts`
- `packages/api-zod/src/generated/types/integrationStatus.ts`
- `packages/api-zod/src/generated/types/lead.ts`
- `packages/api-zod/src/generated/types/leadContact.ts`
- `packages/api-zod/src/generated/types/leadContactCanal.ts`
- `packages/api-zod/src/generated/types/leadContactInput.ts`
- `packages/api-zod/src/generated/types/leadContactInputCanal.ts`
- `packages/api-zod/src/generated/types/leadContactInputProximoPasso.ts`
- `packages/api-zod/src/generated/types/leadContactInputResultado.ts`
- `packages/api-zod/src/generated/types/leadContactResultado.ts`
- `packages/api-zod/src/generated/types/leadStatus.ts`
- `packages/api-zod/src/generated/types/leadUpdate.ts`
- `packages/api-zod/src/generated/types/leadUpdateStatus.ts`
- `packages/api-zod/src/generated/types/leadsResumo.ts`
- `packages/api-zod/src/generated/types/listAccess200.ts`
- `packages/api-zod/src/generated/types/listAccessParams.ts`
- `packages/api-zod/src/generated/types/listApiKeys200.ts`
- `packages/api-zod/src/generated/types/listCheckins200.ts`
- `packages/api-zod/src/generated/types/listCheckinsParams.ts`
- `packages/api-zod/src/generated/types/listCustomers200.ts`
- `packages/api-zod/src/generated/types/listIntegrations200.ts`
- `packages/api-zod/src/generated/types/listLeadContacts200.ts`
- `packages/api-zod/src/generated/types/listLeads200.ts`
- `packages/api-zod/src/generated/types/listLeadsParams.ts`
- `packages/api-zod/src/generated/types/listLeadsStatus.ts`
- `packages/api-zod/src/generated/types/listPayments200.ts`
- `packages/api-zod/src/generated/types/listPaymentsParams.ts`
- `packages/api-zod/src/generated/types/listPaymentsStatus.ts`
- `packages/api-zod/src/generated/types/listPlans200.ts`
- `packages/api-zod/src/generated/types/listUsers200.ts`
- `packages/api-zod/src/generated/types/listWebhookDeliveries200.ts`
- `packages/api-zod/src/generated/types/listWebhooks200.ts`
- `packages/api-zod/src/generated/types/login200.ts`
- `packages/api-zod/src/generated/types/loginBody.ts`
- `packages/api-zod/src/generated/types/payment.ts`
- `packages/api-zod/src/generated/types/paymentStatus.ts`
- `packages/api-zod/src/generated/types/plan.ts`
- `packages/api-zod/src/generated/types/planPeriodicity.ts`
- `packages/api-zod/src/generated/types/planUpdate.ts`
- `packages/api-zod/src/generated/types/planUpdatePeriodicity.ts`
- `packages/api-zod/src/generated/types/reconcilePayment200.ts`
- `packages/api-zod/src/generated/types/register201.ts`
- `packages/api-zod/src/generated/types/registerBody.ts`
- `packages/api-zod/src/generated/types/registerBodyRole.ts`
- `packages/api-zod/src/generated/types/reprocessDelivery200.ts`
- `packages/api-zod/src/generated/types/subscription.ts`
- `packages/api-zod/src/generated/types/syncIntegration200.ts`
- `packages/api-zod/src/generated/types/togglePlan200.ts`
- `packages/api-zod/src/generated/types/toggleUser200.ts`
- `packages/api-zod/src/generated/types/updateCustomer200.ts`
- `packages/api-zod/src/generated/types/updateIntegration200.ts`
- `packages/api-zod/src/generated/types/updateIntegrationBody.ts`
- `packages/api-zod/src/generated/types/updateIntegrationBodyConfig.ts`
- `packages/api-zod/src/generated/types/updateIntegrationBodyStatus.ts`
- `packages/api-zod/src/generated/types/updateLead200.ts`
- `packages/api-zod/src/generated/types/updatePlan200.ts`
- `packages/api-zod/src/generated/types/updateUser200.ts`
- `packages/api-zod/src/generated/types/user.ts`
- `packages/api-zod/src/generated/types/userRole.ts`
- `packages/api-zod/src/generated/types/userUpdate.ts`
- `packages/api-zod/src/generated/types/userUpdateRole.ts`
- `packages/api-zod/src/generated/types/webhook.ts`
- `packages/api-zod/src/generated/types/webhookDelivery.ts`
- `packages/api-zod/src/generated/types/webhookDeliveryPayload.ts`
- `packages/api-zod/src/generated/types/webhookDeliveryStatus.ts`
- `packages/api-zod/tsconfig.json`
- `packages/db/add-indexes.cjs`
- `packages/db/add-missing-subs.cjs`
- `packages/db/clear-data.cjs`
- `packages/db/fix-dates.cjs`
- `packages/db/fix-encoding.cjs`
- `packages/db/fix-encoding2.cjs`
- `packages/db/fix-pw-bcrypt.cjs`
- `packages/db/fix-pw.cjs`
- `packages/db/migrate-delta.cjs`
- `packages/db/package.json`
- `packages/db/push-schema.cjs`
- `packages/db/push-schema.mjs`
- `packages/db/run-migration.cjs`
- `packages/db/run-migration.js`
- `packages/db/seed-admin.cjs`
- `packages/db/seed-cademi-db.cjs`
- `packages/db/seed-plans.cjs`
- `packages/db/seed.cjs`
- `packages/db/tsconfig.json`
- `packages/db/update-admin.cjs`
- `packages/db/update-subscriptions.cjs`
- `packages/api-client-react/package.json`
- `packages/api-client-react/tsconfig.json`
- `packages/api-spec/orval.config.ts`
- `packages/api-spec/package.json`
- `packages/api-zod/package.json`
- `scripts/backup-neon.mjs`
- `scripts/bootstrap-db.mjs`
- `scripts/import-leads.mjs`
- `scripts/migrar-render-env.ps1`
- `scripts/package.json`
- `scripts/push-schema.mjs`
- `standalone-server/tests/harnesses/admin-guard.mjs`
- `standalone-server/tests/harnesses/audit-log.mjs`
- `standalone-server/tests/harnesses/csrf.mjs`
- `standalone-server/tests/harnesses/headers-cors.mjs`
- `standalone-server/tests/harnesses/login-timing.mjs`
- `standalone-server/tests/harnesses/promo-schema.mjs`
- `standalone-server/tests/harnesses/public-lookup.mjs`
- `standalone-server/tests/harnesses/sessao-reset.mjs`
- `standalone-server/tests/harnesses/webhook-ekwanza.mjs`
- `standalone-server/tests/modules.test.mjs`
- `standalone-server/tests/security.test.mjs`
- `standalone-server/tests/studio.test.mjs`
- `tsconfig.base.json`
- `tsconfig.json`
- `pnpm-workspace.yaml`
- `pnpm-lock.yaml`
- `package.json`

## C — Documentação (inclui C/G onde indicado)

Documentos preservados para cliente, entrega, operação, arquitetura, contexto histórico e manutenção. A classificação C não aprova a atualidade do conteúdo; vários documentos requerem reconciliação antes do handover.

- `CHANGELOG.md`
- `ENTREGA-SAMORAFIT.md`
- `README.md`
- `docs/INTEGRACAO-SAMORAFIT-STUDIO.md`
- `docs/architecture.md`
- `docs/cliente/00-BEM-VINDO.md`
- `docs/cliente/01-CAIXA-E-PAGAMENTOS.md`
- `docs/cliente/02-SOCIOS-E-ACESSOS.md`
- `docs/cliente/03-CURSOS-CADEMI.md`
- `docs/cliente/04-O-QUE-FAZER-QUANDO.md`
- `docs/database.md`
- `docs/repository-structure.md`
- `docs/tecnica/00-VISAO-GERAL.md`
- `docs/tecnica/01-CRM-ADMIN.md`
- `docs/tecnica/02-PAGAMENTOS.md`
- `docs/tecnica/03-ACADEMIA-CADEMI.md`
- `docs/tecnica/04-PORTAL-CLIENTE.md`
- `docs/tecnica/06-DEPLOY-OPERACAO.md` — **C/G**: contém configuração publicável associada ao projeto; não reproduzida aqui; substituir por instrução de obtenção/configuração antes de distribuição ampla.
- `docs/tecnica/07-BASE-DADOS.md`
- `docs/tecnica/08-WHATSAPP.md`
- `docs/tecnica/09-WORKFLOW-GAP.md`
- `docs/tecnica/10-SEGURANCA.md` — **C/G**: contém valores de credenciais históricas usados como exemplos; confirmar validade e rodar se necessário; valores não reproduzidos.
- `docs/tecnica/11-DEPLOY-NOVA-CONTA.md`
- `docs/tecnica/ARQUITETURA.md`
- `docs/tecnica/RUNBOOK.md`
- `docs/workflows.md`

## F — Temporário / artefacto local de ferramenta (candidatos não removidos)

São versionados, mas aparentam ser dados/configuração local de ferramentas, não parte do produto. A proposta de remoção está pendente; verificar se a equipa pretende partilhá-los antes de qualquer remoção.

- `.claude/settings.local.json`
- `.impeccable/critique/2026-09-27T13-40-40Z__apps-web-src-app-tsx.md`
- `.impeccable/critique/2026-09-28T00-05-00Z__apps-web-src-leads-module.md`

## D — Candidato opcional, manter até validação

**Dependência candidata D:** `react-router-dom`, declarada em `apps/web/package.json`, sem import direto encontrado na pesquisa do workspace; Wouter é o router importado pelas páginas. Não é um caminho de ficheiro e não conta no total de 346. Verificar code splitting, dependências indiretas, extensões/plugins e build limpo antes de eventual remoção. Nenhuma dependência foi alterada.

## E — Obsoleto confirmado

**Nenhum item classificado como E.** Os documentos desatualizados e os scripts/migrations históricos foram mantidos porque têm valor de manutenção ou não foi comprovada inutilidade. A presença de TODO, data antiga ou falta de import direto não é critério suficiente para declarar obsolescência.

## Fora do inventário versionado

`node_modules/`, `.git/`, `dist/` e outros paths ignorados não entram nos 346 caminhos de `git ls-files`. Foram enumerados 346 ficheiros versionados; isto não é um inventário completo de todo o disco. `.env.example` está versionado e é template; nenhum `.env` real apareceu na pesquisa de padrões inicial. A instalação local em `node_modules` não deve ser incluída em pacote de entrega.

## Verificações pendentes antes de qualquer remoção

- Completar a matriz de uso de assets/rotas/imports, inclusive referências construídas dinamicamente, convenções de framework e configuração não abrangida pelas pesquisas.
- Confirmar o destino operacional dos dois backends, scripts de manutenção e documentos OVG/catraca com o responsável do produto.
- Executar instalação frozen, tests/typecheck/lint/build do workspace e Docker sem deploy; `pnpm audit` e scanner de secrets (incluindo política de histórico) permanecem pendentes.
- Rever licença MIT e titularidade; não foi encontrado `LICENSE`/`COPYING` na raiz versionada.
- Comparar funcionalidade antes/depois apenas se uma limpeza for autorizada. Nesta entrega não foram removidos ficheiros, atualizadas dependências nem medido espaço libertado.

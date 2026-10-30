# Auditoria de Preparação para Produção

**Data:** 2026-10-30  
**Estado:** plano completo de auditoria e resultados preliminares. A auditoria integral não foi concluída e não foram autorizadas alterações de código.  
**Âmbito:** repositório `Solve/` no workspace local.

## 1. Resumo executivo

**Estado preliminar: NÃO APTO PARA PRODUÇÃO.** A inspeção parcial identificou configuração do servidor standalone que desativa a validação do certificado TLS da base de dados, endpoint público de histórico de pagamentos protegido apenas por email/telefone, webhook Cademi sem autenticação verificável, checkout Pay4All simulado com resposta de sucesso, migração destrutiva com `CASCADE` e health check que não verifica a base de dados.

Este documento regista o plano integral das análises, evidências preliminares e validações já tentadas. Não é uma certificação nem um relatório final. Nenhum serviço externo ou base de dados real foi contactado. Não foram feitas alterações de código e nenhuma recomendação de deploy é feita.

## 2. Inventário analisado

### Inventário e evidências lidas

- Inventário versionado confirmado com `git ls-files`: **346 caminhos únicos**, incluindo configurações ocultas; exclui por definição `.git` e ficheiros locais não rastreados. O anexo [REPOSITORY_FILE_CLASSIFICATION.md](Solve/REPOSITORY_FILE_CLASSIFICATION.md) lista os caminhos com categoria predominante; a classificação não implica leitura linha a linha de todos.
- Raiz e configuração: `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml` (inventariado, mas não auditado pacote a pacote nesta fase), `tsconfig.json`, `tsconfig.base.json`, `.env.example`, `.gitignore`, `.dockerignore`, `.npmrc`, `Dockerfile` e `render.yaml`.
- Backend de produção Docker: `standalone-server/index.js`, `portal.js`, `whatsapp.js`, `automation.js`, `studio-integration.js`, `public/pay-widget.js`, manifesto e testes principais.
- Backend TypeScript: manifestos de `apps/api` e `apps/web`, `apps/api/src/app.ts`, autenticação e rate limiting, testes de health e serviço Pay4All do frontend.
- Dados: `packages/db/src/index.ts`, `packages/db/src/schema/index.ts`, migrações Drizzle presentes e `supabase/migrations/0001_fit90_leads.sql`.
- Encontrados 51 ficheiros TypeScript na API e 47 no frontend pelos padrões de pesquisa do workspace; não foram lidos individualmente todos os componentes e handlers.
- O índice de pesquisas não encontrou `.github/` nem ficheiros `AGENTS.md`/`copilot-instructions.md`. A listagem da raiz não mostrou Docker Compose, configurações Nginx nem configuração Vercel.
- Os templates de ambiente versionados identificados são `.env.example` e `supabase/.env.supabase.example`. `git ls-files` não encontrou `.env` real; ficheiros locais ignorados não foram auditados. Não foi lido nem reportado qualquer valor de segredo real.

### Limitações explícitas

A contagem não equivale a uma leitura linha a linha dos 346 ficheiros. Esta fase inspecionou as superfícies de configuração, segurança, deploy e dados acima e pesquisou código em diretórios selecionados. Permanecem por inspecionar, em profundidade, todas as páginas/componentes, todos os handlers e integrações, scripts auxiliares, snapshots gerados e conteúdo estático. O índice do workspace não encontrou workflows CI; isso não prova a ausência de outros mecanismos fora do repositório. `rg` não está disponível no terminal local, embora as pesquisas do workspace tenham funcionado.

Não foram executados auditoria de dependências (npm/pnpm audit), lint, typecheck, build, scanners, análise dinâmica, medições de performance, chamadas a integrações externas, migrações ou consultas a bases de dados. Não foi possível confirmar credenciais, estado real de serviços, backups, RPO/RTO, domínio, TLS público, rollback ou permissões do ambiente Render. Esses itens não são considerados aprovados.

## 3. Plano completo das análises

As atividades abaixo compõem o âmbito solicitado. A indicação de uma análise neste plano **não significa que tenha sido executada**. Os resultados só devem ser marcados como aprovados depois de recolher evidência reproduzível.

### Repositório, arquitetura e qualidade

- Enumerar todos os ficheiros rastreados e não rastreados, incluindo ocultos; classificar código, artefactos, documentação, dependências e dados. Registar exclusões e ficheiros ilegíveis.
- Ler instruções locais, manifestos, lockfiles, scripts, configurações de build e deploy, documentação, Docker, CI/CD e exemplos de ambiente.
- Mapear entradas de execução, serviços efetivamente implantados, rotas, middlewares, componentes, contratos entre frontend/API, integrações e persistência.
- Verificar duplicação, imports, dependências circulares, código morto, TODOs, placeholders, flags de debugging, erros de tipagem, complexidade, estados inconsistentes, exceções assíncronas, concorrência e possíveis leaks.
- Confirmar quais dos dois backends (`apps/api` e `standalone-server`) são efetivamente usados em dev, build, Docker e produção; identificar divergências de comportamento e de segurança.

### Segurança da aplicação

- Rever login, registo, reset de password, hashing, expiração/rotação/revogação de sessão, cookies, JWT, CSRF, brute force, rate limits e política de segredos/fallbacks.
- Fazer matriz de rotas por método, autenticação, papel, validação, limitação de pedidos e dados devolvidos; testar autorização horizontal/vertical e isolamento por utilizador.
- Inspecionar SQL parametrizado, validação de input, mass assignment, XSS/HTML injection, CSRF, SSRF, path traversal, command injection, redirects, CORS, clickjacking, headers, uploads e exposição de erros/logs.
- Verificar callbacks e webhooks: assinatura, timestamp/replay, idempotência, autenticidade, reconciliação do estado e correspondência de valor/cliente.
- Procurar segredos em código, histórico rastreado, ficheiros de ambiente, bundles, logs e documentação sem revelar valores no relatório.
- Rever TLS, certificados, permissões e privilégios do processo/container, portas e serviços expostos, política de CORS e atributos dos cookies.
- Executar análise de dependências direta e transitiva, advisories e sinais de abandono; avaliar supply chain sem atualizar pacotes indiscriminadamente.

### Base de dados e integridade

- Inventariar schemas, tabelas, colunas, tipos, constraints, FKs, unicidade, índices, RLS/grants e relações entre modelos Drizzle, SQL e schema real (se autorizado).
- Rever migrações sequenciais, idempotência, bloqueios, alterações destrutivas, divergência entre ambientes e scripts de seed/repair.
- Analisar queries de alto volume, paginação, N+1, índices, limites, transações, idempotência, concorrência e possíveis condições de corrida.
- Confirmar política de credenciais e privilégios mínimos; nunca ligar a bases de produção sem autorização expressa.
- Avaliar backup, retenção, cópias externas, teste de restauro, RPO/RTO e processo de recuperação; não executar operações destrutivas.

### Frontend e fluxos funcionais

- Percorrer páginas, rotas, navegação, formulários, validações, permissões de UI, estados de loading/vazio/erro, falhas offline e comportamento em browsers suportados.
- Confirmar se botões/fluxos chamam APIs reais ou mocks e se as respostas são validadas; comparar chamadas com contratos e schemas do backend.
- Rever armazenamento de tokens, dados pessoais, erros/logs, renderização HTML, acessibilidade, teclado, leitores de ecrã, responsividade, SEO aplicável e carregamento.
- Validar ponta a ponta login/logout, portal, CRUD, pagamentos, promoções, callbacks, integrações, uploads (se existentes) e recuperação de falhas com dados sintéticos.

### Testes, performance e operação

- Executar testes unitários, integração e E2E existentes; adicionar testes focados apenas após aprovação para alterações de código. Registar comando, ambiente, resultado, skips e falhas.
- Executar lint, typecheck e build de produção por workspace; validar instalação congelada do lockfile e scripts Docker.
- Medir latência, bundle, memória/CPU e consultas com método e ambiente identificados; não inferir métricas sem medição.
- Avaliar cache, paginação, cold starts, polling, limites de concorrência, timeouts, retries, filas e escalabilidade horizontal.
- Validar health/readiness, logs estruturados e redação de PII, monitorização/alertas, HTTPS, variáveis por ambiente, migrations no deploy, persistência de ficheiros, backup, rollback e dependências externas.
- Repetir verificações de segurança, testes, typecheck, build e configuração após quaisquer correções autorizadas; documentar riscos residuais e ações manuais.

### Resultados de validação efetivamente obtidos

- `npm test --prefix standalone-server`: **25 testes aprovados, 0 falhas**; inclui módulos e harnesses de segurança.
- `pnpm --dir <raiz> --filter @workspace/api-server test`: **falhou**; `src/__tests__/security-regression.test.ts` terminou com `Hook timed out in 10000ms`. O output também indicou 33 testes ignorados nesse ficheiro. É necessário investigar e repetir isoladamente antes de concluir.
- Durante essa execução, pnpm informou que o lockfile satisfaz as políticas configuradas, com **547 entradas**. Isto não substitui `pnpm audit` nem análise de vulnerabilidades.
- Typecheck do frontend: pedido de execução cancelado pelo utilizador antes de começar; portanto, **não executado**.
- Sem lint, build, `pnpm audit`, scanner de segurança, testes de browser, teste E2E ou medições de performance.

## 4. Problemas identificados na inspeção preliminar

### PRA-001 — Validação de certificado PostgreSQL desativada

- **Categoria:** Segurança / infraestrutura / transporte de dados
- **Localização:** `standalone-server/index.js:36`; `render.yaml:21`
- **Severidade:** **ALTO**
- **Probabilidade:** Média, dependente da rede e da configuração do pooler.
- **Evidência:** o servidor standalone configura `rejectUnauthorized` como `false` a menos que `DB_SSL_REJECT_UNAUTHORIZED` seja exatamente `"true"`; Render define a variável como `"false"`. O `Dockerfile` executa este servidor. O outro pool (`packages/db/src/index.ts`) valida por defeito, portanto a política difere entre backends.
- **Impacto:** TLS pode cifrar a ligação sem autenticar o servidor, permitindo interceção/manipulação por um atacante com posição de rede adequada.
- **Correção recomendada:** validar a cadeia/certificado do endpoint real do pooler em produção e ativar verificação TLS usando a CA suportada. Não remover a exceção antes de confirmar compatibilidade do certificado, para evitar indisponibilidade.

### PRA-002 — Histórico de pagamentos exposto por identificador adivinhável

- **Categoria:** Segurança / privacidade / IDOR-BOLA
- **Localização:** `standalone-server/index.js:1626` (consulta e resposta no handler seguinte)
- **Severidade:** **ALTO**
- **Probabilidade:** Alta para exploração automatizada; rate limit por IP reduz, mas não elimina, enumeração.
- **Evidência:** endpoint público `GET /api/v1/payments/minha-historico` aceita email **ou** os últimos nove dígitos do telefone, pesquisa `WHERE email = ... OR phone = ...` e devolve código, valor, estado, referência, entidade, produto e `hosted_url`. Não exige sessão, OTP nem prova independente de posse.
- **Impacto:** divulgação de dados de pagamento, identificadores e links de checkout de terceiros; facilita enumeração e fraude direcionada.
- **Correção recomendada:** exigir prova de posse de uso único (OTP/sessão de portal) antes de devolver histórico. Não basta trocar a ordem de comparação nem ocultar apenas um campo. Manter a compatibilidade do widget através de fluxo autenticado equivalente.

### PRA-003 — Webhook Cademi aceita alterações sem autenticação

- **Categoria:** Segurança / integridade / spoofing de webhook
- **Localização:** `standalone-server/index.js:3069`
- **Severidade:** **ALTO**
- **Probabilidade:** Média-alta; a rota é pública e tem apenas rate limit em memória.
- **Evidência:** o handler aceita `event.usuario.email` e `event.usuario.id`, valida apenas o formato do email e atualiza `customers.cademi_id`; não valida assinatura HMAC, token partilhado nem autenticidade via Cademi.
- **Impacto:** um remetente não autenticado pode substituir o vínculo Cademi de um cliente, corrompendo a reconciliação e podendo encaminhar operações posteriores à conta errada.
- **Correção recomendada:** validar assinatura/documentação oficial da Cademi ou configurar segredo de webhook dedicado com comparação timing-safe; rejeitar por defeito chamadas sem credencial. Registar e testar o contrato real antes de ativar em produção.

### PRA-004 — Checkout Pay4All de produção é um mock que declara sucesso

- **Categoria:** Funcionalidade / integridade financeira
- **Localização:** `apps/web/src/landing/services/pay4all.ts:16`
- **Severidade:** **ALTO**
- **Probabilidade:** Alta sempre que este fluxo de checkout seja usado.
- **Evidência:** `createPay4AllPayment` ignora o pedido, aguarda 1,5 s e devolve `success: true` com `https://pay4all.ao/checkout/mock-id-12345`. A integração real está comentada; o próprio código marca o bloco como mock/TODO.
- **Impacto:** o utilizador vê uma confirmação falsa e é enviado para um checkout fictício; não há evidência de cobrança nem de reconciliação real. A chave `VITE_*` não deve ser usada como segredo de servidor.
- **Correção recomendada:** integrar com backend e contrato oficial da Pay4All, com credenciais apenas no servidor, callbacks autenticados e testes de reconciliação. Até lá, impedir que o mock se apresente como pagamento bem-sucedido em produção; decisão de negócio/credenciais do fornecedor são necessárias para concluir a integração.

### PRA-005 — Migração contém remoção destrutiva de tabelas legadas

- **Categoria:** Base de dados / perda de dados / deploy
- **Localização:** `packages/db/drizzle/0007_drop_gym.sql:4`
- **Severidade:** **ALTO** (condicional à execução sobre uma BD que ainda contenha esses dados)
- **Probabilidade:** Baixa a média, conforme o ambiente e se a migração já foi aplicada.
- **Evidência:** a migração executa vários `DROP TABLE IF EXISTS ... CASCADE` em tabelas do sistema antigo. Não foi consultada nenhuma BD nem o histórico de migrações do ambiente.
- **Impacto:** remoção irreversível de tabelas e objetos dependentes se ainda contiverem dados necessários; não foi possível confirmar backup/restauro.
- **Correção recomendada:** confirmar alvo, inventariar dependências e dados, testar restauro e obter aprovação explícita antes de aplicar. Não executar esta migração nesta auditoria sem autorização.

### PRA-006 — Health check é apenas liveness e não verifica dependências

- **Categoria:** Deploy / disponibilidade / observabilidade
- **Localização:** `standalone-server/index.js:523`; também `apps/api/src/app.ts:82`; `render.yaml:93`
- **Severidade:** **MÉDIO**
- **Probabilidade:** Alta quando a BD ou serviço essencial falha.
- **Evidência:** `/healthz` responde `status: ok` sem consultar PostgreSQL; Render usa esse endpoint como health check. Uma instância sem acesso à BD pode ser considerada saudável.
- **Impacto:** tráfego pode continuar a ser direcionado a uma instância incapaz de atender fluxos críticos; falhas de dependência ficam mascaradas durante rollout.
- **Correção recomendada:** manter liveness barato e acrescentar readiness separado com consulta curta e timeout à BD, sem expor detalhes sensíveis; configurar Render para readiness se suportado pelo modelo de serviço.

### PRA-007 — Alterações de esquema no arranque são ignoradas em caso de falha

- **Categoria:** Base de dados / consistência / deploy
- **Localização:** `standalone-server/index.js:542` e chamadas DDL de arranque adjacentes
- **Severidade:** **MÉDIO**
- **Probabilidade:** Média em bases com permissões restritas ou schema divergente.
- **Evidência:** `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` é disparado durante a inicialização e o erro é descartado com `.catch(() => {})`.
- **Impacto:** a aplicação pode iniciar com esquema incompleto e falhar mais tarde em fluxos específicos, sem um sinal de readiness claro; o runtime também assume responsabilidade de migração.
- **Correção recomendada:** mover alterações para migrações versionadas executadas em etapa controlada; tornar incompatibilidades visíveis e bloquear readiness quando indispensável.

### PRA-008 — Limites de pedidos são locais ao processo

- **Categoria:** Segurança / disponibilidade / escalabilidade
- **Localização:** `standalone-server/index.js:360`; `apps/api/src/middlewares/rate-limit.ts:1`
- **Severidade:** **MÉDIO**
- **Probabilidade:** Alta quando há múltiplas instâncias ou reinícios.
- **Evidência:** contadores são armazenados em `Map` no processo; resetam em restart e cada réplica mantém limites independentes. O standalone também limpa mapas de forma periódica.
- **Impacto:** brute force e abuso distribuído entre instâncias podem ultrapassar o limite nominal; consumo de memória e mitigação não são consistentes no cluster.
- **Correção recomendada:** usar armazenamento partilhado com expiração e política por endpoint/identidade, após dimensionar limites e disponibilidade do serviço.

### PRA-009 — Endpoints de pagamento público dependem de conhecimento de código como autorização

- **Categoria:** Segurança / IDOR-BOLA / privacidade
- **Localização:** `standalone-server/index.js:4146`; criação de código em `standalone-server/index.js` no handler de pagamentos
- **Severidade:** **MÉDIO** (a confirmar com o fluxo completo do widget)
- **Probabilidade:** Média; o código observado é derivado de `Date.now()` em base 36 e não apresenta aleatoriedade neste ponto.
- **Evidência:** `GET /api/v1/payments/ekwanza/check-status/:id` não exige autenticação; consulta por código ou UUID e devolve estado, código e, quando presente, `hosted_url`. O identificador do pagamento não deve ser presumido como segredo se for previsível.
- **Impacto:** enumeração/consulta indevida de estado e exposição de links de pagamento de outros clientes.
- **Correção recomendada:** usar identificador aleatório de alta entropia ou token de consulta separado, limitar a resposta ao mínimo e validar o fluxo de posse sem quebrar a experiência pública legítima.

### PRA-010 — Sem evidência de pipeline CI/CD versionado

- **Categoria:** Deploy / qualidade
- **Localização:** não foi encontrado `.github/` pelo índice de ficheiros; `render.yaml` configura `autoDeploy: true`
- **Severidade:** **MÉDIO**
- **Probabilidade:** Alta de releases sem gates automatizados, se não houver pipeline externo.
- **Evidência:** o Render está configurado para deploy automático; não foi localizado workflow versionado para executar testes, typecheck, auditoria de dependências ou build antes do deploy.
- **Impacto:** alterações podem chegar a produção sem validação consistente ou rollback automatizado conhecido.
- **Correção recomendada:** confirmar os gates externos atuais; se inexistentes, adicionar pipeline com checks reproduzíveis e política de promoção/rollback.

## 5. Classificação de risco preliminar

- **CRÍTICO:** nenhum confirmado nesta inspeção inicial; isso não equivale a ausência de risco crítico.
- **ALTO:** PRA-001, PRA-002, PRA-003, PRA-004; PRA-005 condicional à execução.
- **MÉDIO:** PRA-006, PRA-007, PRA-008, PRA-009, PRA-010.
- **BAIXO / INFORMATIVO:** não classificados nesta fase por cobertura insuficiente.

## 6. Plano de trabalho posterior, sujeito a autorização

1. Concluir a inspeção integral do inventário e atualizar a matriz de achados com evidência, impacto, probabilidade, severidade e referências precisas.
2. Repetir/investigar o timeout do teste API; executar typecheck, lint, build, auditoria de dependências e fluxos críticos.
3. Apresentar propostas de correção dos achados altos e dos riscos de integridade; nenhuma correção de código será feita sem autorização do utilizador.
4. Confirmar contratos/credenciais e escolhas externas necessárias para webhook Cademi, CA PostgreSQL e Pay4All.
5. Antes de qualquer ação na base real, exigir autorização, backup verificado e plano de rollback; migração destrutiva permanece bloqueada.
6. Se forem autorizadas correções, implementar de forma incremental, criar testes, repetir gates e emitir relatório final com limitações e checklist de deploy.

## 7. Problemas não resolvidos e verificações pendentes

- A suite standalone passou; a suite da API falhou por timeout. Typecheck, lint, build e auditoria de dependências permanecem **não verificados**.
- Não foram validados TLS/CA, domínio/HTTPS, configuração real do Render, segredos, Supabase, Neon, Cademi, É-kwanza, WiPay, WhatsApp ou Pay4All em ambientes externos.
- Não se conhece se a migração `0007_drop_gym.sql` foi aplicada nem se os dados legados têm backup restaurável.
- Não foram feitos testes de ponta a ponta, análise dinâmica, medição de bundle/performance, teste de concorrência ou revisão manual de todas as páginas e rotas.
- A autenticidade suportada pelo webhook Cademi e a forma segura de autenticar o histórico público requerem confirmação do contrato real e do fluxo do cliente.
- Backups, RPO/RTO, monitorização, rollback, acessibilidade e suporte cross-browser não foram verificados.

## 8. Avaliação preliminar

**NÃO APTO PARA PRODUÇÃO**, dentro do âmbito efetivamente inspecionado. Existem achados altos conhecidos, fluxos funcionais ainda simulados e gates essenciais não executados. O relatório final só poderá alterar esta decisão após correções verificáveis, validação dos contratos externos, testes executados e confirmação de backup/recuperação e rollback.

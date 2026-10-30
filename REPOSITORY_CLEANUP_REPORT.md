# Relatório de Auditoria e Limpeza do Repositório

**Data:** 2026-10-30  
**Estado:** relatório apenas. Não foram removidos ficheiros, alteradas dependências ou reorganizados diretórios.  
**Repositório:** `Solve/`  
**Regra aplicada:** preservar funcionalidade, testes, migrações, lockfiles, scripts operacionais e documentação útil. Não foram executadas migrações nem ações em serviços externos.

## 1. Resumo

Foram enumerados **346 ficheiros versionados** com `git ls-files`. Não foram encontrados ficheiros versionados com extensões típicas de logs, dumps, bases de dados locais, backups, ZIPs, temporários ou saída de build. O inventário inclui testes, migrações, código gerado, scripts de operação e configuração de build/deploy, todos mantidos.

Há três artefactos de ferramentas locais de desenvolvimento versionados que não são consumidos pelo produto e contêm contexto local/obsoleto. Foi também confirmada uma dependência direta sem import identificado (`react-router-dom`), enquanto a aplicação usa Wouter. Estes quatro itens são apenas candidatos para decisão futura, listados abaixo; não foram removidos porque o pedido atual é produzir o relatório sem alterar o código nem o pacote.

A documentação técnica existente é extensa, mas há contradições verificáveis: `docs/repository-structure.md` declara 316 ficheiros; documentos de arquitetura, base de dados, workflows, segurança e deploy descrevem partes de OVG/catraca e configurações que não correspondem integralmente ao código/deploy atual. Não se propõe apagar esses documentos: precisam de atualização controlada, pois ainda contêm procedimentos e contexto histórico potencialmente úteis.

**Estado de entrega atual: NÃO APTO PARA ENTREGA FINAL.** A documentação conflituante, o fluxo de checkout Pay4All simulado, riscos de segurança já descritos em `PRODUCTION_READINESS_AUDIT.md` e validações incompletas impedem declarar o pacote pronto.

## 2. Inventário e classificação

### Contagem de ficheiros versionados

| Área | Ficheiros | Classificação predominante |
|---|---:|---|
| Raiz | 17 | A/B/C: manifestos, configuração, deploy, README, changelog e entrega |
| `apps/` | 115 | A/B: frontend, API, testes, configuração e build |
| `packages/` | 158 | A/B: especificação, clientes/schemas gerados, base de dados e scripts |
| `scripts/` | 6 | A/B: importação, backup, bootstrap e schema |
| `standalone-server/` | 20 | A/B: serviço implantado, widget, lockfile e testes |
| `supabase/` | 4 | A/B: configuração, função e migração |
| `docs/` | 23 | C: documentação de cliente e manutenção; parte requer reconciliação |
| `.claude/` e `.impeccable/` | 3 | F: candidatos a remoção descritos em §3 |
| **Total** | **346** | |

A classificação é por área e função e não significa que cada um dos 346 ficheiros tenha sido lido linha a linha. O inventário caminho-a-caminho, com uma categoria predominante por caminho e notas para itens sensíveis/candidatos, está em [REPOSITORY_FILE_CLASSIFICATION.md](Solve/REPOSITORY_FILE_CLASSIFICATION.md). A contagem reconciliada é A=134, B=183, C=26, F=3; D=0 e E=0 ficheiros confirmados. As marcas G são adicionais e não entram como segunda categoria. Há configuração publicável específica do projeto e literais de credenciais antigas em documentação; os valores não são reproduzidos. Não foi comprovada nesta verificação a presença de uma service-role key ou de outra credencial de serviço ativa, mas também não foi executado scanner de segredos ou revisão do histórico Git. Ver §5 e §7.

### Análises previstas para a classificação integral

Para cada ficheiro, a classificação deverá ser confirmada com o seu papel efetivo, não apenas com o nome ou ausência de import direto:

| Verificação | Evidência a recolher antes de classificar/remover |
|---|---|
| Referências estáticas e dinâmicas | Imports, `require`, caminhos construídos em runtime, `import.meta.glob`, descoberta por convenção, referências por string e chamadas via reflection |
| Build e execução | Manifests, scripts, Docker stages, Vite, TypeScript, configuração de deploy, rotas estáticas e artefactos copiados na imagem |
| Operação | Scripts `.cmd`/PowerShell, cron/jobs, runbooks, tarefas DB, seeds, bootstrap, integração local e requisitos do cliente |
| Testes e manutenção | Testes unitários/integrados, harnesses, fixtures, snapshots, ferramentas de geração e instruções para manutenção futura |
| Dependências | Imports por pacote, plugins, CSS/runtime, geração, scripts CLI, peer dependencies, dependências transitivas e lockfiles |
| Segurança/compliance | `.env`, chaves, URLs/IDs específicos, dados pessoais, logs/dumps, licenças e avisos de terceiros; scan do histórico Git quando autorizado |
| Assets/documentação | Uso por HTML/CSS, manifestos, CMS e runtime; atualidade, público-alvo, links quebrados, procedimentos ainda operacionais e informação de cliente |
| Resultado da decisão | Categoria A–G, evidência, risco de remoção, proposta e validação mínima; em caso de dúvida, manter |

Esta matriz é o plano de inspeção restante, não a afirmação de que todos estes testes já foram concluídos.

### Grupos preservados

- **A — Essencial:** `Dockerfile`, `render.yaml`, manifests, lockfiles, configurações Vite/TypeScript, código de apps/serviços, assets referenciados, schemas, edge function e configurações Supabase.
- **B — Desenvolvimento/manutenção:** testes Vitest e Node, harnesses de segurança, scripts de build, geração OpenAPI, `.npmrc`, `dev.ps1`, seeds e scripts de manutenção da BD.
- **C — Documentação:** README, changelog, documentação cliente/técnica, runbook, entrega e integração Studio. Preservada mesmo quando desatualizada; corrigir antes da entrega final.
- **G — Sensível:** nenhum `.env` real foi encontrado no inventário versionado; manter fora do pacote service-role keys, credenciais, dados pessoais e tokens. Foram encontrados valores de configuração publicáveis e exemplos históricos em documentação, descritos sem valores em §5. A busca automática não foi uma varredura completa e não cobre todo o histórico Git.

## 3. Candidatos para decisão futura — não executados

| Caminho/dependência | Categoria | Evidência de inutilidade para produto | Referências e impacto avaliados | Proposta |
|---|---|---|---|---|
| `.claude/settings.local.json` | F | Configuração pessoal de hooks; usa caminho absoluto de perfil Windows e ferramenta fora do repositório | Nenhuma referência em scripts, app, Docker ou configuração de deploy. Não é configuração de runtime | Remover do versionamento e ignorar apenas o ficheiro local |
| `.impeccable/critique/2026-09-27T13-40-40Z__apps-web-src-app-tsx.md` | F | Relatório gerado de crítica visual, aponta para cópia antiga `Solve-1`, fingerprint e números de linha antigos | Sem consumidores em código, build, deploy ou documentação operacional. Não é especificação funcional vigente | Remover do pacote e do versionamento |
| `.impeccable/critique/2026-09-28T00-05-00Z__apps-web-src-leads-module.md` | F | Relatório de crítica de UI ligado a alterações antigas; mistura conclusões verificadas e sugestões sem ser documentação de manutenção | Sem consumidores runtime/build/deploy. O conteúdo é histórico e não define o comportamento atual | Remover do pacote e do versionamento |
| `apps/web/package.json` → `react-router-dom` | D (dependência) | Busca de imports/uso encontrou somente a declaração no manifesto; `App.tsx` e restantes rotas importam Wouter | `vite.config.ts` não usa o pacote; lockfile tem entrada direta. Remoção exige atualização coordenada do lockfile e typecheck/build | Remover a dependência direta e atualizar o lockfile com pnpm; validar instalação e build |

**Nenhuma remoção foi executada.** Os candidatos permanecem versionados. Uma eventual limpeza requer autorização, atualização coordenada do lockfile quando aplicável e validação pós-alteração; não faz parte deste relatório-only.

## 4. Ficheiros mantidos e justificação

- `standalone-server/package-lock.json`: Docker executa `npm ci`; obrigatório para deploy reproduzível.
- `pnpm-lock.yaml`: instalações congeladas e políticas de supply chain dependem dele.
- `packages/db/drizzle/**`: migrações e snapshots fazem parte do histórico do schema. `0007_drop_gym.sql` é destrutiva, mas não será apagada nem executada nesta limpeza.
- `packages/db/*.cjs`, `scripts/*.mjs`, `apps/api/fix-password.mjs`: tarefas de operação/manutenção; nomes de correção pontual não provam obsolescência.
- `standalone-server/tests/**` e `apps/api/src/__tests__/**`: testes de regressão e contrato mantidos.
- `packages/api-client-react/src/generated/**` e `packages/api-zod/src/generated/**`: gerados a partir de OpenAPI e consumidos pelo workspace; não editar/remover manualmente.
- `apps/web/public/*`: favicon, robots e logótipos; não há prova de duplicação segura para remoção.
- `.env.example` e `supabase/.env.supabase.example`: exemplos sem credenciais de serviço; necessários para setup, sujeitos a manter valores reais fora dos exemplos.
- Diretórios `docs/cliente/` e `docs/tecnica/`: preservados; há procedimentos de cliente e operação que não devem ser descartados por data/estilo.

## 5. Documentação e informação de ambiente

1. `docs/repository-structure.md` informa 316 ficheiros e enumera scripts/árvores antigas; Git confirma 346 ficheiros atuais. Atualizar mapa, comandos e classificação antes do handover.
2. `docs/architecture.md`, `docs/database.md`, `docs/workflows.md` e parte de `docs/tecnica/*` contêm referências de OVG/catraca e schemas anteriores. A pesquisa no código atual encontrou resíduos históricos em migrations/bootstrap e comentários, mas não confirmou os handlers OVG descritos. Não remover migrations/scripts históricos sem decisão da operação.
3. `docs/tecnica/06-DEPLOY-OPERACAO.md` inclui uma chave Supabase publicável específica do projeto. Embora uma chave `anon`/publishable não seja uma service-role secret, substituir o valor por nome de variável e instrução para obter no dashboard reduz exposição e acoplamento ao cliente. Não há evidência nesta inspeção de que essa chave conceda acesso privilegiado; confirmar as policies/RLS no projeto antes da entrega.
4. `docs/tecnica/10-SEGURANCA.md` conserva valores antigos de credenciais default como exemplos de risco. Generalizar os literais para evitar reutilização acidental; confirmar rotação e histórico Git com o proprietário. Valores reais não são repetidos neste relatório.
5. O `.env.example` contém identificadores/valores operacionais do cliente além de placeholders. Distinguir IDs públicos de credenciais e pedir confirmação antes de remover dados de configuração usados em produção.
6. `README.md` aponta a `docs/tecnica/ARQUITETURA.md`, mas apresenta atalhos e escopo antigos. Rever links e instruções contra manifests, `Dockerfile` e `render.yaml` atuais.
7. É recomendada uma página `docs/HANDOVER.md` com arquitetura em execução, comandos validados, responsáveis, serviços e ações de rotação/backup/rollback sem valores de secrets.
8. O manifesto da raiz declara licença MIT, mas a listagem da raiz não mostrou um ficheiro `LICENSE`/`COPYING`. Confirmar a intenção do proprietário e incluir o texto de licença correto antes de uma distribuição formal; não inventar titulares nem datas.
9. Os documentos têm valores de ambiente com níveis diferentes de sensibilidade: há uma chave publicável Supabase vinculada ao projeto, menção a credencial histórica default e identificadores/conta operacional. A chave publicável não equivale a uma service-role key, mas aumenta o acoplamento e deve ser obtida/configurada por variável ou painel; verificar se credenciais históricas continuam ativas e rodá-las se houver dúvida. Este relatório não reproduz valores.

## 6. Dependências

- Remoção proposta única: `react-router-dom`, por ausência de imports/usos e uso confirmado de Wouter.
- As restantes dependências não foram removidas. A pesquisa estática por imports não substitui análise completa de plugins, geração, CSS e toolchain; primitivas Radix/geradas são mantidas quando não há prova inequívoca de inutilidade.
- O lockfile relata 547 entradas sob as políticas locais de confiança/idade, mas ainda não foi executado `pnpm audit`; vulnerabilidades e dependências abandonadas não foram certificadas.
- Nenhuma dependência foi atualizada.

## 7. Artefactos, secrets e espaço

- Pesquisa por extensões/nome no inventário versionado: nenhum `.bak`, `.log`, `.dump`, `.db`, `.sqlite`, `.zip`, `.tsbuildinfo`, `temp` ou `debug` foi encontrado.
- `.env.example` e `supabase/.env.supabase.example` são os templates de ambiente versionados identificados; não foi encontrado `.env` real em `git ls-files`. `node_modules`, `dist` e artefactos locais têm regras de ignore. Não foram medidos bytes removidos; espaço libertado: **zero, pois não houve remoções**.
- O workspace contém instalação local de dependências (`node_modules`), não deve ser copiada para entrega. Nenhuma base de dados/backups foi localizada no inventário versionado.
- Não foi feita análise completa do histórico Git nem validação de segredos por scanner. Rotacionar credenciais antigas referidas na documentação se ainda forem válidas; não reescrever histórico sem decisão e coordenação da equipa.

## 8. Validação e estado após limpeza

### Antes da limpeza

- `npm test --prefix standalone-server`: 25 aprovados, 0 falhas.
- `pnpm --dir <raiz> --filter @workspace/api-server test`: falhou com timeout de hook de 10 s em `security-regression.test.ts`; output indicou 33 testes ignorados nesse ficheiro.
- Typecheck do frontend foi cancelado antes de iniciar. Lint, builds, `pnpm audit`, testes E2E, smoke tests de deploy e análise de bundle não foram executados.

### Após a limpeza

**Não executado / não aplicável:** não houve remoções, alterações de dependências, reorganização ou edição de documentação além deste relatório. Portanto, os resultados “antes” não podem ser apresentados como validação “depois”. Se houver autorização futura para limpeza, repetir instalação congelada, standalone/API tests, typecheck por workspace, lint disponível, builds da raiz e Docker sem deploy, referências/imports, fluxos críticos e revisão de documentação; comparar o estado funcional antes/depois.

## 9. Riscos residuais e decisão de entrega

- Documentos conflitantes não foram ainda reconciliados com o código e a infraestrutura ativa.
- Checkout Pay4All permanece mockado; credenciais/contrato do fornecedor são necessários para implementar pagamento real.
- A auditoria de secrets/histórico, análise de dependências e confirmação de dados pessoais ainda estão pendentes.
- Não há CI versionado localizado nem prova de backup restaurável/rollback automatizado.
- A limpeza não corrige os achados de segurança e produção constantes em `PRODUCTION_READINESS_AUDIT.md`.

**Conclusão:** este documento é uma auditoria e proposta, não uma limpeza executada. Os quatro candidatos permanecem no repositório e nenhuma dependência foi removida. A classificação individual completa, validação de dependências e gates pós-limpeza estão pendentes. O repositório continua **NÃO APTO PARA ENTREGA FINAL** até as discrepâncias documentais, riscos de produção e verificações acima serem tratados. Nenhum deploy é recomendado.

# Baseline do Repositório — Módulo 0

**Data:** 2026-10-30  
**Repositório:** `Solve/`  
**Âmbito:** inventário, arquitetura, dependências, build, typecheck e testes.  
**Estado:** baseline estabelecida. Este documento não declara o produto pronto para produção.

## 1. Resumo executivo

- A raiz efetiva é `C:\Users\Lenovo pc\Desktop\CRM\Solve`.
- O repositório tem 346 ficheiros versionados, branch `main`, sincronizada com `origin/main`.
- Existem três documentos de auditoria não rastreados: `PRODUCTION_READINESS_AUDIT.md`, `REPOSITORY_CLEANUP_REPORT.md` e `REPOSITORY_FILE_CLASSIFICATION.md`.
- O backend tem duas implementações: `apps/api` (TypeScript, testes Vitest, uso local) e `standalone-server` (JavaScript, usado pelo Docker/Render em produção).
- O build da raiz passa (API + frontend), depois de as dependências do workspace estarem instaladas.
- Os testes standalone passam: 25/25.
- Os testes da API passam quando o `hookTimeout` é aumentado: 125/125.
- Com a configuração por omissão, `security-regression.test.ts` falha por timeout de 10 s no `beforeAll`; os seus 33 testes são marcados como skipped.
- Não existe script `lint` nem configuração CI do projeto.
- O repositório continua classificado como **NÃO APTO PARA PRODUÇÃO** pelo `PRODUCTION_READINESS_AUDIT.md`.

## 2. Ambiente de execução

| Item | Valor observado |
|---|---|
| Sistema | Windows |
| Node.js | `v22.20.0` |
| npm | `10.9.3` |
| pnpm | `12.14.0` |
| Git | `2.52.0.windows.1` |
| Lockfile pnpm | `lockfileVersion: 9.0` |
| Gestor do standalone | npm + `standalone-server/package-lock.json` |

O `Dockerfile` usa `node:20` e `corepack prepare pnpm@latest`, portanto a versão de pnpm usada no build Docker pode divergir da versão local.

## 3. Estado do repositório

### Git

- Branch: `main`.
- Remotes configurados: `origin/main` e `origin/prod`.
- Último commit observado: `76e0a73 feat(whatsapp): integra Cloud API, automacoes e portal`.
- Ficheiros rastreados: 346.
- Não rastreados:
  - `PRODUCTION_READINESS_AUDIT.md`
  - `REPOSITORY_CLEANUP_REPORT.md`
  - `REPOSITORY_FILE_CLASSIFICATION.md`

Contagem por área:

| Área | Ficheiros |
|---|---:|
| `packages/` | 158 |
| `apps/` | 115 |
| `docs/` | 23 |
| `standalone-server/` | 20 |
| Raiz | 17 |
| `scripts/` | 6 |
| `supabase/` | 4 |
| `.impeccable/` | 2 |
| `.claude/` | 1 |

### Configuração e segredos

- Só foram encontrados templates: `.env.example` e `supabase/.env.supabase.example`.
- Não foi encontrado `.env` real em `git ls-files`.
- Não foi executado um scanner de segredos nem uma análise completa do histórico Git.
- `docs/tecnica/10-SEGURANCA.md` contém referências históricas a credenciais; os valores não são reproduzidos neste relatório.

### Documentação

- `docs/architecture.md`, `docs/repository-structure.md`, `docs/database.md` e parte de `docs/tecnica/*` estão desatualizados em relação ao código atual.
- Exemplo: `docs/repository-structure.md` declara 316 ficheiros, mas `git ls-files` devolve 346.
- Exemplo: a documentação descreve `standalone-server` com menos ficheiros do que os 20 atualmente versionados.
- As contradições devem ser reconciliadas antes de um handover, sem apagar documentação histórica sem decisão.

## 4. Comandos e resultados

### 4.1 Instalação e lockfiles

| Comando | Resultado |
|---|---|
| `pnpm install --frozen-lockfile --lockfile-only --offline` | `EXIT=0`; lockfile válido; políticas de supply chain passaram; sem diff |
| `npm ci --dry-run --offline --ignore-scripts --no-audit --no-fund --prefix standalone-server` | `EXIT=0`; 99 pacotes seriam instalados |
| `pnpm --filter @workspace/solve-crm run typecheck` | Instalou dependências em falta; `Done in 1m 50.5s using pnpm v12.14.0` |

O último comando foi executado para diagnosticar o typecheck. O pnpm instalou dependências do workspace a partir do lockfile, incluindo `@tanstack/react-query`, que faltava em `packages/api-client-react/node_modules`. O `pnpm-lock.yaml` não foi alterado.

### 4.2 Typecheck

Estado inicial:

- `pnpm run typecheck` → `EXIT=2`.
- `packages/api-client-react` não tinha `node_modules`; o compilador não encontrava `@tanstack/react-query` (`TS2307`).
- Foram reportados erros implícitos `TS7006`/`TS7031` no código gerado desse pacote.
- O frontend também falhou com `TS6305` (saída de `api-client-react` não construída) e `TS7006` em `apps/web/src/App.tsx` para `ig` e `i`.

Estado após instalação das dependências:

- `pnpm run typecheck` → `EXIT=0`.
- `apps/api` e `apps/web` passaram a compilar.
- `tsc --build` gerou as saídas necessárias dos pacotes do workspace.

Conclusão: a falha inicial era de ambiente/instalação, não uma regressão funcional observada no código da API. Ainda assim, uma instalação limpa deve ser validada antes de cada baseline para evitar falsos negativos.

### 4.3 Build

- Comando: `pnpm run build` com `PORT=5173` e `BASE_PATH=/` definidos no ambiente.
- Resultado: `EXIT=0`.
- API: gerou `apps/api/dist/index.mjs` (2,3 MB) e artefactos de workers.
- Frontend: Vite transformou 2471 módulos e gerou `apps/web/dist/public`.
- Aviso não fatal: sourcemap em `apps/web/src/components/ui/tooltip.tsx`.

### 4.4 Testes da API

| Comando | Resultado |
|---|---|
| `pnpm --filter @workspace/api-server test` | `EXIT=1`; 1 suite falhou; 92 passaram, 33 skipped (125); 27,46 s |
| `pnpm --filter @workspace/api-server exec vitest run --hookTimeout=60000` | `EXIT=0`; 9/9 suites; 125/125 testes; 35,26 s |

A única falha por omissão é:

```text
FAIL src/__tests__/security-regression.test.ts
Error: Hook timed out in 10000ms.
```

A análise detalhada está em [`TEST_BASELINE.md`](TEST_BASELINE.md).

### 4.5 Testes standalone

- Comando: `npm test --prefix standalone-server`.
- Resultado: `EXIT=0`; 25 testes, 25 pass, 0 fail, 0 skipped; 3,36 s.
- Cobertura observada: automação, WhatsApp, portal, É-kwanza, CSRF, sessão/reset, timing de login, audit logs, headers/CORS/cookies, widget Cademi, `/admin` e RBAC, promos e integração Studio.
- Limitação: os testes não arrancam o servidor completo com Express/Postgres; usam harnesses que extraem lógica do `index.js`. Não substituem um smoke test do contentor.

### 4.6 Lint e CI

- Não existe script `lint` em nenhum `package.json`.
- Não foi encontrada configuração CI do projeto; os únicos `.github` observados estavam dentro de `node_modules`.
- Não foi executado ESLint/Prettier como gate de qualidade.
- Não foi executado `pnpm audit`.

## 5. Riscos já descritos na auditoria

Fonte: `PRODUCTION_READINESS_AUDIT.md` (documento não rastreado).

| Prioridade | Risco | Efeito |
|---|---|---|
| P0 | TLS da base de dados sem validação de certificado no standalone | Ligação cifrada, mas exposta a interceção; `rejectUnauthorized` fica `false` por omissão |
| P0 | Histórico de pagamentos público protegido apenas por email/telefone | Enumeração/IDOR e exposição de dados de pagamento |
| P0 | Webhook Cademi sem autenticação verificável | Eventos não autenticados podem alterar estado |
| P0 | Checkout Pay4All simulado | Pagamento pode ser marcado como bem-sucedido sem cobrança real |
| P0 | Migração destrutiva `0007_drop_gym.sql` com `CASCADE` | Perda de dados se executada no ambiente errado |
| P1 | `/healthz` não verifica a base de dados | O Render pode considerar o serviço saudável com a BD indisponível |
| P1 | Documentação contraditória e desatualizada | Handover e operação sujeitos a erro |

Consequência operacional: não executar a migração destrutiva, não ativar o checkout simulado e não tratar o estado atual como pronto para produção.

## 6. Limitações desta baseline

- Não foi executado build Docker nem deploy.
- Não foi feito acesso a base de dados de produção, staging ou serviços externos.
- Não foram executados testes E2E, testes de carga, testes de acessibilidade ou smoke tests contra o Render.
- Não foi executado `pnpm audit` nem análise do histórico Git à procura de segredos.
- Os testes standalone não exercitam o arranque real com Express, pool Postgres e variáveis de produção.
- A contagem de testes da API inclui expansões de `it.each`; a contagem de ficheiros de teste é 9.
- O typecheck final depende das dependências agora instaladas; uma máquina limpa deve repetir a instalação congelada.
- Não foram alterados código funcional, dependências declaradas, migrações ou documentação operacional existente.
- Foram criados e removidos apenas dois testes temporários de diagnóstico (`zz-diag-timing.test.ts` e `zz-diag-deps.test.ts`).

## 7. Ficheiros inspecionados

- Raiz: `README.md`, `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.base.json`, `tsconfig.json`, `.npmrc`, `.gitignore`, `.dockerignore`, `Dockerfile`, `render.yaml`, `.env.example`.
- Scripts operacionais: `iniciar-crm.cmd`, `iniciar-tunnel.cmd`, `migrar-render-env.cmd`, `apps/web/dev.ps1`, `scripts/migrar-render-env.ps1`.
- API: `apps/api/package.json`, `apps/api/vitest.config.ts`, `apps/api/src/index.ts`, `apps/api/src/app.ts`, `apps/api/src/__tests__/setup.ts`, `apps/api/src/__tests__/security-regression.test.ts`, `apps/api/src/routes/*`.
- Frontend: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/src/App.tsx`.
- Workspace: `packages/db`, `packages/api-zod`, `packages/api-client-react`.
- Deploy: `standalone-server/package.json`, `standalone-server/package-lock.json`, `standalone-server/index.js`, módulos `automation.js`, `whatsapp.js`, `portal.js`, `studio-integration.js`.
- Testes standalone: `standalone-server/tests/*.test.mjs` e harnesses.
- Documentação: `docs/architecture.md`, `docs/repository-structure.md`, `docs/database.md`, `docs/workflows.md`, `docs/tecnica/ARQUITETURA.md`, `docs/tecnica/00-VISAO-GERAL.md`, `docs/tecnica/06-DEPLOY-OPERACAO.md`, `docs/tecnica/10-SEGURANCA.md`, `docs/tecnica/RUNBOOK.md`.
- Auditoria: `PRODUCTION_READINESS_AUDIT.md`, `REPOSITORY_CLEANUP_REPORT.md`, `REPOSITORY_FILE_CLASSIFICATION.md`.

## 8. Conclusão

A baseline está estabelecida: build e typecheck passam num ambiente com dependências instaladas, os testes standalone passam e a suite da API passa com `hookTimeout` adequado. A falha por omissão é explicada pelo custo de importação da aplicação completa, não por um teste funcional quebrado.

O repositório não está apto para produção enquanto os riscos P0/P1 acima não forem tratados. Nenhuma correção funcional foi feita neste módulo.

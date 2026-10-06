---
target: o front (apps/web) - CRM/admin + portal + landing
total_score: 16
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 3
target_identity: "file:C:\\Users\\Lenovo pc\\Desktop\\Solve-1\\apps\\web\\src\\App.tsx"
target_fingerprint: "sha256:63b61b8c8b6916774f550760297f329b9b80570b6275c75eab2f516ae30aac3b"
target_path: "C:\\Users\\Lenovo pc\\Desktop\\Solve-1\\apps\\web\\src\\App.tsx"
timestamp: 2026-09-27T13-40-40Z
slug: apps-web-src-app-tsx
---
Method: dual-agent parcial — A: subagente isolado `ses_f1d599c73ffeqOQzau1qBPvaLX` · B: NAO executou (subagente cancelado 2x); detector + evidencia de browser correram no contexto pai (permitido quando B falha).

Target: `apps/web/src/App.tsx` (1781 linhas, 43 componentes) · slug `apps-web-src-app-tsx` · modo **Operate** (CRM/admin).
Contexto: sem `PRODUCT.md`, sem `DESIGN.md`, sem `DESIGN.md` de sidecar.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | `Toaster` montado mas `toast()` nunca chamado (0 ocorrencias em 1781 linhas); `createCharge` fecha o modal e nao reporta nada ate 20s |
| 2 | Match System / Real World | 2 | Um pagamento tem cinco nomes; "Enviar SamoraFit Workout" nomeia um sistema, nao um resultado; tres nomes de produto (Solve / FitStudio / SamoraFit Workout) |
| 3 | User Control and Freedom | 1 | Sem undo em nenhum sitio; 5 `confirm()` nativos; 2 `window.location.reload()`; "Guardar vista" persiste 3 de 5 filtros |
| 4 | Consistency and Standards | 1 | Dois sistemas de label (`.form-label` vs `.label` inexistente, 28 usos); 2 implementacoes de modal; pt-PT / pt-AO / pt-BR |
| 5 | Error Prevention | 2 | `move()` faz write otimista e nunca faz rollback do erro; cascades destrutivos com 2 `confirm()` em vez de revogacao |
| 6 | Recognition Rather Than Recall | 2 | "Relatorio do dia" e bom; mas 4 `<select>` sem label, 8 valores de periodicidade em bruto, `Select…` como nome de plano |
| 7 | Flexibility and Efficiency | 2 | Sem pesquisa global, sem ordenacao de tabela, sem atalhos; `ui/sidebar.tsx` implementa Cmd+B/Cmd+K e e importado por ZERO ficheiros |
| 8 | Aesthetic and Minimalist Design | 1 | 10 cartoes de peso igual; 5 listas de barras identicas; 5 selects num unico modal; tabelas de 9 colunas |
| 9 | Error Recovery | 1 | `syncNow` faz `catch {}` e reporta so a `console.log`; falhas de `move()` invisiveis; filtro de Leads sem "limpar" |
| 10 | Help and Documentation | 2 | `INTEGRATION_DESC` e explicadores reais; mas nada ajuda a escolher um meio de pagamento e o filtro `Esgotadas` nunca e explicado |
| **Total** | | **16/40** | **Poor (12-19)** — deducoes estruturais (1/3/4/8/9), nao cosmeticas |

Nenhum heuristic marcado `n/a`: e uma superficie Operate, logo todos os 10 se aplicam. Maximo aplicavel = 40.

## Design Specificity Verdict

**LLM assessment: category-generic.** A casca e coerente — `PageHeader` / `Section` / `Metric` / `Status` / `EmptyState` dao a mesma anatomia as 15 rotas — mas coerencia nao e especificidade.

- **Sameness estrutural**: dois padroes de composicao para tudo. `'104px 1fr 32px'` + track de 8px repete-se verbatim no Funil (:352), em Origens (:353) e em Atividade por hora (:1789). Funil (ordinal), meios de pagamento (partilha nominal) e fluxo por hora (histograma de 24) sao tres formas de dados diferentes renderizadas com o mesmo markup.
- **Intercambiavel**: `--accent: 217 91% 17%` e numericamente identico a `--primary: 217 91% 17%` (index.css:458,464) — o token "accent" nao significa nada; todo uso de accent e apenas navy. Tipografia 100% Inter: `h1..h6 { Space Grotesk }` (index.css:528) e sobrescrito para `.shell, .portal` (index.css:601) e de novo para `.metric-value` (index.css:604) — e a linha 604 tambem impoe `letter-spacing:0`, matando o `-0.05em` optico de :585. A voz de display foi escrita e depois morta.
- **Oportunidades perdidas**: tres activos genuinamente distintos nao tem expressao visual. (1) os carris de pagamento angolanos sao *nomeados* (`M. Express`, `Referencia` — :929, :1144), o movimento mais especifico do produto, e sao duas strings num `<select>`. (2) `waLink()` (:148) transforma qualquer numero AO de 9 digitos num `wa.me/244…` — o canal comercial real de Luanda — renderizado como icone de 14px com `title` (:503, :1242). (3) `/admin/acesso-fisico` com `Liberar Entrada`/`Liberar Saida` (:1779-1784) e uma sala de controlo que nenhum SaaS de ginásio tem, e nao esta na navegacao.
- **O monolitio e um achado de design por si**: 43 componentes, 5 implementacoes independentes das mesmas 5 ideias (modal x10, select-estilizado x20, form x12, grafico de barras x5). A divergencia visual entre as duas metades do produto e consequencia directa: `LeadModal`/`LeadFicha`/`SettingsPage` usam `.form-label` e seem correctos; nove outros modais usam `.label`, **que nao esta definido em nenhum stylesheet**.

**Deterministic scan** (`impeccable detect --json`, exit 0):
- `apps/web/src/App.tsx` (target) → `[]`, **0 findings**.
- `apps/web/src` (117 ficheiros markup) → **20 findings**, todos `warning`/`advisory`, categoria `slop`/`quality`, **nenhum no target**:
  - `overused-font` x11 — `index.css:2,526,528,542,543,585,591,601,604,609` + `landing/index.css:1` (Inter e Space Grotesk)
  - `gradient-text` x6 — `index.css:793,799,1037`, `landing/index.css:247,254`, `landing/sections/Universo.tsx:73`
  - `codex-grid-background` x2 (advisory) — `index.css:930`, `landing/index.css:406`
  - `gray-on-color` x1 — `landing/Formacao.tsx:246` (`text-zinc-900` sobre `bg-blue-600`)

**Onde concordam**: o detector apanha a convergencia de fontes (Inter + Space Grotesk) que a avaliacao A identificou como "a voz de display foi sobrescrita" — `index.css:604` e literalmente o mesmo ficheiro/linha que o detector assinala. `gradient-text` em `index.css:1037` cai dentro do bloco inlined da landing (:1025-1072) que A财务报表ou como sobreposicao nao-scoped de `.btn-primary`.

**Onde o detector falhou (cegas monumentais)**: 0 findings no target, apesar de ter dentro de `App.tsx` dois P0 — a classe `.label` inexistente em 28 sitios, e o `createCharge` que fecha o modal antes do await. O detector e uma grelha anti-pattern de "slop" visual; nao deteta classes CSS em falta, fluxos assincronos sem feedback, nem navegacao ausente. **Nao se deve usar o exit 0 deste target como sinal de qualidade.**

**Falsos positivos / fora de scope**: os 20 findings sao quase todos de `slop` (gradientes decorativos, grelha de fundo) em `index.css` e `landing/`, e nenhum toca o target. Sao reais como achado estetico mas sao de superficies Persuade, nao do CRM. `landing/Formacao.tsx:246` e um problema de contraste genuíno e o unico de qualidade real.

**Visual overlays**: nao foi possivel injectar overlay nem apresentar overlay ao utilizador. O subagente de browser foi cancelado duas vezes. Corri eu a recolha no contexto pai: servidor Vite arrancado (exige `PORT` e `BASE_PATH`), Chrome headless `--dump-dom` + `--screenshot` em 4 rotas x 2 viewports. **Limitacao declarada: este modelo nao tem input de imagem, portanto nao inspeccionei visualmente os PNG.** A evidencia abaixo e de DOM/texto renderizado, nao de pixels. Screenshots em `C:\Users\LENOVO~1\AppData\Local\Temp\opencode\impeccable-critique\` (`dsk-*.png`, `mob-*.png`). Todos os servidores foram parados e confirmados parados.

## Evidencia de browser (DOM renderizado)

| Rota | Viewports | Estado | Texto visivel |
|------|-----------|--------|---------------|
| `/` | 1440x900, 390x844 | renderizou | 256 b — "Bem-vindo de volta / Acede ao CRM. / Email ou Telefone / Palavra-passe" + banner de cookies |
| `/admin` | 1440x900, 390x844 | **redireccionou para login** | 256 b — **DOM identico a `/`** (251753b vs 251696b) |
| `/conta/login` | 1440x900, 390x844 | renderizou | 210 b — "Portal do Cliente / Entrar com WhatsApp / Recebe um codigo de 6 digitos no teu WhatsApp" + "WhatsApp e staff? Entra aqui" |
| `/fit-studio` | 1440x900, 390x844 | renderizou | 2301 b — landing Persuade: "Ginasio Boutique Privado", planos Free Pass 89.000 Kz / Premium PT 249.000 Kz / Elite 499.000 Kz |

`/admin` **nao foi alcancavel**: `ProtectedRoute` redirecciona sem credenciais, e nao ha backend. O dashboard, tabelas e modais do CRM **nao foram observados** — a avaliacao do CRM e toda ela feita por codigo-fonte. Isto e uma limitacao real desta corrida.

**Achados de browser que a avaliacao A nao viu:**
1. **`<title>` = "Solve Corporate CRM" em todas as rotas, incluindo a landing publica de boutique** (`/fit-studio`confirmed). O titulo de um CRM interno e o titulo de um pagina de marketing de um ginásio de luxo.
2. **Tres nomes de produto no mesmo produto, agora confirmados no browser**: "Solve Corporate CRM" (title), "FitStudio" (landing, `/fit-studio`), "SamoraFit Workout" (admin, :904/:1347). E o portal assina "FitStudio" enquanto a moeda e `Kz`.
3. **Banner de cookies inconsistente**: aparece em `/`, `/admin` e `/fit-studio`, mas **nao** em `/conta/login`. Um banner de consentimento sobre a pagina de login interna do CRM e sobre a landing, mas nao sobre o login do cliente.
4. **CTA inconsistente para a mesma accao** na landing: "Agendar Visita" (hero) vs "Agendar Entrevista" (plano Elite).
5. **O portal faz do WhatsApp a porta de entrada de primeira classe** ("Entrar com WhatsApp", "Recebe um codigo de 6 digitos"), o que **contradiz parcialmente** A: o WhatsApp nao e so um icone de 14px — no portal e o mecanismo de identidade. A sobre-generalizou a partir do admin. Isto reduz a severidade do achado sobre `waLink`, mas mantem a critique: a frame do WhatsApp existe no portal e nao no admin, onde e onde o negocio acontece.

## Overall Impression

O que funciona e notavel e raro: os 5 estados vazios do dashboard **nomeiam a proxima accao** ("Sem receita ainda — cria uma cobranca em Pagamentos", :351), e a app explica sempre a **consequencia de negocio** de uma accao ("Ao confirmar pagamento, liberta o curso no SamoraFit Workout", :1347). Isto e o que separa um console operacional de um dashboard deivel.

O que falha e estrutural. A hierarquia esta invertida onde mais dói: na tabela de pagamentos o nome do cliente e `.79rem`/700 e **o valor e `.mono` a `.68rem` — ~11px, o texto mais pequeno da linha** (:1136). O numero que o utilizador abriu a pagina para ver e a coisa mais ilegivel dela. E a navegacao expoe 7 das 15 rotas.

**Maior oportunidade**: o dashboard esta desenhado para *ler numeros*, quando o trabalho de uma ginasio em Luanda e *perseguir pessoas*. Trocar os 4 cartoes de metrica por 4 perguntas ("3 pagamentos em atraso · resolver", "8 aulas esgotadas · contactar") colapsaria quatro paginas num so ecra.

## What's Working

1. **O conjunto de primitivas e a disciplina de conteudo.** `PageHeader` / `Section` / `Metric` / `Status` / `EmptyState` (:261-272) fixam a ordem de leitura e o registo para 15 rotas, e o slot `note` das secoes diz *porque* o numero importa em vez de repetir o label. Faz um monolitio de 1781 linhas parecer um produto so.
2. **Um vocabulario de frescura completo e consistente.** `.skeleton` com shimmer, `status-live` com `livePulse`, `fmtRel` → "ha 5 min" (:232-244), "A sincronizar…" + `animate-spin` em *cada* controlo de refresh, "A verificar…" (:351), e a cadencia de polling documentada (:48-51). Nada no produto mostra um spinner nu sobre uma regiao vazia nem um zero inexplicado. E aplicado sem excepcao.
3. **A app explica a consequencia de uma accao de negocio.** "Ao confirmar pagamento, liberta o curso no SamoraFit Workout" (:1347), "Configuracao guardada. Pagamentos confirmados passam a libertar acesso." (:1286), `INTEGRATION_DESC` mapeando cada fornecedor ao que faz de facto (:247-253), e a politica de retencao em linguagem simples (:1625-1633). Fecha a ligacao entre um pagamento e um membro a entrar numa aula.

## Priority Issues

### [P0] `.label` nao esta definido em lado nenhum: 28 labels de formulario renderizam como texto normal

- **What**: 28 `<label className="label">` — :594, 597, 599, 693, 696, 698, 701, 802, 804, 812, 1141, 1143, 1146, 1149, 1151, 1154, 1159, 1349, 1351, 1354, 1473, 1507, 1510, 1512, 1560, 1563, 1565. **Verificado**: `index.css` tem **0** regras para `.label` e **2** para `.form-label` (diferenca de um caracter), que `LeadModal`, `LeadFicha` e `SettingsPage` usam correctamente. Existe tambem o problema adjacente: 5 selects sem `aria-label` em :503, :1144, :1374, :1511, :1513.
- **Why it matters**: no formulario "Nova cobranca" (:1137-1166) — o formulario do dinheiro — "Montante (Kz) *" aparece com o mesmo tamanho, peso e cor do valor dentro do campo abaixo, em `display:inline` e sem gap; so o `*` os distingue. O mesmo em criar/editar plano, editar cliente, configuracao de integracoes, automacoes e convite de utilizador. E torna o produto bilingue: formularios identicos parecem correctos ou consoados conforme o ficheiro onde vivem.
- **Fix**: renomear os 28 para `form-label`; tornar o marcador de obrigatoriedade um `.req` real (`color: var(--destructive)`, `aria-hidden`) mais `aria-required` no input; dar a cada `<select>` nu um `<label>` ou `aria-label`.
- **Suggested command**: `typeset`

### [P0] Criar um pagamento: o modal fecha, e depois nada acontece durante ate 20 segundos

- **What**: `createCharge` (:1038-1074) chama `setChargeOpen(false)` e `setCharging(false)` em :1047-1049 **antes** de awaitar o POST, com um `AbortController` de 20s (:1053) e reverificacao silenciosa aos 15/45/90s (:1067). A falha reabre o modal com uma linha de texto (:1070-1072). `PaymentDetailModal` faz `window.location.reload()` em :845 e :862. **Verificado**: 2 `location.reload()`, 0 chamadas a `toast()` em 1781 linhas apesar do `Toaster` montado em :1854. O estado "A gerar…" (:1164) e codigo morto porque `charging` ja e `false` antes do request.
- **Why it matters**: e a accao primaria de dinheiro. O utilizador fica com um estado financeiro ambiguo, sem recibo, sem progresso e sem notificacao — o proprio texto de erro da app admite a ambiguidade: *"Verifica a lista — o pagamento pode ter sido criado"* (:1071). Um utilizador financeiro a trabalhar uma fila perde scroll, filtros e estado do modal num reload completo em :862.
- **Fix**: manter o modal aberto num estado `pending` com progresso determinado, bloquear inputs, e resolver **no local** para um recibo (codigo, entidade, referencia, valor, prazo) + "Ver em Pagamentos". Em timeout, mostrar uma faixa de reconciliacao, nunca um reabertura silenciosa. Substituir os dois `reload()` por `qc.invalidateQueries` / `setQueryData` — o padrao de cache otimista ja existe em :521. E usar o `Toaster` que ja esta montado.
- **Suggested command**: `harden`

### [P1] Metade do admin nao tem navegacao, e a barra superior gasta 65px com um relogio

- **What**: `navGroups` (:222-227) lista **7** itens; existem **15** rotas `/admin` (:1815). Faltam: Planos, Automacoes, API & Webhooks, Utilizadores, Auditoria, Definicoes, **Acesso Fisico**. **Verificado**: 15 `Route path="/admin"`, 7 itens em `navGroups`. O badge `auditCount` (:285) testa `item.label === 'Auditoria'` — impossivel, logo o `CRM` faz poll de uma query de auditoria de 5 minutos em todas as paginas (:1802-1803) para alimentar codigo morto. Nao ha breadcrumbs. A `Topbar` (:289-293) tem a **metade esquerda completamente vazia** em todas as paginas (`marginLeft:'auto'`) e contem apenas uma data `pt-AO` e um avatar de iniciais. Confirmado no browser: em `/admin` (que sem auth cai no login) a unica accao e a palavra-passe.
- **Why it matters**: um gestor de ginasio nao tem caminho para a sala de control da catraca — a porta da frente do negocio (:1779-1784) — nem para Definicoes ou Utilizadores. `/admin/clientes/:id` (:1814) so escapa com o botao Back do browser. Os 65px do topbar gastam-se num relogio ao lado da maior falha estrutural da app.
- **Fix**: quatro grupos cobrindo as 15 rotas — *Comercial* (Leads/Funil/Clientes) · *Receita* (Pagamentos/Planos) · *Operacao* (Acesso Fisico/SamoraFit/Integracoes) · *Governacao* (Utilizadores/Automacoes/Auditoria/API/Definicoes); ligar o badge a Auditoria; por um breadcrumb + pesquisa global na metade esquerda vazia do `Topbar`.
- **Suggested command**: `clarify`

### [P1] A navegacao primaria e so de rato: 4 `<div onClick>` sao o caminho para Pagamentos

- **What**: `Metric` e `<div onClick>` sem `role`, sem `tabIndex`, sem handler de teclado (:265) — e no dashboard esses 4 cartoes **sao** a navegacao para Pagamentos e Pipeline (:347). O mesmo nos 7 tiles de filtro de Leads (:503) e em cada cartao do pipeline (:531). 9 de 10 modais nao tem `role="dialog"`, `aria-modal`, focus trap nem Escape (:591, :690, :800, :1137, :1383, :1470, :1504, :1557, :1625); o unico componente `Modal` (:273) tem `role` mas tambem nao tem trap nem Escape. A matriz de permissao (:1556) renderiza uma matriz de 5 roles como **uma coluna fixada no header "Administrador"** (`roles.slice(0,1)`, **verificado**) independentemente da role seleccionada, com as concessoes mostradas como um `CheckCircle2` verde sem texto. `index.html` tem `lang="en"` e `maximum-scale=1` (desactiva o pinch-zoom). **Verificado**: `roles.slice` = 1 ocorrencia; 0 referencias a `ui/sidebar` em todo o `apps/web/src` (logo os atalhos Cmd+B/Cmd+K estao implementados e mortos).
- **Why it matters**: um utilizador de teclado ou de leitor de ecran nao consegue chegar a "Em atraso" — o numero que o traz ao ecrã. E quando escolhe Financeiro, a tabela que aparece esta rotulada "Administrador", o que e pior do que nao mostrar nada: e uma resposta errada apresentada como facto.
- **Fix**: `Metric` e os tiles de filtro como `<button>`/`<Link>` com `aria-current`; um unico `Dialog` com focus trap, Escape e `aria-labelledby` para os 10 modais; a matriz de roles a iterar `roles` com coluna por role e `aria-pressed` nos toggles; `<label>` ou `aria-label` em todos os selects; `lang="pt"` e remover `maximum-scale=1`.
- **Suggested command**: `harden`

### [P1] Cinco listas de barras identicas, e o grafico de receita diz "Este mes" e mostra quatro

- **What**: `'104px 1fr 32px'` + track de 8px repetido verbatim no Funil (:352), em Origens (:353) e em Atividade por hora (:1789); receita como div-bars (:351); meios de pagamento como lista com borda (:354). O toggle de intervalo le `chartRange === 'mes' ? 'Este mes' : 'Periodo total'` (:351) enquanto :346 renderiza `revenueData.slice(-4)` — **quatro meses** (**verificado**: 1 ocorrencia de `slice(-4)`). As barras nao tem eixo nem valores; so o `title` nativo (:351). `Metric` tem um prop `trend` (:265) com todo o vocabulario de setas + `text-good`/`text-bad` que **nunca e passado em nenhum dos 14 call sites** (**verificado**: 0 ocorrencias de `trend=`), apesar do subtitulo "Resumo comercial e financeiro em tempo real" (:347).
- **Why it matters**: "Este mes" a mostrar quatro meses e uma falha de correccao — e assim que um gestor decide se ha cobranca em atraso. E numa superficie Operate, cinco padroes identicos treinam o olho a parar de ler: "Origens de leads" le-se como "Atividade por hora" porque o markup e o mesmo. O dashboard promete "tempo real" sem entregar um unico delta.
- **Fix**: corrigir primeiro o desfasamento intervalo/label ("Ultimos 4 meses" / "12 meses" / "Tudo"); dar a cada painel a forma que os seus dados merecem — funil como quadro de etapas com conversao inter-etapa, meios de pagamento como lista ordenada de partilha, horas de pico como histograma real de 24 bins; ligar deltas reais aos 4 cartoes do dashboard e aos 4 de pagamentos, ou apagar o prop; substituir `title` por labels de valor.
- **Suggested command**: `distill`

## Persona Red Flags

**Alex — power user. Accao primaria: mover um lead no pipeline e registar uma chamada.**
- Procura Cmd+K e Cmd+B. Nenhum existe. `components/ui/sidebar.tsx:33,99-110` implementa **ambos** — e e importado por **zero** ficheiros (**verificado** por grep).
- A unica forma de mudar de etapa e um `<select>` a `fontSize:'.66rem'` (10.6px) com `padding:'.2rem .45rem'` — um alvo de ~20px — aninhado dentro de um cartao clicavel que abre o modal, obrigando a `e.stopPropagation()` no `onClick` e no `onChange` do select (:531). Sem drag, sem atalho.
- Duas UIs de etapa concorrentes a dois tamanhos: esse de 10.6px no pipeline, e um `.68rem` por linha na tabela de Leads (:503). Nao sabe qual e a canonica.
- `move()` (:518-523) nao tem caminho de erro: numa ligacao instavel o cartao recua 300ms depois e ela nao sabe se gravou.
- "Guardar vista" (:496) persiste so `q/status/source`. A vista que ela construiu com Responsavel + Sem acompanhamento volta errada, anunciada apenas por "Vista guardada" durante 2 segundos.
- `syncNow`'s `catch {}` (:1082) devolve o botao a inactivo sem erro, com os dados desatualizados.

**Sam — utilizador dependente de acessibilidade. Accao primaria: ler os numeros de hoje, depois abrir um pagamento.**
- Os quatro numeros **sao** a navegacao (:347) e sao `<div onClick>` sem `role`/`tabIndex` (:265). Nao consegue tabular ate "Em atraso" nem activa-lo. O mesmo nos 7 tiles de Leads (:503) e em cada cartao do pipeline (:531).
- Os quatro `<select>` sem label (:503) anunciam-se como quatro caixas de combinação sem nome.
- `.label` (28 sitios, p.ex. :1141) renderiza como texto normal, portanto no formulario de pagamento o nome do campo e o seu valor sao tipograficamente identicos — nao sabe onde um campo comeca.
- A lista "Equipa" (:1556) e uma coluna de `<button>` que sao selectores de role. Escolher Financeiro mostra uma matriz cuja coluna continua a ler **"Administrador"**, com as concessoes so por um `CheckCircle2` verde sem texto.
- 9 de 10 modais sem `role="dialog"`, sem `aria-modal`, sem trap, sem Escape (:591, :690, :800, :1137, :1383, :1470, :1504, :1557, :1625). `index.html` tem `lang="en"` e `maximum-scale=1`.
- **A dar o que e justo**: o anel global `:focus-visible` (index.css:625) e `prefers-reduced-motion` (:631-634) estao correctos e a toda a app — pelo menos sabe onde esta.

**Casey — utilizador movel distraido, no chao do ginasio. Accao primaria: verificar se entrou um pagamento.**
- O topbar movel tem 65px com exactamente **uma** accao: o hamburger. A data e o avatar sao `.desktop-only` (index.css:638, :293). Sem logotipo, sem identidade de pagina, sem sign-out, sem pesquisa.
- Tudo e uma tabela de scroll horizontal: pagamentos 7 colunas (:1136), clientes 8 (:590), leads 9 (:503) — cada uma com selects por linha. `sticky-first` esta aplicado so a duas tabelas (:1375, :1379); a tabela de Leads **nao** fixa o nome, portanto ao deslizar para a direita perde de quem e a linha.
- O valor pelo qual veio e o texto mais pequeno da linha — `.mono` a `.68rem` contra o nome a `.79rem`/700 (:1136).
- Para cobrar: hamburger → Pagamentos → "Nova cobranca" → um formulario cujos labels sao invisiveis (P0-1) → e depois 20s de nada (P0-2).
- O drawer (:639-641) nao tem trap, nem Escape, nem swipe-to-dismiss, e o overlay e um `div` nu com `onClick` (:641) que fecha com um toque errado.
- **A dar o que e justo**: `PortalShell` (:39-59) e a unica superficie verdadeiramente correcta para movel — barra de abas fixa em baixo com `env(safe-area-inset-bottom)`. E o padrao que o topbar do admin deveria pedir emprestado.

## Minor Observations

- `index.html:7-8` envia `<title>Solve Corporate CRM</title>` e a meta description **"Solve Corporate CRM - built on Replit. Update this description to reflect the app."** — confirmado no browser em todas as 4 rotas. Um comentario de scaffold em metadata de producao, num produto de ginasio de luxo.
- **Confirmado no browser**: o titulo e "Solve Corporate CRM" tambem na landing publica `/fit-studio`.
- **Confirmado no browser**: banner de cookies em `/`, `/admin` e `/fit-studio`, mas **nao** em `/conta/login`.
- **Confirmado no browser**: CTA inconsistente na landing — "Agendar Visita" (hero) vs "Agendar Entrevista" (plano Elite).
- **Confirmado no browser**: tres nomes de produto — "Solve Corporate CRM" (title), "FitStudio" (landing), "SamoraFit Workout" (admin :904/:1347).
- **Confirmado no browser**: o portal trata o WhatsApp como porta de entrada de primeira classe ("Entrar com WhatsApp", "codigo de 6 digitos") — o que corrige partially a leitura da avaliacao A de que o WhatsApp e so um icone de 14px. No admin continua a ser so isso.
- `--color-brand-red: #042251` (index.css:669) e um **azul** escuro. Nome de token errado; vai enganar o proximo.
- `index.css:85-145` tem ~30 tokens posto a `red` com o comentario *"replace with H S L"*; todos sao redeclarados em :440-485, portanto mortos — mas leem-se como o tema.
- O bloco inlined da landing (index.css:1025-1072) tem `.btn-primary`/`.btn-secondary` **nao-scoped** (:1029, :1031) a sobrepor os botoes compactos do admin (:544, :546) com o gradiente da landing, e um hover que enche navy atras de texto quase preto (:1032).
- `.dark` e aplicado por `landing/context/ThemeContext.tsx:46-51`, montado so dentro de `LandingLayout` e nunca removido no unmount → `/admin` e `/conta/*` herdam o que a landing deixou por ultimo, e depois aplicam valores de hover do light-mode fixos (:540, :545, :547).
- `money()` esta duplicado verbatim tres vezes: App.tsx:229, MinhaConta.tsx:14, Pagamentos.tsx:7. `statusTone`/`statusLabel` (MinhaConta.tsx:17-33) duplicam e divergem de `mapApiCustomer` (:205) — o admin diz "Em atraso", o portal mostra `em_atraso` cru a um membro de ginasio (Pagamentos.tsx:110).
- `.metric-grid`, `.content-grid`, `.page-content`, `.toolbar` estao declaradas como classe real **so dentro de media queries** (:644-646); no desktop sao o que o `gridTemplateColumns` inline disser (:347, :1129, :1737).
- `.metric::after` (:584) recorta um circulo de acento de 72px em cada cartao de metrica, incluindo os 7 tiles compactos de filtro, onde nao significa nada. Ornamento puro, e colide com o texto da nota.
- `PlansPage` (:799) afirma "Mais subscrito" a partir do indice de array `i === 0`; todos os outros cartoes sao `Plano 0${i+1}`.
- `body { min-width: 320px }` + `html, body { overflow-x: clip }` (index.css:525-526) corta o overflow em vez de permitir scroll — com as tabelas largas, conteudo pode ser cortado em silencio.
- `refetchOnWindowFocus: false` (:49) e defensavel para a quota do Neon, mas combinado com o ponto vivo pulsante (:1736) sobre-promete frescura.
- 34 dos 52 primitivos em `components/ui/` nao sao importados por nada — incluindo `chart.tsx` (366 linhas, Recharts), `alert-dialog`, `dialog`, `table`, `select`, `tabs`, `empty`, `switch`, `breadcrumb`, e o `sidebar` de 727 linhas. As substituicoes bespoke da app para `Modal`, `<aside>`, `.select`, `.data-table` e os toggles sao todas menos capaces.
- `pages/not-found.tsx` e `pages/login.tsx` (o unico consumidor de `useToast`) sao restos sem rota; `/` e `/login` vao ambos para `landing/Login` (:1841-1842).
- **Correccao a uma alegacao da avaliacao A**: `confirm()` sao **5** ocorrencias, nao 10. A lista de linhas que A deu inclui `alert()` e sitios aninhados. A severidade do achado mantem-se, o numero estava errado.
- **Nota de encoding**: `App.tsx` e UTF-8 valido **com BOM**. Ler com `Get-Content` sem `-Encoding UTF8` em PowerShell 5.1 faz os acentos aparecerem como `?`. Verificado por decodificacao UTF-8 estrita. Nao ha corrupcao de encoding.

## Questions to Consider

1. Os 4 cartoes do dashboard sao links (:347); os 7 tiles de Leads sao filtros (:503); o mesmo componente e um link, um filtro e uma leitura. E se o objecto primario do dashboard nao fosse um *numero* mas uma *pergunta* — "3 pagamentos em atraso · resolver", "8 aulas esgotadas · contactar"? Para uma ginasio em Luanda o trabalho e perseguir, nao ler. Um dashboard em forma de tarefa colapsaria quatro paginas e apagaria os paineis Funil, Origens e Metodos.
2. `waLink` (:148) ja transforma qualquer numero angolano de 9 digitos num `wa.me/244…` — e esse o canal real deste mercado. E se o WhatsApp fosse a *frame*: um cartao de lead com a ultima mensagem, um lembrete de cobranca que sai da propria linha, "cobranca pendente ha 6 dias" a abrir uma conversa pre-preenchida? A defesa de um CRM de ginasio em Luanda e a conversa, nao o grafico de barras. (O portal ja faz metade disto — ha ai um padrao para copiar.)
3. O grafico de receita sao 4 divs desenhadas a mao (:351) e `components/ui/chart.tsx` (Recharts, 366 linhas) esta sem uso. A restricao e orcamento de render, ou ninguem ficou dono da especificacao do grafico? A receita mensal de uma ginasio sao 4–8 barras — o que um designer poria ali que uma folha de calculo nao consiga?
4. `LEAD_RESULTADOS` (:93) e `LEAD_PASSOS` (:94) transformam registar uma chamada de WhatsApp em 5 selects e um espaco de 5x7 opcoes (:440-442). Podia "Registar contacto" reduzir-se a *resultado* + *proxima data*, com o resto inferido da mensagem que o utilizador acabou de enviar?
5. Apagar um plano cascateia por subscricoes e pagamentos, e a app avisa que o historico "some do Controlo e do site" (:782). E *aposentar* um plano — soft-delete, manter historico, bloquear novas vendas — alguma vez esta realmente errado? Se nao, porque e o caminho destrutivo o default, e porque e o unico com dois `confirm()`?
6. A navegacao esta agrupada como Visao geral / Operacao comercial / Receita e acesso / Ecossistema (:222-227) — uma estrutura derivada do codigo, nao do dia de um gestor. E se espelhasse o dia: *Manha* (follow-ups, aulas esgotadas, cobrancas) · *Dia* (receita, pagamentos) · *Semana* (leads, pipeline) · *Configuracao*? Hoje "Acesso Fisico" — a porta da frente de uma ginasio — esconde-se sob "Ecossistema", palavra que nao significa nada para uma rececionista.
7. O portal renderiza o mesmo pagamento noutro dialeto do admin (`em_atraso`, `confirmado` crus vs "Em atraso", "Confirmado"). Quando um membro ve uma coisa e uma rececionista ve outra, qual e a voz do produto — e um vocabulario de estado deveria ser propriedade central, como `LEAD_API_TO_PT` (:58) ja e para os leads?

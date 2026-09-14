# CRM Admin — manual por página (`/admin`)

Login staff em `/login` (email + senha). Menu lateral (☰ no telemóvel).

## Dashboard (`/admin`)
Saudação, receita 30 dias, cobranças pendentes, clientes ativos, aulas esgotadas,
bloqueados, negados hoje, no ginásio agora. Métricas clicáveis (saltam filtradas),
gráfico de receita, saúde do ecossistema, relatório do dia copiável, paleta `⌘K`.
Atalhos aceitam `?filtro=`, `?resultado=`, `?data=`, `?search=`.

## Pipeline (`/admin/pipeline`) e Leads (`/admin/leads`)
Kanban de oportunidades (6 colunas), valores e conversão; tabela de leads com busca,
filtros de estado/origem/responsável e modal criar/editar. `Novo cliente` cria lead de balcão.

## Clientes (`/admin/clientes`, `/admin/clientes/:id`)
Registos únicos (espelho OVG + catraca). Filtros: Todos/Activo/Inactivo/Bloqueado/
Em atraso/Esgotadas. Importar CSV (`code,ovg_id,name,joined_at`). Perfil 360º: conta,
aulas restantes, ações (ver acessos, WhatsApp `wa.me`), edição de nome/telefone/email.
Sócios vs funcionários: nome completo + ≤3 entradas/dia (regra automática).

## Planos (`/admin/planos`)
Catálogo: nome, descrição, preço Kz, periodicidade (avulso→anual), ativo. CRUD completo.

## Pagamentos (`/admin/pagamentos`)
Ver `02-PAGAMENTOS.md`. Métricas Recebido/Pendente/Em atraso/Cancelado, busca,
datas, filtro de estado, **Nova cobrança** (montante, método, telefone, nome, email,
conteúdo Cademi com preço automático), detalhe com **Verificar Estado** e
**Enviar Cademi**, **Sincronizar Pay4All**.

## Acesso Físico (`/admin/acesso-fisico`)
Tempo real da catraca (SSE Live/Offline): ativos, terminais, acessos hoje; filtros
data/resultado; Entradas/Saídas; libertar catraca; clientes dentro agora.

## Cademi (`/admin/academia`)
Ver `03-ACADEMIA-CADEMI.md`. Cursos, alternador **Ver pagamentos / Ver alunos**,
controlo de pagamentos por aluno, detalhe do aluno (acessos + progresso),
config de acesso automático e preços, Sincronizar (liga por email).

## Integrações (`/admin/integracoes`)
Estado OVG/Pay4All/Cademi/WhatsApp/Website, Sincronizar tudo, configurar credenciais
e testar ligação.

## Automações, API & Webhooks, Utilizadores, Auditoria, Definições
Regras por eventos; endpoint base + chave; convites e permissões por papel;
log de eventos com CSV e reprocessamento; preferências do workspace (retenção 90 dias).

# Academia / Cademi — cursos, acesso automático e widget

## Conceitos
- **Produto**: curso na Cademi (ex. `SamoraFit Workout`, id `628509`).
- **Entrega**: regra que liberta o produto (ex. slug `samorafit-workout`,
  entrega `#268060 "SamoraFit Workout - Pay4All"`). A API `entrega/enviar`
  usa o **slug**, sem campo `token` (só header Bearer).
- Preços **não existem na API** — vivem na vitrine (display) e na nossa tabela
  (cobrança). Aulas novas dentro do produto entram sozinhas.

## Acesso automático (padrão)
`Cademi → Acesso automático`: entrega padrão + envio **Ligado** + **preços por
conteúdo** (linhas da lista). Ao confirmar pagamento com email: `POST
/entrega/enviar {codigo, aprovado, produto_id(slug ou o da cobrança),
cliente_nome, cliente_email}` → venda **Processado** → aluno com acesso.
Sem email, não envia ("sem email"). Idempotente (`cademi_delivery=sent`).
 Conteúdo sem preço = "disponível em breve", não selecionável.

### Entrega imediata após o pagamento
Três mecanismos garantem o acesso logo após a confirmação (o webhook é só um
deles e pode falhar/atrasar):

1. **Gatilho do widget:** `pay-widget.js` chama `POST
   /api/v1/payments/:code/cademi-sync` (público, com o email do pagamento como
   prova de posse + rate-limit) assim que vê o pagamento confirmado, forçando a
   entrega na Cademi sem esperar pelo webhook.
2. **Webhook/auto-sync:** `applyWipayConfirm` / webhook É-kwanza / auto-sync
   chamam `sendCademiDelivery` na transição para `confirmado`.
3. **Reentrega periódica (`[CADEMI-RETRY]`, a cada 2 min):** pagamentos
   confirmados com `metadata.cademi_delivery != 'sent'` são reenviados até 25
   tentativas (`metadata.cademi_attempts`), dentro de 48h. Cobre erros
   transitórios e `sent_unverified`.

Uma entrega com **produto explícito** no pagamento (`metadata.cademi_produto`,
escolhido no widget) entrega mesmo que `cademi_auto_delivery` não esteja a `1`;
a flag da Academia só é exigida quando o pagamento não traz produto.

## Botão manual
Detalhe do pagamento → **Enviar Cademi** (backfill/teste). Erros típicos:
"por configurar", "sem email", mensagem da Cademi.
Reenvio forçado (pagamento já marcado): `POST
/api/v1/payments/:code/cademi-delivery?force=1` (auth admin).

## Quando o pagamento está Pago mas o acesso não aparece
A entrega só conta como feita se o acesso existir mesmo na Cademi
(`metadata.cademi_verified=true`). Se ficar `sent_unverified`, a Cademi
aceitou o `/entrega/enviar` (Carga processada) mas não criou acesso. O
`[CADEMI-RETRY]` reenvia sozinho até criar acesso; se persistir:
1. Cademi → Vendas: procurar o `codigo` (ex. `SCMUOE7GZM`) — está Processado?
2. Cademi → entrega `#268060`: regra ativa? produto certo? envio ligado?
3. No CRM: detalhe do pagamento → **Enviar SamoraFit Workout** (reenvia e
   volta a verificar). A resposta crua fica em `metadata.cademi_resp`.
Diagnóstico no CRM → detalhe do pagamento → Metadados: `cademi_delivery`
(`sent`/`sent_unverified`/ausente), `cademi_verified`, `cademi_attempts` e
`cademi_resp` dizem exatamente em que passo falhou.
No widget, quem pagou sem acesso ativo vê: "Pagamento recebido, acesso
ainda a ativar — faz logout e entra de novo; se não aparecer, fala
connosco" (em vez de só voltar a oferecer Pagar).

## Controlo de pagamentos × Alunos
Alternador **Ver pagamentos / Ver alunos** (sem scroll). Tabela: pagos, total,
pendentes, último, estado (Em dia/Pendente/Sem registo); 👁️ abre detalhe do
aluno (acessos, validade, progresso). Gestão do aluno: editar dados, tags,
sincronizar por email.

## Widget de pagamento (dentro da Cademi)
Instalação (Cademi → Código personalizado, `<head>`):
```html
<script src="https://solve-sqoh.onrender.com/pay-widget.js"></script>
```
Botão 💳 (só com login) → modal: conteúdo (sem pré-seleção; pago mostra tempo
restante e bloqueia; sem preço = em breve), montante só leitura, Express
(com telefone) / Referência (sem telefone), nome/email só leitura (auto:
memória + login + busca oficial), **Os meus pagamentos (N)** em modal próprio
(histórico com referências, copiar só número, cancelar), 1 pendente de cada vez,
revalidação anti-race no clique). Após pagar confirmado, o widget espera que o
acesso apareça (`/cademi/acesso`) e **recarrega a página automaticamente** para o
desbloquear; se o acesso não aparecer dentro de ~36s (ou a quota do lookup
esgotar), cai para logout (usa o link "sair" da página). Diagnóstico: `?spw_debug=1`.

### Neutralizar o redirect de login da Cademi
Existe no Código personalizado da Cademi um script (snippet "Telefone Angola
Padrao") que força `/auth/login` → `/auth/cadastrar` quando o URL não traz
`from=cadastrar`/`modo=login`. Com sessão iniciada isso gera
`ERR_TOO_MANY_REDIRECTS`. Como o `pay-widget.js` carrega no `<head>` (antes do
script inline no `<body>`), marca `modo=login` via `history.replaceState` no
`/auth/login` (`neutralizaRedirectCademi`), sem navegação e sem afetar o POST do
formulário. Ideal é remover o bloco original no painel; até lá, o widget impede
o loop.

Além disso, o `pay-widget.js` injeta CSS que torna os avisos de sucesso das telas
de acesso (`.ta-aviso-sucesso`, ex. "verifique o seu email" após o cadastro ou
"senha enviada para o seu e-mail") mais nítidos: texto preto e em negrito —
sem afetar os avisos de erro (`.ta-aviso-erro`).

## Criar novo produto para vender
1. Cademi: produto + entrega Customizada (30 dias) + preço na vitrine.
2. Nada a dar a ninguém: o slug entra sozinho na lista (derivado do nome).
3. Pôr o preço em `Cademi → Preços por conteúdo` → Guardar.

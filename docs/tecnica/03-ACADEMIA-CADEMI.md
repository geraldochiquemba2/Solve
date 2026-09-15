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

## Botão manual
Detalhe do pagamento → **Enviar Cademi** (backfill/teste). Erros típicos:
"por configurar", "sem email", mensagem da Cademi.

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
revalidação anti-race no clique. Após pagar: se a aula não aparecer, sair/entrar
(sessão Cademi só carrega acessos ao entrar). Diagnóstico: `?spw_debug=1`.

## Criar novo produto para vender
1. Cademi: produto + entrega Customizada (30 dias) + preço na vitrine.
2. Nada a dar a ninguém: o slug entra sozinho na lista (derivado do nome).
3. Pôr o preço em `Cademi → Preços por conteúdo` → Guardar.

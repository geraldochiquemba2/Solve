# Portal do cliente (`/conta`)

Área do aluno, separada do admin, em `solve-sqoh.onrender.com/conta`.

## Entrar (`/conta/login`)
Login sem senha: 1) telefone `9XXXXXXXX` → recebe código de 6 dígitos (5 min,
3 tentativas, reenvio após 30s); 2) confirma → entra. Sessão própria
(`portal_token`), independente do admin.

## Minha Conta (`/conta`)
Nome/telefone/estado, plano e validade, aulas restantes (barra vermelha a 0),
próxima mensalidade (valor/vencimento), campo Multicaixa Express (editável),
**Pagar Express** (aprova no telefone) e **Gerar Referência** (entidade+número+
validade + copiar), histórico recente com recibo.

## Pagamentos (`/conta/pagamentos`) e Recibos (`/conta/recibos/:id`)
Histórico (filtros todos/pendente/confirmado), detalhe com entidade/referência/
método, recibo imprimível.

## Regras
Valem as mesmas de `02-PAGAMENTOS.md`: 1 pendente de cada vez, cancelamento
próprio, pago liberta curso sozinho.

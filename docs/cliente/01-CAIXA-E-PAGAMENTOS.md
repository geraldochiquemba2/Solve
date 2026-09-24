# Caixa e pagamentos

## Cobrar mensalidade (Multicaixa Express)

1. Abrir `/admin` → Pagamentos → Nova cobrança.
2. Escolher o sócio e o plano, confirmar o valor.
3. Dizer ao cliente: abrir **Multicaixa Express** no telefone e aprovar.
4. O estado muda sozinho para **confirmado** (até ~1 min). Carregar em
   **Sincronizar** se demorar.

## Cobrar por Referência

1. Criar a cobrança como acima, mas escolher **Referência**.
2. Entregar ao cliente no papel ou WhatsApp: entidade + referência + valor + prazo.
3. O cliente paga no ATM ou aplicativo do banco.
4. O estado confirma sozinho. Se passar o prazo, fica **expirado** — criar nova.

## Se ficar preso em pendente

1. Clicar **Sincronizar** na cobrança e esperar 1 min.
2. Confirmar no extrato É-kwanza (conta **06100363**) se o dinheiro entrou.
3. Se entrou e continua pendente: anotar hora + sócio + valor e chamar o
   responsável. **Nunca cobrar duas vezes** sem ver o extrato.
4. Se não entrou: cancelar/expirar e criar nova cobrança.

## Fecho de caixa (fim do dia)

1. `/admin` → Pagamentos → filtrar **hoje + confirmado**.
2. Somar e comparar com o extrato É-kwanza.
3. Divergência? Ver `04-O-QUE-FAZER-QUANDO.md` antes de fechar.

Nota: o primeiro acesso da manhã pode demorar ~1 min (servidor estava a dormir).
É normal no plano gratuito.

# Pagamentos — estados, regras e operação

## Criar cobrança
`Pagamentos → Nova cobrança`: montante, método (**M. Express** precisa telefone
`9XXXXXXXX`; **Referência** gera entidade+número), nome + email do aluno
(obrigatório para libertar curso), conteúdo Cademi (preço preenche sozinho),
descrição. O modal fecha de imediato; o envio à É-kwanza corre em background.

## Estados
`pendente` → `confirmado` (pago) / `rejeitado` (mostrado como **Cancelado**) /
`expirado` (24h sem pagar) / `em_atraso` / `reembolsado`.

## Regras automáticas
- **1 pendente por aluno**: segunda cobrança com mesmo email/telefone dá `409`
  (paga ou cancela a aberta primeiro).
- **Sem duplo pagamento de curso**: com acesso ativo, nova cobrança do mesmo
  conteúdo é recusada (`409`).
- **Cancelamento do aluno**: só pendente próprio (confere email/telefone);
  cancelado nunca reabre, mesmo com callback tardio.
- **Expiração**: `expires_at = +24h`; job de 5 em 5 min marca `expirado`.
- **Deteção de pago**: webhook É-kwanza + sync automático 60s + botão Sincronizar
  + re-verificações 15s/45s/90s após criar + SSE em tempo real.
- **Referência**: gerada em background (`REF_...`); se falhar, erro fica em
  `metadata.ekwanza_error` e regenera ao "Verificar Estado". Telefone nunca vai
  para referência (a É-kwanza recusa).
- **Confirmado liberta curso** sozinho (ver `03-ACADEMIA-CADEMI.md`).

## Erros comuns
| Sintoma | Causa provável | Ação |
|---|---|---|
| Preso em `pendente` | cliente ainda não aprovou | aguardar/auto-sync; Sincronizar |
| `409 já tens pendente` | cobrança aberta | pagar/cancelar a aberta |
| `409 acesso ativo` | curso já libertado | nada a fazer |
| Referência sem número | config `REF` em falta / falhou | ver `ekwanza_error`; Verificar Estado regenera |
| `expirado` | passou 24h | gerar nova cobrança |

## Reconciliação
Pagos mostram **Conciliado**; `paid_at`/`reconciled_at` gravados; conta destino
É-kwanza **06100363** — conferir no dashboard Pay4All pelo código `SC...`.

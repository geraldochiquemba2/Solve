# RUNBOOK — resolver em 5 minutos

| Sintoma | Causa provável | Ação | Escalar para |
|---|---|---|---|
| Site lento 1ª vez | Render Free hibernou | Aguardar ~1 min; ver `/healthz` Live no Render | Subir para Starter (~7 USD/mês) |
| Página velha após deploy | bundle em cache | Hard refresh Ctrl+Shift+R; confirmar deploy Live | — |
| Pagamento preso em pendente | webhook É-kwanza não chegou | CRM → Sincronizar; ver `metadata.ekwanza_error` | Suporte É-kwanza + logs Render |
| Referência sem número | falha GPO | Verificar Estado regenera | — |
| Cademi "Com erro" | venda recusada na Cademi | Abrir Vendas na Cademi, copiar motivo | Suporte Cademi |
| Login loop | token velho | Limpar cookies/localStorage (`token`, `portal_token`) | — |
| JWT inválido | `JWT_SECRET` mudou | Novo login; confirmar env no Render | Técnico |
| CORS bloqueado | origem não permitida | Confirmar `CORS_ORIGIN`/`FRONTEND_URL` no Render | Técnico |
| OVG login 401 | password rodada/expirada | Atualizar `OVG_PASSWORD` no Render + `settings` | Responsável OVG |
| Deploy mau | build falhou | Render → rollback para deploy anterior; `git revert` | Técnico |
| BD corrompida | — | Restore PITR Neon num branch, validar, promover | Dono Neon |

Contactos e contas: ver `ENTREGA-SAMORAFIT.md`.

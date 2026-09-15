# Base de dados (Neon Postgres)

## Tabelas principais
- **`payments`**: `code (SC...)`, `customer_id?`, `amount`, `method`
  (`mcx_express|referencia`), `status` (`pendente|confirmado|rejeitado|
  reembolsado|em_atraso|expirado`), `reference_code`, `entity`,
  `ekwanza_code`, `ekwanza_operation_code`, `paid_at`, `reconciled_at`,
  `expires_at`, `metadata` (jsonb: phone/email/name/cademi_produto/
  description/dueDate/cancelled_by_user+at/cademi_delivery/ekwanza_error).
- **`customers`**: `code (CL-...)`, nome/email/phone, `state`, `ovg_id`,
  `cademi_id`, `lead_id`.
- **`users`**: nome/email único/senha bcrypt/`role`
  (administrador/gestor/comercial/financeiro/operacional)/`active`.
- **`settings`**: chave→valor (incl. `cademi_*`, `ekwanza_*`, `ovg_*`,
  `password_reset_*`). Segredos nunca saem em claro na API.
- **`ovg_members`**, **`solve_access_logs`**, **`sync_log`**, **`plans`**,
  **`leads`**, **`automations`**, **`audit_logs`**, **`integrations`**,
  **`webhooks`**, **`portal_otps`**, espelhos ZKTeco: `clientes, acessos,
  terminais`. Schema Drizzle em `lib/db/src/schema/` (o `standalone`
  auto-cria o que falta).

## Queries úteis (só leitura)
```sql
-- Últimos pagamentos com estado
SELECT code, amount, method, status, reference_code, entity, created_at
FROM payments ORDER BY created_at DESC LIMIT 20;
-- Pendentes abertos
SELECT code, amount, metadata->>'email' AS email FROM payments
WHERE status='pendente' ORDER BY created_at DESC;
-- Pagamentos de um aluno
SELECT code, status, amount FROM payments
WHERE LOWER(COALESCE(metadata->>'email',''))='email@exemplo.com';
-- Distribuição por estado
SELECT status, COUNT(*) FROM payments GROUP BY status;
```
Nunca mexer em `sync_state`; apagados usam sufixo `_del` (não DELETE).

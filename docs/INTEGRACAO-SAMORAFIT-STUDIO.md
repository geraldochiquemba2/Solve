# Integração SamoraFit Studio → CRM

Documento de entrega para a equipa do **SamoraFit Studio**. Descreve como enviar
clientes, planos, subscrições, pagamentos, faturas e reembolsos para o CRM, como
autenticar e como validar a sincronização.

- **Sentido:** Studio → CRM (push/ingestão). O CRM não acede à base de dados do Studio.
- **Produção:** `standalone-server/index.js` (`studio-integration.js`).
- **Área no CRM:** **Ecossistema → SamoraFit Studio** (`/admin/samorafit-studio`).
- **Idempotência:** por `external_id` (upsert). Reenviar o mesmo registo actualiza-o.

## 1. Credenciais

A chave é criada exclusivamente na área **SamoraFit Studio** do CRM (separador de
ligação), por um utilizador com perfil **administrador**. É mostrada **uma única
vez**; guarde-a no cofre de segredos do Studio.

| Item | Valor |
| --- | --- |
| URL base | `https://<dominio-do-crm>/api/v1/integrations/samorafit-studio` |
| Header | `X-API-Key: sfs_...` |
| Alternativa | `Authorization: Bearer sfs_...` |
| Formato | `Content-Type: application/json` |
| Limite de corpo | 100 kB por pedido |

> Existe ainda o fallback de servidor `STUDIO_API_KEY`, destinado apenas a
> arranques controlados. A chave dedicada gerida no CRM é o método recomendado.

Exemplo:

```bash
curl -X POST "https://crm.exemplo.com/api/v1/integrations/samorafit-studio/sync" \
  -H "X-API-Key: sfs_xxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d @lote.json
```

## 2. Endpoints

### 2.1 Ingestão (requer `X-API-Key`)

| Método | Caminho | Descrição |
| --- | --- | --- |
| `POST` | `/sync` | Envia um lote com uma ou mais entidades. |
| `POST` | `/events` | Envia um único evento (`created`/`updated`/`deleted`). |
| `GET` | `/status` | Estado da integração, contagens recebidas e última sincronização. |

### 2.2 Leitura no CRM (requer sessão de utilizador, não API Key)

| Método | Caminho | Descrição |
| --- | --- | --- |
| `GET` | `/overview` | Totais para o painel. |
| `GET` | `/snapshot?limit=200` | Todas as entidades (limite 1–500, por omissão 100). |
| `GET` | `/customers?status=ACTIVE&limit=100&offset=0` | Clientes. |
| `GET` | `/plans?active=true` | Planos. |
| `GET` | `/subscriptions?customer_external_id=...&status=ACTIVE` | Subscrições. |
| `GET` | `/payments?customer_external_id=...&status=CONFIRMED` | Pagamentos. |
| `GET` | `/invoices?customer_external_id=...&status=PENDING` | Faturas/períodos. |
| `GET` | `/refunds?customer_external_id=...` | Reembolsos. |
| `GET` | `/sync-log` | Últimas 50 sincronizações. |
| `GET/POST/DELETE` | `/keys`, `/keys/:id` | Gestão de chaves (só administrador). |

As respostas de leitura usam `camelCase`; a ingestão aceita `snake_case` e
`camelCase` (ex.: `full_name` ou `fullName`). Recomenda-se `snake_case`, alinhado
com o Django.

## 3. Lote (`POST /sync`)

O corpo pode ser directamente o mapa de entidades ou vir dentro de `data`:

```json
{
  "customers": [ { "external_id": "42", "full_name": "Ana Silva", "phone": "+244900000000", "status": "ACTIVE" } ],
  "plans": [ { "external_id": "3", "name": "Mensal", "price": 15000 } ],
  "subscriptions": [ { "external_id": "88", "customer_external_id": "42", "plan_external_id": "3", "start_date": "2026-10-01", "status": "ACTIVE" } ]
}
```

Resposta `200` (tudo ok) ou `207` (parcial):

```json
{
  "ok": false,
  "status": "partial",
  "data": {
    "received": 3,
    "upserted": 2,
    "failed": 1,
    "by_entity": {
      "customers": { "received": 1, "upserted": 1, "failed": 0 },
      "plans": { "received": 1, "upserted": 1, "failed": 0 },
      "subscriptions": { "received": 1, "upserted": 0, "failed": 1 }
    }
  },
  "errors": [
    { "entity": "subscription", "external_id": "88", "message": "customer_external_id, plan_external_id e start_date são obrigatórios" }
  ]
}
```

- Um registo inválido não impede os restantes de serem gravados.
- Ajuste o tamanho do lote ao limite de **100 kB** por pedido (algumas dezenas a
  centenas de registos leves). Para volumes maiores, divida por entidade.
- Entidades aceites: `customers`, `plans`, `subscriptions`, `payments`, `invoices`,
  `refunds`, `payment_allocations`.
- Entidades desconhecidas são ignoradas no lote; no evento devolvem `400`.

## 4. Evento (`POST /events`)

```json
{
  "event": "customer.updated",
  "entity": "customer",
  "data": { "external_id": "42", "full_name": "Ana Silva", "status": "ACTIVE" }
}
```

- `entity` pode ser omitido: é inferido de `event` (`customer.*`, `plan.*`,
  `subscription.*`, `payment.*`, `billing_period.*` → faturas, `refund.*`,
  `payment_allocation.*`).
- Se `event` contiver `delete`, o registo é removido/inactivado (ver §7) e apenas
  `external_id` é obrigatório em `data`.
- Resposta: `{ "ok": true, "event": "...", "entity": "...", "external_id": "...", "upserted": 1 }`.

## 5. Campos por entidade

Todos os `external_id` são obrigatórios (excepto `payment_allocations`, que pode
ser derivado de `payment:invoice`) e limitados a 100 caracteres. Datas em
`YYYY-MM-DD`; timestamps em ISO 8601.

### Clientes (`customers`)

| Campo | Obrigatório | Notas |
| --- | --- | --- |
| `external_id` | sim | PK no Studio; aceita também `id`. |
| `full_name` | sim | Também aceita `name`. |
| `customer_number`, `legacy_id`, `card_number` | não | |
| `photo`, `photo_url` | não | URL. |
| `birth_date`, `gender`, `nif`, `phone`, `email` | não | |
| `status` | não | `ACTIVE` por omissão. |
| `notes`, `enrollment_paid_at` | não | |
| `created_at`, `updated_at` | não | Origem, para auditoria. |

### Planos (`plans`)

| Campo | Obrigatório | Notas |
| --- | --- | --- |
| `external_id`, `name` | sim | |
| `price`, `enrollment_fee`, `renewal_fee` | não | Numéricos; por omissão `0`. |
| `plan_type`, `classes_quantity`, `calculation_mode` | não | |
| `validity_days`, `validity_months` | não | `validity_months` por omissão `1`. |
| `rules` | não | Texto. |
| `is_active` | não | `true` por omissão. |

### Subscrições (`subscriptions`)

| Campo | Obrigatório | Notas |
| --- | --- | --- |
| `external_id` | sim | |
| `customer_external_id` / `customer_id` | sim | |
| `plan_external_id` / `plan_id` | sim | |
| `start_date` | sim | |
| `end_date` | não | |
| `price` | não | |
| `classes_quantity` | não | |
| `status` | não | `ACTIVE` por omissão. |
| `created_at`, `updated_at` | não | |

### Pagamentos (`payments`)

| Campo | Obrigatório | Notas |
| --- | --- | --- |
| `external_id` | sim | |
| `customer_external_id` / `customer_id` | recomendado | |
| `amount` | não | |
| `kind`, `payment_date`, `payment_method` | não | |
| `status` | não | `PENDING` por omissão (`CONFIRMED` para pagamentos pagos). |
| `reference`, `notes` | não | |
| `unallocated_amount`, `enrollment_amount`, `reactivation_amount` | não | |
| `discount_percent`, `discount_amount` | não | |
| `registered_by_external_id` | não | Utilizador do Studio. |

### Faturas / períodos de faturação (`invoices`)

| Campo | Obrigatório | Notas |
| --- | --- | --- |
| `external_id` | sim | ID do `BillingPeriod`. |
| `customer_external_id` / `customer_id` | sim | |
| `subscription_external_id` / `subscription_id` | não | |
| `year`, `month`, `period_start`, `period_end` | não | |
| `amount_due`, `amount_paid`, `amount_released`, `amount_remaining` | não | |
| `status` | não | `PENDING` por omissão. |
| `due_date`, `paid_at`, `is_partial`, `notes` | não | |

### Reembolsos (`refunds`)

| Campo | Obrigatório | Notas |
| --- | --- | --- |
| `external_id` | sim | |
| `payment_external_id` / `payment_id` | recomendado | |
| `customer_external_id` / `customer_id` | recomendado | |
| `amount` | não | |
| `reason`, `status`, `refunded_at` | não | `status` por omissão `CONFIRMED`. |

### Alocações (`payment_allocations`)

Enviar `payment_external_id` e `invoice_external_id` (ou `billing_period_id`),
mais `amount`. O `external_id` pode ser omitido e é derivado como
`<payment>:<invoice>`.

## 6. Remoção e inactivação (`*.deleted`)

| Entidade | Efeito |
| --- | --- |
| `customers` | `status = INACTIVE` (histórico preservado). |
| `plans` | `is_active = false`. |
| `subscriptions` | `status = CANCELLED`. |
| `payments`, `invoices`, `refunds`, `payment_allocations` | Eliminado. |

## 7. Ligação ao CRM

- **Clientes:** ligação automática por NIF, e-mail ou últimos 9 dígitos do
  telefone. O vínculo (`crm_customer_id`) aparece como “Ver no CRM”.
- **Planos:** ligação automática por nome do plano (`crm_plan_id`).
- Clientes do Studio **não** aparecem na lista principal de Clientes do CRM;
  são visíveis apenas na área **SamoraFit Studio**.
- As ligações são tentadas de novo em cada sincronização enquanto o vínculo não
  existir.

## 8. Segurança e operação

- Chaves guardadas como SHA-256; nunca é possível recuperar a chave original.
- Revogar uma chave (`DELETE /keys/:id`) invalida-a imediatamente.
- `last_used_at` é actualizado a cada pedido autenticado.
- Limites: lote 120 pedidos/min; eventos 240 pedidos/min; restante tráfego tem o
  limite global do servidor (200 pedidos/min por IP).
- Todas as ingestões ficam registadas em `studio_sync_log` e na auditoria do CRM.
- CORS: a ingestão deve ser feita servidor-a-servidor; não é necessário expor a
  chave no browser.

## 9. Erros

| HTTP | Situação |
| --- | --- |
| `400` | Evento inválido ou campo obrigatório em falta. |
| `401` | `X-API-Key` ausente, inválida, expirada ou revogada. |
| `404` | Chave a revogar inexistente. |
| `207` | Lote processado com falhas parciais (ver `errors`). |
| `429` | Limite de pedidos excedido. |
| `500` | Erro inesperado; contactar a equipa do CRM. |

## 10. Verificação rápida

```bash
# Estado (com a chave)
curl -H "X-API-Key: sfs_..." \
  "https://crm.exemplo.com/api/v1/integrations/samorafit-studio/status"

# Enviar um cliente
curl -X POST "https://crm.exemplo.com/api/v1/integrations/samorafit-studio/events" \
  -H "X-API-Key: sfs_..." -H "Content-Type: application/json" \
  -d '{"event":"customer.created","data":{"external_id":"42","full_name":"Ana Silva","phone":"+244900000000"}}'
```

## 11. Base de dados

- Tabelas: `studio_customers`, `studio_plans`, `studio_subscriptions`,
  `studio_payments`, `studio_invoices`, `studio_refunds`,
  `studio_payment_allocations`, `studio_api_keys`, `studio_sync_log`.
- Migração Drizzle: `packages/db/drizzle/0008_studio.sql`.
- O servidor de produção cria/valida as tabelas no primeiro pedido à integração
  (`CREATE TABLE IF NOT EXISTS`), pelo que não é necessário correr a migração
  manualmente para a integração funcionar.

## 12. Limitações actuais

Ainda não são recebidos `Attendance`, `ExtraClass`, `Freeze`,
`CustomerFingerprint`, `Terminal`, `PhysicalAssessment`, `FinancialRelease`,
`FinancialAdjustment`, `User` nem `AuditLog` do Studio. A estrutura está
preparada para acrescentar essas entidades sem alterar as existentes.

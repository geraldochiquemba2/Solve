import { pgTable, uuid, text, varchar, integer, decimal, boolean, timestamp, date, jsonb, pgEnum, unique, index } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

export const userRoleEnum = pgEnum("user_role", ["administrador", "gestor", "comercial", "financeiro", "operacional"]);
export const leadStatusEnum = pgEnum("lead_status", ["novo_lead", "contacto", "qualificado", "proposta", "negociacao", "convertido", "perdido"]);
export const customerStateEnum = pgEnum("customer_state", ["activo", "inactivo", "em_atraso", "suspenso"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pendente", "confirmado", "rejeitado", "reembolsado", "em_atraso", "expirado"]);
export const integrationStatusEnum = pgEnum("integration_status", ["operacional", "atencao", "erro", "inativo"]);
export const planPeriodicityEnum = pgEnum("plan_periodicity", ["mensal", "trimestral", "semestral", "anual"]);
export const webhookStatusEnum = pgEnum("webhook_status", ["pendente", "entregue", "falha", "reprocessado"]);
export const automationStatusEnum = pgEnum("automation_status", ["activo", "inactivo"]);
export const promoTypeEnum = pgEnum("promo_type", ["percent", "fixed"]);

export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("comercial"),
  avatar: varchar("avatar", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  active: boolean("active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const leadsTable = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  company: varchar("company", { length: 255 }),
  source: varchar("source", { length: 100 }),
  status: leadStatusEnum("status").notNull().default("novo_lead"),
  owner_id: uuid("owner_id").references(() => usersTable.id),
  estimatedValue: integer("estimated_value"),
  notes: text("notes"),
  externalId: varchar("external_id", { length: 100 }),
  convertedAt: timestamp("converted_at"),
  whatsapp: varchar("whatsapp", { length: 50 }),
  produtoInteresse: varchar("produto_interesse", { length: 255 }),
  proximoContato: date("proximo_contato"),
  // Data do Ãºltimo contacto. Ã‰ a fonte Ãºnica do que o gestor lÃª em "Ãšltimo
  // contacto": nasce do histÃ³rico (registo de contactos) mas passa a ser
  // editÃ¡vel no calendÃ¡rio, sem inventar um contacto que nÃ£o aconteceu.
  ultimoContatoAt: date("ultimo_contato_at"),
  motivoPerda: varchar("motivo_perda", { length: 255 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const leadContactsTable = pgTable("lead_contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  leadId: uuid("lead_id").notNull().references(() => leadsTable.id, { onDelete: "cascade" }),
  staffId: uuid("staff_id").references(() => usersTable.id, { onDelete: "set null" }),
  staffName: varchar("staff_name", { length: 255 }),
  canal: varchar("canal", { length: 20 }).notNull(),
  resultado: varchar("resultado", { length: 50 }).notNull(),
  proximoPasso: varchar("proximo_passo", { length: 50 }),
  proximoContato: date("proximo_contato"),
  observacao: text("observacao"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Uma pessoa pode demonstrar interesse em vÃ¡rias campanhas sem ser outros clientes:
// a lead Ã© Ãºnica (identificada por email/whatsapp/telefone) e cada campanha/interesse
// novo que volta da mesma pessoa Ã© registado aqui, preservando o histÃ³rico.
// `leads.source` continua a ser a campanha principal (a primeira). NÃ£o apagar leads:
// mover entre campanhas/estados nunca remove o rasto.
export const leadCampaignsTable = pgTable(
  "lead_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id").notNull().references(() => leadsTable.id, { onDelete: "cascade" }),
    source: varchar("source", { length: 100 }).notNull(),
    produtoInteresse: varchar("produto_interesse", { length: 255 }),
    externalId: varchar("external_id", { length: 100 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.leadId, t.source)],
);

// Avisos internos da equipa (sino do CRM). Uma linha por destinatÃ¡rio: assim
// cada pessoa marca a sua como lida sem afectar os restantes. `leadId` amarra o
// aviso Ã  lead para o clique abrir a ficha certa.
export const notificationsTable = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 50 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    body: text("body"),
    leadId: uuid("lead_id").references(() => leadsTable.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("notifications_user_created_idx").on(t.userId, t.createdAt),
    index("notifications_unread_idx").on(t.userId).where(sql`${t.readAt} IS NULL`),
  ],
);

export const customersTable = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  company: varchar("company", { length: 255 }),
  nif: varchar("nif", { length: 50 }),
  gender: varchar("gender", { length: 20 }),
  birthDate: timestamp("birth_date"),
  state: customerStateEnum("state").notNull().default("activo"),
  cademiId: varchar("cademi_id", { length: 100 }),
  whatsappPhone: varchar("whatsapp_phone", { length: 50 }),
  leadId: uuid("lead_id").references(() => leadsTable.id),
  joinedAt: timestamp("joined_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const plansTable = pgTable("plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  price: integer("price").notNull(),
  periodicity: planPeriodicityEnum("periodicity").notNull().default("mensal"),
  duration: integer("duration"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const subscriptionsTable = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").notNull().references(() => customersTable.id),
  planId: uuid("plan_id").notNull().references(() => plansTable.id),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  active: boolean("active").notNull().default(true),
  lessonsTotal: integer("lessons_total"),
  lessonsDone: integer("lessons_done").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const paymentsTable = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  customerId: uuid("customer_id").notNull().references(() => customersTable.id),
  subscriptionId: uuid("subscription_id").references(() => subscriptionsTable.id),
  amount: integer("amount").notNull(),
  method: varchar("method", { length: 50 }),
  status: paymentStatusEnum("status").notNull().default("pendente"),
  referenceCode: varchar("reference_code", { length: 100 }),
  entity: varchar("entity", { length: 50 }),
  ekwanzaCode: varchar("ekwanza_code", { length: 100 }),
  ekwanzaOperationCode: varchar("ekwanza_operation_code", { length: 100 }),
  paidAt: timestamp("paid_at"),
  reconciledAt: timestamp("reconciled_at"),
  expiresAt: timestamp("expires_at"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const accessTable = pgTable("access", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").notNull().references(() => customersTable.id),
  platform: varchar("platform", { length: 50 }).notNull(),
  status: varchar("status", { length: 50 }).notNull(),
  cademiAccessId: varchar("cademi_access_id", { length: 100 }),
  activatedAt: timestamp("activated_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const checkinsTable = pgTable("checkins", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").notNull().references(() => customersTable.id),
  location: varchar("location", { length: 255 }),
  checkedInAt: timestamp("checked_in_at").notNull().defaultNow(),
});

export const coursesTable = pgTable("courses", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  cademiCourseId: varchar("cademi_course_id", { length: 100 }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const customerCoursesTable = pgTable("customer_courses", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").notNull().references(() => customersTable.id),
  courseId: uuid("course_id").notNull().references(() => coursesTable.id),
  enrolledAt: timestamp("enrolled_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const integrationsTable = pgTable("integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  status: integrationStatusEnum("status").notNull().default("inativo"),
  config: jsonb("config"),
  lastSyncAt: timestamp("last_sync_at"),
  errorCount: integer("error_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const webhooksTable = pgTable("webhooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  url: varchar("url", { length: 500 }).notNull(),
  event: varchar("event", { length: 100 }).notNull(),
  active: boolean("active").notNull().default(true),
  secret: varchar("secret", { length: 255 }),
  lastTriggeredAt: timestamp("last_triggered_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const webhookDeliveriesTable = pgTable("webhook_deliveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  webhookId: uuid("webhook_id").notNull().references(() => webhooksTable.id),
  event: varchar("event", { length: 100 }).notNull(),
  payload: jsonb("payload"),
  status: webhookStatusEnum("status").notNull().default("pendente"),
  responseCode: integer("response_code"),
  attempts: integer("attempts").notNull().default(0),
  nextRetryAt: timestamp("next_retry_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const automationsTable = pgTable("automations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  trigger: varchar("trigger", { length: 100 }).notNull(),
  action: text("action").notNull(),
  active: boolean("active").notNull().default(true),
  runCount: integer("run_count").notNull().default(0),
  lastRunAt: timestamp("last_run_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const auditLogsTable = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  actor: varchar("actor", { length: 255 }).notNull(),
  actorId: uuid("actor_id"),
  action: varchar("action", { length: 255 }).notNull(),
  entity: varchar("entity", { length: 100 }),
  entityId: uuid("entity_id"),
  details: jsonb("details"),
  ipAddress: varchar("ip_address", { length: 50 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const settingsTable = pgTable("settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: varchar("key", { length: 255 }).notNull().unique(),
  value: jsonb("value"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const apiKeysTable = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  key: varchar("key", { length: 255 }).notNull().unique(),
  userId: uuid("user_id").references(() => usersTable.id),
  active: boolean("active").notNull().default(true),
  lastUsedAt: timestamp("last_used_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});


// â”€â”€â”€ Portal do Cliente: OTPs de login via WhatsApp â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const portalOtpsTable = pgTable("portal_otps", {
  id: uuid("id").primaryKey().defaultRandom(),
  phone: varchar("phone", { length: 50 }).notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  attempts: integer("attempts").notNull().default(0),
  consumed: boolean("consumed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// â”€â”€â”€ Relations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ─── SamoraFit Studio (ginásio) — espelho da modelagem Django ────────────────
// Os dados entram por ingestão (API Key dedicada) e ficam isolados do CRM.
// `externalId` é sempre o id estável do Studio; `crm*Id` liga ao registo CRM
// correspondente quando existe correspondência segura.
export const studioCustomersTable = pgTable(
  "studio_customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    externalId: varchar("external_id", { length: 100 }).notNull().unique(),
    customerNumber: varchar("customer_number", { length: 20 }),
    legacyId: varchar("legacy_id", { length: 50 }),
    cardNumber: varchar("card_number", { length: 50 }),
    fullName: varchar("full_name", { length: 200 }).notNull(),
    photoUrl: text("photo_url"),
    birthDate: date("birth_date"),
    gender: varchar("gender", { length: 10 }),
    nif: varchar("nif", { length: 30 }),
    phone: varchar("phone", { length: 30 }),
    email: varchar("email", { length: 255 }),
    status: varchar("status", { length: 20 }).notNull().default("ACTIVE"),
    notes: text("notes"),
    enrollmentPaidAt: date("enrollment_paid_at"),
    crmCustomerId: uuid("crm_customer_id").references(() => customersTable.id, { onDelete: "set null" }),
    sourceCreatedAt: timestamp("source_created_at"),
    sourceUpdatedAt: timestamp("source_updated_at"),
    raw: jsonb("raw"),
    syncedAt: timestamp("synced_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("studio_customers_name_idx").on(t.fullName),
    index("studio_customers_phone_idx").on(t.phone),
    index("studio_customers_nif_idx").on(t.nif),
    index("studio_customers_status_idx").on(t.status),
  ],
);

export const studioPlansTable = pgTable(
  "studio_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    externalId: varchar("external_id", { length: 100 }).notNull().unique(),
    name: varchar("name", { length: 100 }).notNull(),
    price: decimal("price", { precision: 12, scale: 2 }).notNull().default("0"),
    enrollmentFee: decimal("enrollment_fee", { precision: 12, scale: 2 }).notNull().default("0"),
    renewalFee: decimal("renewal_fee", { precision: 12, scale: 2 }).notNull().default("0"),
    planType: varchar("plan_type", { length: 20 }),
    classesQuantity: integer("classes_quantity"),
    calculationMode: varchar("calculation_mode", { length: 20 }),
    validityDays: integer("validity_days"),
    validityMonths: integer("validity_months").notNull().default(1),
    rules: text("rules"),
    isActive: boolean("is_active").notNull().default(true),
    crmPlanId: uuid("crm_plan_id").references(() => plansTable.id, { onDelete: "set null" }),
    raw: jsonb("raw"),
    syncedAt: timestamp("synced_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("studio_plans_active_idx").on(t.isActive)],
);

export const studioSubscriptionsTable = pgTable(
  "studio_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    externalId: varchar("external_id", { length: 100 }).notNull().unique(),
    customerExternalId: varchar("customer_external_id", { length: 100 }).notNull(),
    planExternalId: varchar("plan_external_id", { length: 100 }).notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    price: decimal("price", { precision: 12, scale: 2 }).notNull().default("0"),
    classesQuantity: integer("classes_quantity"),
    status: varchar("status", { length: 20 }).notNull().default("ACTIVE"),
    sourceCreatedAt: timestamp("source_created_at"),
    sourceUpdatedAt: timestamp("source_updated_at"),
    raw: jsonb("raw"),
    syncedAt: timestamp("synced_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("studio_subscriptions_customer_idx").on(t.customerExternalId),
    index("studio_subscriptions_status_idx").on(t.status),
  ],
);

export const studioPaymentsTable = pgTable(
  "studio_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    externalId: varchar("external_id", { length: 100 }).notNull().unique(),
    customerExternalId: varchar("customer_external_id", { length: 100 }),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull().default("0"),
    kind: varchar("kind", { length: 20 }),
    paymentDate: date("payment_date"),
    paymentMethod: varchar("payment_method", { length: 20 }),
    status: varchar("status", { length: 20 }).notNull().default("PENDING"),
    reference: varchar("reference", { length: 100 }),
    notes: text("notes"),
    unallocatedAmount: decimal("unallocated_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    enrollmentAmount: decimal("enrollment_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    reactivationAmount: decimal("reactivation_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    discountPercent: decimal("discount_percent", { precision: 5, scale: 2 }).notNull().default("0"),
    discountAmount: decimal("discount_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    registeredByExternalId: varchar("registered_by_external_id", { length: 100 }),
    raw: jsonb("raw"),
    sourceCreatedAt: timestamp("source_created_at"),
    sourceUpdatedAt: timestamp("source_updated_at"),
    syncedAt: timestamp("synced_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("studio_payments_customer_idx").on(t.customerExternalId),
    index("studio_payments_status_idx").on(t.status),
    index("studio_payments_date_idx").on(t.paymentDate),
  ],
);

export const studioInvoicesTable = pgTable(
  "studio_invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    externalId: varchar("external_id", { length: 100 }).notNull().unique(),
    customerExternalId: varchar("customer_external_id", { length: 100 }).notNull(),
    subscriptionExternalId: varchar("subscription_external_id", { length: 100 }),
    year: integer("year"),
    month: integer("month"),
    periodStart: date("period_start"),
    periodEnd: date("period_end"),
    amountDue: decimal("amount_due", { precision: 12, scale: 2 }).notNull().default("0"),
    amountPaid: decimal("amount_paid", { precision: 12, scale: 2 }).notNull().default("0"),
    amountReleased: decimal("amount_released", { precision: 12, scale: 2 }).notNull().default("0"),
    amountRemaining: decimal("amount_remaining", { precision: 12, scale: 2 }).notNull().default("0"),
    status: varchar("status", { length: 20 }).notNull().default("PENDING"),
    dueDate: date("due_date"),
    paidAt: timestamp("paid_at"),
    isPartial: boolean("is_partial").notNull().default(false),
    notes: text("notes"),
    raw: jsonb("raw"),
    syncedAt: timestamp("synced_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("studio_invoices_customer_idx").on(t.customerExternalId),
    index("studio_invoices_status_idx").on(t.status),
    index("studio_invoices_period_idx").on(t.periodStart),
  ],
);

export const studioRefundsTable = pgTable(
  "studio_refunds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    externalId: varchar("external_id", { length: 100 }).notNull().unique(),
    paymentExternalId: varchar("payment_external_id", { length: 100 }),
    customerExternalId: varchar("customer_external_id", { length: 100 }),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull().default("0"),
    reason: text("reason"),
    status: varchar("status", { length: 20 }).notNull().default("CONFIRMED"),
    refundedAt: timestamp("refunded_at"),
    raw: jsonb("raw"),
    syncedAt: timestamp("synced_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("studio_refunds_payment_idx").on(t.paymentExternalId)],
);

export const studioPaymentAllocationsTable = pgTable(
  "studio_payment_allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    externalId: varchar("external_id", { length: 100 }).notNull().unique(),
    paymentExternalId: varchar("payment_external_id", { length: 100 }).notNull(),
    invoiceExternalId: varchar("invoice_external_id", { length: 100 }).notNull(),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull().default("0"),
    raw: jsonb("raw"),
    syncedAt: timestamp("synced_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("studio_allocations_payment_idx").on(t.paymentExternalId)],
);

export const studioApiKeysTable = pgTable("studio_api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  keyHash: varchar("key_hash", { length: 128 }).notNull().unique(),
  keyPrefix: varchar("key_prefix", { length: 16 }).notNull(),
  active: boolean("active").notNull().default(true),
  lastUsedAt: timestamp("last_used_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const studioSyncLogTable = pgTable(
  "studio_sync_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    event: varchar("event", { length: 50 }).notNull(),
    entity: varchar("entity", { length: 50 }),
    receivedCount: integer("received_count").notNull().default(0),
    upsertedCount: integer("upserted_count").notNull().default(0),
    errorCount: integer("error_count").notNull().default(0),
    status: varchar("status", { length: 20 }).notNull().default("ok"),
    message: text("message"),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    finishedAt: timestamp("finished_at"),
  },
  (t) => [index("studio_sync_log_started_idx").on(t.startedAt)],
);

export const paymentsRelations = relations(paymentsTable, ({ one }) => ({
  customer: one(customersTable, {
    fields: [paymentsTable.customerId],
    references: [customersTable.id],
  }),
}));

export const customersRelations = relations(customersTable, ({ many }) => ({
  payments: many(paymentsTable),
}));

export const leadsRelations = relations(leadsTable, ({ many }) => ({
  contacts: many(leadContactsTable),
  campaigns: many(leadCampaignsTable),
}));

export const leadCampaignsRelations = relations(leadCampaignsTable, ({ one }) => ({
  lead: one(leadsTable, {
    fields: [leadCampaignsTable.leadId],
    references: [leadsTable.id],
  }),
}));


export const promoCodesTable = pgTable("promo_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  type: promoTypeEnum("type").notNull().default("percent"),
  value: integer("value").notNull(),
  minAmount: integer("min_amount"),
  maxDiscount: integer("max_discount"),
  appliesTo: varchar("applies_to", { length: 20 }).notNull().default("all"),
  planIds: jsonb("plan_ids").$type<string[]>(),
  usageLimit: integer("usage_limit"),
  usedCount: integer("used_count").notNull().default(0),
  perUser: boolean("per_user").notNull().default(true),
  active: boolean("active").notNull().default(true),
  startsAt: timestamp("starts_at"),
  expiresAt: timestamp("expires_at"),
  createdBy: uuid("created_by").references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// `userKey` Ã© a identidade estÃ¡vel do utilizador que usou o cÃ³digo
// (email normalizado > telefone normalizado). Ã‰ por aqui que se garante o uso
// Ãºnico por utilizador â€” `email`/`phone` ficam como evidÃªncia legÃ­vel.
export const promoUsagesTable = pgTable("promo_usages", {
  id: uuid("id").primaryKey().defaultRandom(),
  promoId: uuid("promo_id").notNull().references(() => promoCodesTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => usersTable.id),
  customerId: uuid("customer_id").references(() => customersTable.id),
  userKey: varchar("user_key", { length: 255 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  paymentCode: varchar("payment_code", { length: 50 }),
  amountBefore: integer("amount_before"),
  amountAfter: integer("amount_after"),
  discountApplied: integer("discount_applied"),
  usedAt: timestamp("used_at").notNull().defaultNow(),
}, (t) => [
  index("idx_promo_usages_promo_id").on(t.promoId),
  index("idx_promo_usages_email_phone").on(t.email, t.phone),
  index("idx_promo_usages_user_key").on(t.promoId, t.userKey),
]);

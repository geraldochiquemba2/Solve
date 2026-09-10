import { pgTable, uuid, text, varchar, integer, decimal, boolean, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const userRoleEnum = pgEnum("user_role", ["administrador", "gestor", "comercial", "financeiro", "operacional"]);
export const leadStatusEnum = pgEnum("lead_status", ["novo_lead", "contacto", "qualificado", "proposta", "negociacao", "convertido", "perdido"]);
export const customerStateEnum = pgEnum("customer_state", ["activo", "inactivo", "em_atraso", "suspenso"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pendente", "confirmado", "rejeitado", "reembolsado", "em_atraso"]);
export const integrationStatusEnum = pgEnum("integration_status", ["operacional", "atencao", "erro", "inativo"]);
export const planPeriodicityEnum = pgEnum("plan_periodicity", ["mensal", "trimestral", "semestral", "anual"]);
export const webhookStatusEnum = pgEnum("webhook_status", ["pendente", "entregue", "falha", "reprocessado"]);
export const automationStatusEnum = pgEnum("automation_status", ["activo", "inactivo"]);

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
  ovgId: varchar("ovg_id", { length: 100 }),
  convertedAt: timestamp("converted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

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
  ovgId: varchar("ovg_id", { length: 100 }),
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
  ovgPlanId: varchar("ovg_plan_id", { length: 100 }),
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
  ovgSynced: boolean("ovg_synced").notNull().default(false),
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
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const accessTable = pgTable("access", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").notNull().references(() => customersTable.id),
  platform: varchar("platform", { length: 50 }).notNull(),
  status: varchar("status", { length: 50 }).notNull(),
  ovgAccessId: varchar("ovg_access_id", { length: 100 }),
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
  ovgCheckinId: varchar("ovg_checkin_id", { length: 100 }),
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

// ─── Solve Access: logs de acesso sincronizados da catraca ───────────────────
export const solveAccessLogsTable = pgTable("solve_access_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  remoteId: integer("remote_id").notNull().unique(),
  customerId: integer("customer_id").notNull(),
  customerName: varchar("customer_name", { length: 255 }),
  accessDate: varchar("access_date", { length: 10 }).notNull(),
  accessTime: varchar("access_time", { length: 20 }).notNull(),
  accessType: varchar("access_type", { length: 20 }).notNull(),
  result: varchar("result", { length: 20 }).notNull(),
  reason: text("reason"),
  syncedAt: timestamp("synced_at").notNull().defaultNow(),
});

// ─── Relations ────────────────────────────────────────────────────────────────
export const paymentsRelations = relations(paymentsTable, ({ one }) => ({
  customer: one(customersTable, {
    fields: [paymentsTable.customerId],
    references: [customersTable.id],
  }),
}));

export const customersRelations = relations(customersTable, ({ many }) => ({
  payments: many(paymentsTable),
}));

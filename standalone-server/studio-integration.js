import crypto from "crypto";

// Integração SamoraFit Studio (ginásio) — recebe dados por push.
// Autenticação de máquina: X-API-Key gerada em /keys (hash em studio_api_keys).
// Leitura para o CRM: sessão normal (requireAuth).
const PREFIX = "/api/v1/integrations/samorafit-studio";

const hashKey = (key) => crypto.createHash("sha256").update(String(key)).digest("hex");
const safeEqual = (a, b) => {
  const x = Buffer.from(String(a), "utf8");
  const y = Buffer.from(String(b), "utf8");
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

function pick(obj, ...keys) {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return undefined;
}
const text = (v, max) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.slice(0, max);
};
const num = (v) => {
  if (v === undefined || v === null || v === "") return "0";
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : "0";
};
const intOrNull = (v) => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number.parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
};
const bool = (v, fallback = false) => {
  if (v === undefined || v === null) return fallback;
  if (typeof v === "boolean") return v;
  return ["1", "true", "sim", "yes"].includes(String(v).toLowerCase());
};
const statusText = (v, fallback) => text(v, 20)?.toUpperCase() || fallback;
const dateOnly = (v) => {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};
const stamp = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
const externalId = (p) => {
  const v = pick(p, "external_id", "externalId", "id");
  if (v === undefined || v === null || String(v).trim() === "") {
    throw new Error("external_id é obrigatório");
  }
  return String(v).trim().slice(0, 100);
};
const rawJson = (p) => JSON.stringify(p ?? null);

const scalar = (v) => (v === null || v === undefined ? null : String(v));

export function registerStudioIntegration(app, { pool, requireAuth, requireRole, rateLimit, audit }) {
  let schemaReady = null;
  function ensureSchema() {
    if (schemaReady) return schemaReady;
    const ddls = [
      `CREATE TABLE IF NOT EXISTS studio_customers (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), external_id varchar(100) NOT NULL UNIQUE,
        customer_number varchar(20), legacy_id varchar(50), card_number varchar(50),
        full_name varchar(200) NOT NULL, photo_url text, birth_date date, gender varchar(10),
        nif varchar(30), phone varchar(30), email varchar(255), status varchar(20) NOT NULL DEFAULT 'ACTIVE',
        notes text, enrollment_paid_at date, crm_customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
        source_created_at timestamp, source_updated_at timestamp, raw jsonb,
        synced_at timestamp NOT NULL DEFAULT now(), created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now())`,
      `CREATE INDEX IF NOT EXISTS studio_customers_name_idx ON studio_customers (full_name)`,
      `CREATE INDEX IF NOT EXISTS studio_customers_phone_idx ON studio_customers (phone)`,
      `CREATE INDEX IF NOT EXISTS studio_customers_nif_idx ON studio_customers (nif)`,
      `CREATE INDEX IF NOT EXISTS studio_customers_status_idx ON studio_customers (status)`,
      `CREATE TABLE IF NOT EXISTS studio_plans (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), external_id varchar(100) NOT NULL UNIQUE,
        name varchar(100) NOT NULL, price numeric(12,2) NOT NULL DEFAULT 0,
        enrollment_fee numeric(12,2) NOT NULL DEFAULT 0, renewal_fee numeric(12,2) NOT NULL DEFAULT 0,
        plan_type varchar(20), classes_quantity integer, calculation_mode varchar(20),
        validity_days integer, validity_months integer NOT NULL DEFAULT 1, rules text,
        is_active boolean NOT NULL DEFAULT true, crm_plan_id uuid REFERENCES plans(id) ON DELETE SET NULL,
        raw jsonb, synced_at timestamp NOT NULL DEFAULT now(), created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now())`,
      `CREATE INDEX IF NOT EXISTS studio_plans_active_idx ON studio_plans (is_active)`,
      `CREATE TABLE IF NOT EXISTS studio_subscriptions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), external_id varchar(100) NOT NULL UNIQUE,
        customer_external_id varchar(100) NOT NULL, plan_external_id varchar(100) NOT NULL,
        start_date date NOT NULL, end_date date, price numeric(12,2) NOT NULL DEFAULT 0,
        classes_quantity integer, status varchar(20) NOT NULL DEFAULT 'ACTIVE',
        source_created_at timestamp, source_updated_at timestamp, raw jsonb,
        synced_at timestamp NOT NULL DEFAULT now(), created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now())`,
      `CREATE INDEX IF NOT EXISTS studio_subscriptions_customer_idx ON studio_subscriptions (customer_external_id)`,
      `CREATE INDEX IF NOT EXISTS studio_subscriptions_status_idx ON studio_subscriptions (status)`,
      `CREATE TABLE IF NOT EXISTS studio_payments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), external_id varchar(100) NOT NULL UNIQUE,
        customer_external_id varchar(100), amount numeric(12,2) NOT NULL DEFAULT 0, kind varchar(20),
        payment_date date, payment_method varchar(20), status varchar(20) NOT NULL DEFAULT 'PENDING',
        reference varchar(100), notes text, unallocated_amount numeric(12,2) NOT NULL DEFAULT 0,
        enrollment_amount numeric(12,2) NOT NULL DEFAULT 0, reactivation_amount numeric(12,2) NOT NULL DEFAULT 0,
        discount_percent numeric(5,2) NOT NULL DEFAULT 0, discount_amount numeric(12,2) NOT NULL DEFAULT 0,
        registered_by_external_id varchar(100), raw jsonb, source_created_at timestamp,
        source_updated_at timestamp, synced_at timestamp NOT NULL DEFAULT now(),
        created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now())`,
      `CREATE INDEX IF NOT EXISTS studio_payments_customer_idx ON studio_payments (customer_external_id)`,
      `CREATE INDEX IF NOT EXISTS studio_payments_status_idx ON studio_payments (status)`,
      `CREATE INDEX IF NOT EXISTS studio_payments_date_idx ON studio_payments (payment_date)`,
      `CREATE TABLE IF NOT EXISTS studio_invoices (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), external_id varchar(100) NOT NULL UNIQUE,
        customer_external_id varchar(100) NOT NULL, subscription_external_id varchar(100),
        year integer, month integer, period_start date, period_end date,
        amount_due numeric(12,2) NOT NULL DEFAULT 0, amount_paid numeric(12,2) NOT NULL DEFAULT 0,
        amount_released numeric(12,2) NOT NULL DEFAULT 0, amount_remaining numeric(12,2) NOT NULL DEFAULT 0,
        status varchar(20) NOT NULL DEFAULT 'PENDING', due_date date, paid_at timestamp,
        is_partial boolean NOT NULL DEFAULT false, notes text, raw jsonb,
        synced_at timestamp NOT NULL DEFAULT now(), created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now())`,
      `CREATE INDEX IF NOT EXISTS studio_invoices_customer_idx ON studio_invoices (customer_external_id)`,
      `CREATE INDEX IF NOT EXISTS studio_invoices_status_idx ON studio_invoices (status)`,
      `CREATE INDEX IF NOT EXISTS studio_invoices_period_idx ON studio_invoices (period_start)`,
      `ALTER TABLE studio_invoices ALTER COLUMN status TYPE varchar(20)`,
      `CREATE TABLE IF NOT EXISTS studio_refunds (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), external_id varchar(100) NOT NULL UNIQUE,
        payment_external_id varchar(100), customer_external_id varchar(100),
        amount numeric(12,2) NOT NULL DEFAULT 0, reason text, status varchar(20) NOT NULL DEFAULT 'CONFIRMED',
        refunded_at timestamp, raw jsonb, synced_at timestamp NOT NULL DEFAULT now(),
        created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now())`,
      `CREATE INDEX IF NOT EXISTS studio_refunds_payment_idx ON studio_refunds (payment_external_id)`,
      `CREATE TABLE IF NOT EXISTS studio_payment_allocations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), external_id varchar(100) NOT NULL UNIQUE,
        payment_external_id varchar(100) NOT NULL, invoice_external_id varchar(100) NOT NULL,
        amount numeric(12,2) NOT NULL DEFAULT 0, raw jsonb,
        synced_at timestamp NOT NULL DEFAULT now(), created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now())`,
      `CREATE INDEX IF NOT EXISTS studio_allocations_payment_idx ON studio_payment_allocations (payment_external_id)`,
      `CREATE TABLE IF NOT EXISTS studio_api_keys (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar(255) NOT NULL,
        key_hash varchar(128) NOT NULL UNIQUE, key_prefix varchar(16) NOT NULL,
        active boolean NOT NULL DEFAULT true, last_used_at timestamp, expires_at timestamp,
        created_at timestamp NOT NULL DEFAULT now())`,
      `CREATE TABLE IF NOT EXISTS studio_sync_log (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event varchar(50) NOT NULL,
        entity varchar(50), received_count integer NOT NULL DEFAULT 0,
        upserted_count integer NOT NULL DEFAULT 0, error_count integer NOT NULL DEFAULT 0,
        status varchar(20) NOT NULL DEFAULT 'ok', message text,
        started_at timestamp NOT NULL DEFAULT now(), finished_at timestamp)`,
      `CREATE INDEX IF NOT EXISTS studio_sync_log_started_idx ON studio_sync_log (started_at)`,
    ];
    schemaReady = (async () => {
      for (const sql of ddls) await pool.query(sql);
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
    return schemaReady;
  }

  async function requireStudioKey(req, res, next) {
    try {
      await ensureSchema();
      const auth = String(req.headers.authorization || "");
      const raw = String(req.headers["x-api-key"] || (auth.startsWith("Bearer ") ? auth.slice(7) : "")).trim();
      if (!raw) return res.status(401).json({ error: "API Key em falta (header X-API-Key)" });
      const envKey = process.env.STUDIO_API_KEY || "";
      if (envKey && safeEqual(raw, envKey)) {
        req.studioKey = { id: "env", name: "STUDIO_API_KEY" };
        return next();
      }
      const r = await pool.query(
        `SELECT id, name FROM studio_api_keys
         WHERE key_hash = $1 AND active = true AND (expires_at IS NULL OR expires_at > now())`,
        [hashKey(raw)],
      );
      if (!r.rows[0]) return res.status(401).json({ error: "API Key inválida ou revogada" });
      pool.query("UPDATE studio_api_keys SET last_used_at = now() WHERE id = $1", [r.rows[0].id]).catch(() => {});
      req.studioKey = r.rows[0];
      next();
    } catch (err) {
      next(err);
    }
  }

  async function upsertCustomer(p) {
    const ext = externalId(p);
    const fullName = text(pick(p, "full_name", "fullName", "name"), 200);
    if (!fullName) throw new Error("full_name é obrigatório");
    await pool.query(
      `INSERT INTO studio_customers
        (external_id, customer_number, legacy_id, card_number, full_name, photo_url, birth_date, gender,
         nif, phone, email, status, notes, enrollment_paid_at, source_created_at, source_updated_at, raw, synced_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,now(),now())
       ON CONFLICT (external_id) DO UPDATE SET
         customer_number=EXCLUDED.customer_number, legacy_id=EXCLUDED.legacy_id,
         card_number=EXCLUDED.card_number, full_name=EXCLUDED.full_name, photo_url=EXCLUDED.photo_url,
         birth_date=EXCLUDED.birth_date, gender=EXCLUDED.gender, nif=EXCLUDED.nif, phone=EXCLUDED.phone,
         email=EXCLUDED.email, status=EXCLUDED.status, notes=EXCLUDED.notes,
         enrollment_paid_at=EXCLUDED.enrollment_paid_at, source_created_at=EXCLUDED.source_created_at,
         source_updated_at=EXCLUDED.source_updated_at, raw=EXCLUDED.raw, synced_at=now(), updated_at=now()`,
      [
        ext,
        text(pick(p, "customer_number", "customerNumber"), 20),
        text(pick(p, "legacy_id", "legacyId"), 50),
        text(pick(p, "card_number", "cardNumber"), 50),
        fullName,
        text(pick(p, "photo", "photo_url", "photoUrl"), 2000),
        dateOnly(pick(p, "birth_date", "birthDate")),
        text(pick(p, "gender"), 10),
        text(pick(p, "nif"), 30),
        text(pick(p, "phone"), 30),
        text(pick(p, "email"), 255),
        statusText(pick(p, "status"), "ACTIVE"),
        text(pick(p, "notes"), 5000),
        dateOnly(pick(p, "enrollment_paid_at", "enrollmentPaidAt")),
        stamp(pick(p, "created_at", "createdAt")),
        stamp(pick(p, "updated_at", "updatedAt")),
        rawJson(p),
      ],
    );
    // Ligação ao CRM por NIF/email/telefone, apenas quando há cliente CRM.
    await pool.query(
      `UPDATE studio_customers sc SET crm_customer_id = (
         SELECT c.id FROM customers c
         WHERE (sc.nif IS NOT NULL AND c.nif IS NOT NULL AND c.nif = sc.nif)
            OR (sc.email IS NOT NULL AND c.email IS NOT NULL AND lower(c.email) = lower(sc.email))
            OR (sc.phone IS NOT NULL AND length(regexp_replace(coalesce(c.phone,''), '\\D', '', 'g')) >= 9
                AND right(regexp_replace(coalesce(c.phone,''), '\\D', '', 'g'), 9) =
                    right(regexp_replace(sc.phone, '\\D', '', 'g'), 9))
         LIMIT 1
       )
       WHERE sc.external_id = $1 AND sc.crm_customer_id IS NULL`,
      [ext],
    );
  }

  async function upsertPlan(p) {
    const ext = externalId(p);
    const name = text(pick(p, "name"), 100);
    if (!name) throw new Error("name é obrigatório");
    await pool.query(
      `INSERT INTO studio_plans
        (external_id, name, price, enrollment_fee, renewal_fee, plan_type, classes_quantity,
         calculation_mode, validity_days, validity_months, rules, is_active, raw, synced_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now(),now())
       ON CONFLICT (external_id) DO UPDATE SET
         name=EXCLUDED.name, price=EXCLUDED.price, enrollment_fee=EXCLUDED.enrollment_fee,
         renewal_fee=EXCLUDED.renewal_fee, plan_type=EXCLUDED.plan_type,
         classes_quantity=EXCLUDED.classes_quantity, calculation_mode=EXCLUDED.calculation_mode,
         validity_days=EXCLUDED.validity_days, validity_months=EXCLUDED.validity_months,
         rules=EXCLUDED.rules, is_active=EXCLUDED.is_active, raw=EXCLUDED.raw,
         synced_at=now(), updated_at=now()`,
      [
        ext,
        name,
        num(pick(p, "price")),
        num(pick(p, "enrollment_fee", "enrollmentFee")),
        num(pick(p, "renewal_fee", "renewalFee")),
        text(pick(p, "plan_type", "planType"), 20),
        intOrNull(pick(p, "classes_quantity", "classesQuantity")),
        text(pick(p, "calculation_mode", "calculationMode"), 20),
        intOrNull(pick(p, "validity_days", "validityDays")),
        intOrNull(pick(p, "validity_months", "validityMonths")) ?? 1,
        text(pick(p, "rules"), 5000),
        bool(pick(p, "is_active", "isActive"), true),
        rawJson(p),
      ],
    );
    await pool.query(
      `UPDATE studio_plans sp SET crm_plan_id = p.id
       FROM (SELECT id FROM plans WHERE lower(name) = lower((SELECT name FROM studio_plans WHERE external_id=$1)) LIMIT 1) p
       WHERE sp.external_id = $1 AND sp.crm_plan_id IS NULL`,
      [ext],
    ).catch(() => {});
  }

  async function upsertSubscription(p) {
    const ext = externalId(p);
    const customer = text(pick(p, "customer_external_id", "customerExternalId", "customer_id", "customerId", "customer"), 100);
    const plan = text(pick(p, "plan_external_id", "planExternalId", "plan_id", "planId", "plan"), 100);
    const start = dateOnly(pick(p, "start_date", "startDate"));
    if (!customer || !plan || !start) throw new Error("customer_external_id, plan_external_id e start_date são obrigatórios");
    await pool.query(
      `INSERT INTO studio_subscriptions
        (external_id, customer_external_id, plan_external_id, start_date, end_date, price,
         classes_quantity, status, source_created_at, source_updated_at, raw, synced_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now(),now())
       ON CONFLICT (external_id) DO UPDATE SET
         customer_external_id=EXCLUDED.customer_external_id, plan_external_id=EXCLUDED.plan_external_id,
         start_date=EXCLUDED.start_date, end_date=EXCLUDED.end_date, price=EXCLUDED.price,
         classes_quantity=EXCLUDED.classes_quantity, status=EXCLUDED.status,
         source_created_at=EXCLUDED.source_created_at, source_updated_at=EXCLUDED.source_updated_at,
         raw=EXCLUDED.raw, synced_at=now(), updated_at=now()`,
      [
        ext, customer, plan, start,
        dateOnly(pick(p, "end_date", "endDate")),
        num(pick(p, "price")),
        intOrNull(pick(p, "classes_quantity", "classesQuantity")),
        statusText(pick(p, "status"), "ACTIVE"),
        stamp(pick(p, "created_at", "createdAt")),
        stamp(pick(p, "updated_at", "updatedAt")),
        rawJson(p),
      ],
    );
  }

  async function upsertPayment(p) {
    const ext = externalId(p);
    await pool.query(
      `INSERT INTO studio_payments
        (external_id, customer_external_id, amount, kind, payment_date, payment_method, status,
         reference, notes, unallocated_amount, enrollment_amount, reactivation_amount,
         discount_percent, discount_amount, registered_by_external_id, raw,
         source_created_at, source_updated_at, synced_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,now(),now())
       ON CONFLICT (external_id) DO UPDATE SET
         customer_external_id=EXCLUDED.customer_external_id, amount=EXCLUDED.amount, kind=EXCLUDED.kind,
         payment_date=EXCLUDED.payment_date, payment_method=EXCLUDED.payment_method, status=EXCLUDED.status,
         reference=EXCLUDED.reference, notes=EXCLUDED.notes, unallocated_amount=EXCLUDED.unallocated_amount,
         enrollment_amount=EXCLUDED.enrollment_amount, reactivation_amount=EXCLUDED.reactivation_amount,
         discount_percent=EXCLUDED.discount_percent, discount_amount=EXCLUDED.discount_amount,
         registered_by_external_id=EXCLUDED.registered_by_external_id, raw=EXCLUDED.raw,
         source_created_at=EXCLUDED.source_created_at, source_updated_at=EXCLUDED.source_updated_at,
         synced_at=now(), updated_at=now()`,
      [
        ext,
        text(pick(p, "customer_external_id", "customerExternalId", "customer_id", "customerId", "customer"), 100),
        num(pick(p, "amount")),
        text(pick(p, "kind"), 20),
        dateOnly(pick(p, "payment_date", "paymentDate")),
        text(pick(p, "payment_method", "paymentMethod"), 20),
        statusText(pick(p, "status"), "PENDING"),
        text(pick(p, "reference"), 100),
        text(pick(p, "notes"), 5000),
        num(pick(p, "unallocated_amount", "unallocatedAmount")),
        num(pick(p, "enrollment_amount", "enrollmentAmount")),
        num(pick(p, "reactivation_amount", "reactivationAmount")),
        num(pick(p, "discount_percent", "discountPercent")),
        num(pick(p, "discount_amount", "discountAmount")),
        text(pick(p, "registered_by_external_id", "registeredByExternalId", "registered_by", "registeredBy"), 100),
        rawJson(p),
        stamp(pick(p, "created_at", "createdAt")),
        stamp(pick(p, "updated_at", "updatedAt")),
      ],
    );
  }

  async function upsertInvoice(p) {
    const ext = externalId(p);
    const customer = text(pick(p, "customer_external_id", "customerExternalId", "customer_id", "customerId", "customer"), 100);
    if (!customer) throw new Error("customer_external_id é obrigatório");
    await pool.query(
      `INSERT INTO studio_invoices
        (external_id, customer_external_id, subscription_external_id, year, month, period_start, period_end,
         amount_due, amount_paid, amount_released, amount_remaining, status, due_date, paid_at,
         is_partial, notes, raw, synced_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,now(),now())
       ON CONFLICT (external_id) DO UPDATE SET
         customer_external_id=EXCLUDED.customer_external_id,
         subscription_external_id=EXCLUDED.subscription_external_id, year=EXCLUDED.year, month=EXCLUDED.month,
         period_start=EXCLUDED.period_start, period_end=EXCLUDED.period_end, amount_due=EXCLUDED.amount_due,
         amount_paid=EXCLUDED.amount_paid, amount_released=EXCLUDED.amount_released,
         amount_remaining=EXCLUDED.amount_remaining, status=EXCLUDED.status, due_date=EXCLUDED.due_date,
         paid_at=EXCLUDED.paid_at, is_partial=EXCLUDED.is_partial, notes=EXCLUDED.notes,
         raw=EXCLUDED.raw, synced_at=now(), updated_at=now()`,
      [
        ext,
        customer,
        text(pick(p, "subscription_external_id", "subscriptionExternalId", "subscription_id", "subscriptionId", "subscription"), 100),
        intOrNull(pick(p, "year")),
        intOrNull(pick(p, "month")),
        dateOnly(pick(p, "period_start", "periodStart")),
        dateOnly(pick(p, "period_end", "periodEnd")),
        num(pick(p, "amount_due", "amountDue")),
        num(pick(p, "amount_paid", "amountPaid")),
        num(pick(p, "amount_released", "amountReleased")),
        num(pick(p, "amount_remaining", "amountRemaining")),
        statusText(pick(p, "status"), "PENDING"),
        dateOnly(pick(p, "due_date", "dueDate")),
        stamp(pick(p, "paid_at", "paidAt")),
        bool(pick(p, "is_partial", "isPartial"), false),
        text(pick(p, "notes"), 5000),
        rawJson(p),
      ],
    );
  }

  async function upsertRefund(p) {
    const ext = externalId(p);
    await pool.query(
      `INSERT INTO studio_refunds
        (external_id, payment_external_id, customer_external_id, amount, reason, status, refunded_at, raw, synced_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now(),now())
       ON CONFLICT (external_id) DO UPDATE SET
         payment_external_id=EXCLUDED.payment_external_id,
         customer_external_id=EXCLUDED.customer_external_id, amount=EXCLUDED.amount,
         reason=EXCLUDED.reason, status=EXCLUDED.status, refunded_at=EXCLUDED.refunded_at,
         raw=EXCLUDED.raw, synced_at=now(), updated_at=now()`,
      [
        ext,
        text(pick(p, "payment_external_id", "paymentExternalId", "payment_id", "paymentId", "payment"), 100),
        text(pick(p, "customer_external_id", "customerExternalId", "customer_id", "customerId", "customer"), 100),
        num(pick(p, "amount")),
        text(pick(p, "reason"), 5000),
        statusText(pick(p, "status"), "CONFIRMED"),
        stamp(pick(p, "refunded_at", "refundedAt", "created_at", "createdAt")),
        rawJson(p),
      ],
    );
  }

  async function upsertAllocation(p) {
    const payment = text(pick(p, "payment_external_id", "paymentExternalId", "payment_id", "paymentId", "payment"), 100);
    const invoice = text(pick(p, "invoice_external_id", "invoiceExternalId", "billing_period_id", "billingPeriodId", "billing_period", "billingPeriod"), 100);
    if (!payment || !invoice) throw new Error("payment_external_id e invoice_external_id são obrigatórios");
    const ext = text(pick(p, "external_id", "externalId", "id"), 100) || `${payment}:${invoice}`;
    await pool.query(
      `INSERT INTO studio_payment_allocations
        (external_id, payment_external_id, invoice_external_id, amount, raw, synced_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,now(),now())
       ON CONFLICT (external_id) DO UPDATE SET
         payment_external_id=EXCLUDED.payment_external_id,
         invoice_external_id=EXCLUDED.invoice_external_id, amount=EXCLUDED.amount,
         raw=EXCLUDED.raw, synced_at=now(), updated_at=now()`,
      [ext, payment, invoice, num(pick(p, "amount")), rawJson(p)],
    );
  }

  const ENTITIES = {
    customers: { label: "customer", upsert: upsertCustomer },
    plans: { label: "plan", upsert: upsertPlan },
    subscriptions: { label: "subscription", upsert: upsertSubscription },
    payments: { label: "payment", upsert: upsertPayment },
    invoices: { label: "invoice", upsert: upsertInvoice },
    refunds: { label: "refund", upsert: upsertRefund },
    payment_allocations: { label: "payment_allocation", upsert: upsertAllocation },
  };

  async function removeEntity(entity, ext) {
    if (!ext) return;
    if (entity === "customers") {
      await pool.query("UPDATE studio_customers SET status='INACTIVE', synced_at=now(), updated_at=now() WHERE external_id=$1", [ext]);
    } else if (entity === "plans") {
      await pool.query("UPDATE studio_plans SET is_active=false, synced_at=now(), updated_at=now() WHERE external_id=$1", [ext]);
    } else if (entity === "subscriptions") {
      await pool.query("UPDATE studio_subscriptions SET status='CANCELLED', synced_at=now(), updated_at=now() WHERE external_id=$1", [ext]);
    } else if (entity === "payments") {
      await pool.query("DELETE FROM studio_payments WHERE external_id=$1", [ext]);
    } else if (entity === "invoices") {
      await pool.query("DELETE FROM studio_invoices WHERE external_id=$1", [ext]);
    } else if (entity === "refunds") {
      await pool.query("DELETE FROM studio_refunds WHERE external_id=$1", [ext]);
    } else if (entity === "payment_allocations") {
      await pool.query("DELETE FROM studio_payment_allocations WHERE external_id=$1", [ext]);
    }
  }

  function entityFromName(name) {
    const s = String(name || "").toLowerCase();
    if (s.startsWith("customer")) return "customers";
    if (s.startsWith("plan")) return "plans";
    if (s.startsWith("subscription")) return "subscriptions";
    if (s.startsWith("payment_allocation") || s.startsWith("allocation")) return "payment_allocations";
    if (s.startsWith("payment")) return "payments";
    if (s.startsWith("invoice") || s.startsWith("billing")) return "invoices";
    if (s.startsWith("refund")) return "refunds";
    return null;
  }

  async function processEntity(entity, items) {
    const def = ENTITIES[entity];
    if (!def) return { received: 0, upserted: 0, errors: [] };
    const list = Array.isArray(items) ? items : (items && typeof items === "object" ? [items] : []);
    const errors = [];
    let upserted = 0;
    for (const item of list) {
      try {
        await def.upsert(item);
        upserted += 1;
      } catch (err) {
        let ext = "";
        try { ext = externalId(item); } catch {}
        errors.push({ entity: def.label, external_id: ext || null, message: String(err?.message || err).slice(0, 300) });
      }
    }
    return { received: list.length, upserted, errors };
  }

  async function logSync({ event, entity, received, upserted, errors, started, message }) {
    try {
      await pool.query(
        `INSERT INTO studio_sync_log
          (event, entity, received_count, upserted_count, error_count, status, message, started_at, finished_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())`,
        [
          event, entity || null, received, upserted, errors.length,
          errors.length ? "partial" : "ok",
          message || (errors.length ? JSON.stringify(errors).slice(0, 4000) : null),
          new Date(started).toISOString(),
        ],
      );
    } catch {}
  }

  // ─── Ingestão ──────────────────────────────────────────────────────────────
  app.post(`${PREFIX}/sync`, rateLimit(120), requireStudioKey, async (req, res, next) => {
    const started = Date.now();
    try {
      await ensureSchema();
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const source = body.data && typeof body.data === "object" ? body.data : body;
      const summary = {};
      const allErrors = [];
      let received = 0;
      let upserted = 0;
      for (const entity of Object.keys(ENTITIES)) {
        if (!(entity in source)) continue;
        const result = await processEntity(entity, source[entity]);
        summary[entity] = { received: result.received, upserted: result.upserted, failed: result.errors.length };
        received += result.received;
        upserted += result.upserted;
        allErrors.push(...result.errors);
      }
      const status = allErrors.length ? "partial" : "ok";
      await logSync({ event: "sync", entity: "bulk", received, upserted, errors: allErrors, started });
      audit(req, "studio.sync", {
        actor: "SamoraFit Studio",
        details: { received, upserted, failed: allErrors.length, entities: Object.keys(summary) },
      });
      res.status(allErrors.length ? 207 : 200).json({
        ok: allErrors.length === 0,
        status,
        data: { received, upserted, failed: allErrors.length, by_entity: summary },
        errors: allErrors.slice(0, 100),
      });
    } catch (err) {
      await logSync({ event: "sync", entity: "bulk", received: 0, upserted: 0, errors: [{ message: String(err?.message || err) }], started });
      next(err);
    }
  });

  app.post(`${PREFIX}/events`, rateLimit(240), requireStudioKey, async (req, res, next) => {
    const started = Date.now();
    try {
      await ensureSchema();
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const event = String(pick(body, "event", "type") || "upsert");
      const entity = entityFromName(pick(body, "entity", "resource") || event);
      if (!entity) return res.status(400).json({ error: "entity/event inválido" });
      const data = pick(body, "data", "record", "payload") ?? body;
      const ext = (() => { try { return externalId(data); } catch { return null; } })();
      if (event.toLowerCase().includes("delete")) {
        if (!ext) return res.status(400).json({ error: "external_id é obrigatório" });
        await removeEntity(entity, ext);
        await logSync({ event, entity, received: 1, upserted: 0, errors: [], started, message: `removido ${ext}` });
        audit(req, "studio.event", { actor: "SamoraFit Studio", details: { event, entity, external_id: ext } });
        return res.json({ ok: true, event, entity, external_id: ext, deleted: true });
      }
      const def = ENTITIES[entity];
      await def.upsert(data);
      await logSync({ event, entity, received: 1, upserted: 1, errors: [], started });
      audit(req, "studio.event", { actor: "SamoraFit Studio", details: { event, entity, external_id: ext } });
      res.json({ ok: true, event, entity, external_id: ext, upserted: 1 });
    } catch (err) {
      if (err?.message && /obrigat/.test(err.message)) return res.status(400).json({ error: err.message });
      next(err);
    }
  });

  async function statusPayload(req) {
    await ensureSchema();
    const proto = String(req.get("x-forwarded-proto") || req.protocol || "https").split(",")[0].trim();
    const host = String(req.get("x-forwarded-host") || req.get("host") || "").split(",")[0].trim();
    const [customers, plans, subscriptions, payments, invoices, refunds, keys, last] = await Promise.all([
      pool.query("SELECT count(*)::int n, count(*) FILTER (WHERE status='ACTIVE')::int active FROM studio_customers"),
      pool.query("SELECT count(*)::int n, count(*) FILTER (WHERE is_active)::int active FROM studio_plans"),
      pool.query("SELECT count(*)::int n, count(*) FILTER (WHERE status='ACTIVE')::int active FROM studio_subscriptions"),
      pool.query("SELECT count(*)::int n, coalesce(sum(amount),0) total FROM studio_payments"),
      pool.query("SELECT count(*)::int n, coalesce(sum(amount_remaining),0) pending FROM studio_invoices"),
      pool.query("SELECT count(*)::int n, coalesce(sum(amount),0) total FROM studio_refunds"),
      pool.query("SELECT count(*)::int n FROM studio_api_keys WHERE active"),
      pool.query("SELECT * FROM studio_sync_log ORDER BY started_at DESC LIMIT 1"),
    ]);
    return {
      ok: true,
      service: "SamoraFit Studio",
      api_url: `${proto}://${host}${PREFIX}`,
      version: "1.0",
      received: {
        customers: customers.rows[0],
        plans: plans.rows[0],
        subscriptions: subscriptions.rows[0],
        payments: payments.rows[0],
        invoices: invoices.rows[0],
        refunds: refunds.rows[0],
      },
      api_keys_active: keys.rows[0].n,
      last_sync: last.rows[0] || null,
      server_time: new Date().toISOString(),
    };
  }

  app.get(`${PREFIX}/status`, requireStudioKey, async (req, res, next) => {
    try { res.json(await statusPayload(req)); } catch (err) { next(err); }
  });

  // ─── Chaves dedicadas ──────────────────────────────────────────────────────
  const requireAdmin = requireRole("administrador");

  app.get(`${PREFIX}/keys`, requireAuth, requireAdmin, async (_req, res, next) => {
    try {
      await ensureSchema();
      const r = await pool.query(
        `SELECT id, name, key_prefix, active, last_used_at, expires_at, created_at
         FROM studio_api_keys ORDER BY created_at DESC`,
      );
      res.json({
        data: r.rows.map((k) => ({
          id: k.id, name: k.name, prefix: k.key_prefix, active: k.active,
          lastUsedAt: k.last_used_at, expiresAt: k.expires_at, createdAt: k.created_at,
        })),
        total: r.rows.length,
      });
    } catch (err) { next(err); }
  });

  app.post(`${PREFIX}/keys`, requireAuth, requireAdmin, async (req, res, next) => {
    try {
      await ensureSchema();
      const name = text(req.body?.name, 255) || "SamoraFit Studio";
      const raw = `sfs_${crypto.randomBytes(24).toString("hex")}`;
      const r = await pool.query(
        `INSERT INTO studio_api_keys (name, key_hash, key_prefix)
         VALUES ($1,$2,$3) RETURNING id, name, key_prefix, created_at`,
        [name, hashKey(raw), raw.slice(0, 12)],
      );
      audit(req, "studio.api_key_created", { actor: req.user?.name, actorId: req.user?.userId, entity: "studio_api_key", entityId: r.rows[0].id, details: { name } });
      res.status(201).json({
        data: {
          id: r.rows[0].id, name: r.rows[0].name, prefix: r.rows[0].key_prefix,
          key: raw, createdAt: r.rows[0].created_at,
        },
        message: "Guarde a chave agora: não voltará a ser mostrada.",
      });
    } catch (err) { next(err); }
  });

  app.delete(`${PREFIX}/keys/:id`, requireAuth, requireAdmin, async (req, res, next) => {
    try {
      await ensureSchema();
      const r = await pool.query("UPDATE studio_api_keys SET active=false WHERE id=$1 RETURNING id", [req.params.id]);
      if (!r.rows[0]) return res.status(404).json({ error: "Chave não encontrada" });
      audit(req, "studio.api_key_revoked", { actor: req.user?.name, actorId: req.user?.userId, entity: "studio_api_key", entityId: req.params.id });
      res.status(204).end();
    } catch (err) { next(err); }
  });

  // ─── Leitura para o CRM ────────────────────────────────────────────────────
  const mapCustomer = (r) => ({
    id: r.id, externalId: r.external_id, customerNumber: r.customer_number, legacyId: r.legacy_id,
    cardNumber: r.card_number, name: r.full_name, photoUrl: r.photo_url, birthDate: r.birth_date,
    gender: r.gender, nif: r.nif, phone: r.phone, email: r.email, status: r.status, notes: r.notes,
    enrollmentPaidAt: r.enrollment_paid_at, crmCustomerId: r.crm_customer_id, syncedAt: r.synced_at,
  });
  const mapPlan = (r) => ({
    id: r.id, externalId: r.external_id, name: r.name, price: Number(r.price),
    enrollmentFee: Number(r.enrollment_fee), renewalFee: Number(r.renewal_fee), planType: r.plan_type,
    classesQuantity: r.classes_quantity, calculationMode: r.calculation_mode, validityDays: r.validity_days,
    validityMonths: r.validity_months, rules: r.rules, active: r.is_active, crmPlanId: r.crm_plan_id,
    syncedAt: r.synced_at,
  });
  const mapSubscription = (r) => ({
    id: r.id, externalId: r.external_id, customerExternalId: r.customer_external_id,
    planExternalId: r.plan_external_id, customerName: r.customer_name, planName: r.plan_name,
    startDate: r.start_date, endDate: r.end_date, price: Number(r.price),
    classesQuantity: r.classes_quantity, status: r.status, syncedAt: r.synced_at,
  });
  const mapPayment = (r) => ({
    id: r.id, externalId: r.external_id, customerExternalId: r.customer_external_id,
    customerName: r.customer_name, amount: Number(r.amount), kind: r.kind,
    paymentDate: r.payment_date, paymentMethod: r.payment_method, status: r.status,
    reference: r.reference, notes: r.notes, unallocatedAmount: Number(r.unallocated_amount),
    enrollmentAmount: Number(r.enrollment_amount), reactivationAmount: Number(r.reactivation_amount),
    discountPercent: Number(r.discount_percent), discountAmount: Number(r.discount_amount),
    syncedAt: r.synced_at,
  });
  const mapInvoice = (r) => ({
    id: r.id, externalId: r.external_id, customerExternalId: r.customer_external_id,
    customerName: r.customer_name, subscriptionExternalId: r.subscription_external_id,
    year: r.year, month: r.month, periodStart: r.period_start, periodEnd: r.period_end,
    amountDue: Number(r.amount_due), amountPaid: Number(r.amount_paid),
    amountReleased: Number(r.amount_released), amountRemaining: Number(r.amount_remaining),
    status: r.status, dueDate: r.due_date, paidAt: r.paid_at, isPartial: r.is_partial,
    notes: r.notes, syncedAt: r.synced_at,
  });
  const mapRefund = (r) => ({
    id: r.id, externalId: r.external_id, paymentExternalId: r.payment_external_id,
    customerExternalId: r.customer_external_id, customerName: r.customer_name,
    amount: Number(r.amount), reason: r.reason, status: r.status,
    refundedAt: r.refunded_at, syncedAt: r.synced_at,
  });

  app.get(`${PREFIX}/overview`, requireAuth, async (_req, res, next) => {
    try {
      await ensureSchema();
      const [customers, plans, subs, payments, invoices, refunds, last] = await Promise.all([
        pool.query("SELECT count(*)::int total, count(*) FILTER (WHERE status='ACTIVE')::int active FROM studio_customers"),
        pool.query("SELECT count(*)::int total, count(*) FILTER (WHERE is_active)::int active FROM studio_plans"),
        pool.query("SELECT count(*)::int total, count(*) FILTER (WHERE status='ACTIVE')::int active FROM studio_subscriptions"),
        pool.query("SELECT count(*)::int total, coalesce(sum(amount) FILTER (WHERE status='CONFIRMED'),0) amount, count(*) FILTER (WHERE status='CONFIRMED')::int confirmed FROM studio_payments"),
        pool.query("SELECT count(*)::int total, coalesce(sum(amount_remaining),0) pending FROM studio_invoices WHERE status IN ('PENDING','OVERDUE')"),
        pool.query("SELECT count(*)::int total, coalesce(sum(amount),0) amount FROM studio_refunds"),
        pool.query("SELECT * FROM studio_sync_log ORDER BY started_at DESC LIMIT 1"),
      ]);
      res.json({
        data: {
          customers: customers.rows[0], plans: plans.rows[0], subscriptions: subs.rows[0],
          payments: { ...payments.rows[0], amount: Number(payments.rows[0].amount) },
          invoices: { ...invoices.rows[0], pending: Number(invoices.rows[0].pending) },
          refunds: { ...refunds.rows[0], amount: Number(refunds.rows[0].amount) },
          lastSync: last.rows[0] || null,
        },
      });
    } catch (err) { next(err); }
  });

  app.get(`${PREFIX}/snapshot`, requireAuth, async (req, res, next) => {
    try {
      await ensureSchema();
      const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
      const [customers, plans, subscriptions, payments, invoices, refunds] = await Promise.all([
        pool.query("SELECT * FROM studio_customers ORDER BY full_name ASC LIMIT $1", [limit]),
        pool.query("SELECT * FROM studio_plans ORDER BY name ASC LIMIT $1", [limit]),
        pool.query(
          `SELECT s.*, c.full_name AS customer_name, p.name AS plan_name
           FROM studio_subscriptions s
           LEFT JOIN studio_customers c ON c.external_id=s.customer_external_id
           LEFT JOIN studio_plans p ON p.external_id=s.plan_external_id
           ORDER BY s.start_date DESC LIMIT $1`, [limit]),
        pool.query(
          `SELECT pay.*, c.full_name AS customer_name FROM studio_payments pay
           LEFT JOIN studio_customers c ON c.external_id=pay.customer_external_id
           ORDER BY pay.payment_date DESC NULLS LAST, pay.created_at DESC LIMIT $1`, [limit]),
        pool.query(
          `SELECT i.*, c.full_name AS customer_name FROM studio_invoices i
           LEFT JOIN studio_customers c ON c.external_id=i.customer_external_id
           ORDER BY i.period_start DESC NULLS LAST, i.created_at DESC LIMIT $1`, [limit]),
        pool.query(
          `SELECT r.*, c.full_name AS customer_name FROM studio_refunds r
           LEFT JOIN studio_customers c ON c.external_id=r.customer_external_id
           ORDER BY r.refunded_at DESC NULLS LAST, r.created_at DESC LIMIT $1`, [limit]),
      ]);
      res.json({
        data: {
          customers: customers.rows.map(mapCustomer),
          plans: plans.rows.map(mapPlan),
          subscriptions: subscriptions.rows.map(mapSubscription),
          payments: payments.rows.map(mapPayment),
          invoices: invoices.rows.map(mapInvoice),
          refunds: refunds.rows.map(mapRefund),
        },
      });
    } catch (err) { next(err); }
  });

  async function listRoute(path, sql, map, filters = [], orderBy = "synced_at DESC") {
    app.get(`${PREFIX}/${path}`, requireAuth, async (req, res, next) => {
      try {
        await ensureSchema();
        const where = [];
        const params = [];
        for (const f of filters) {
          if (req.query[f.query] !== undefined && req.query[f.query] !== "") {
            params.push(String(req.query[f.query]));
            where.push(`${f.column} = $${params.length}`);
          }
        }
        const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
        const offset = Math.max(Number(req.query.offset) || 0, 0);
        params.push(limit, offset);
        const r = await pool.query(
          `${sql}${where.length ? " WHERE " + where.join(" AND ") : ""}
           ORDER BY ${orderBy}
           LIMIT $${params.length - 1} OFFSET $${params.length}`,
          params,
        );
        res.json({ data: r.rows.map(map), total: r.rows.length, limit, offset });
      } catch (err) { next(err); }
    });
  }

  listRoute("customers", "SELECT * FROM studio_customers", mapCustomer, [
    { query: "status", column: "status" },
  ], "full_name ASC");
  listRoute("plans", "SELECT * FROM studio_plans", mapPlan, [
    { query: "active", column: "is_active" },
  ], "synced_at DESC");
  listRoute(
    "subscriptions",
    `SELECT s.*, c.full_name AS customer_name, p.name AS plan_name
     FROM studio_subscriptions s
     LEFT JOIN studio_customers c ON c.external_id=s.customer_external_id
     LEFT JOIN studio_plans p ON p.external_id=s.plan_external_id`,
    mapSubscription,
    [
      { query: "customer_external_id", column: "s.customer_external_id" },
      { query: "status", column: "s.status" },
    ],
    "s.synced_at DESC",
  );
  listRoute(
    "payments",
    `SELECT pay.*, c.full_name AS customer_name
     FROM studio_payments pay
     LEFT JOIN studio_customers c ON c.external_id=pay.customer_external_id`,
    mapPayment,
    [
      { query: "customer_external_id", column: "pay.customer_external_id" },
      { query: "status", column: "pay.status" },
    ],
    "pay.synced_at DESC",
  );
  listRoute(
    "invoices",
    `SELECT i.*, c.full_name AS customer_name
     FROM studio_invoices i
     LEFT JOIN studio_customers c ON c.external_id=i.customer_external_id`,
    mapInvoice,
    [
      { query: "customer_external_id", column: "i.customer_external_id" },
      { query: "status", column: "i.status" },
    ],
    "i.synced_at DESC",
  );
  listRoute(
    "refunds",
    `SELECT r.*, c.full_name AS customer_name
     FROM studio_refunds r
     LEFT JOIN studio_customers c ON c.external_id=r.customer_external_id`,
    mapRefund,
    [
      { query: "customer_external_id", column: "r.customer_external_id" },
    ],
    "r.synced_at DESC",
  );

  app.get(`${PREFIX}/sync-log`, requireAuth, async (_req, res, next) => {
    try {
      await ensureSchema();
      const r = await pool.query("SELECT * FROM studio_sync_log ORDER BY started_at DESC LIMIT 50");
      res.json({ data: r.rows, total: r.rows.length });
    } catch (err) { next(err); }
  });

  return ensureSchema;
}

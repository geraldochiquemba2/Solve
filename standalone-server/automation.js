const TRIGGER_ALIASES = {
  "pagamento.confirmado": "payment_confirmed",
  "pagamento.pendente": "payment_pending",
  "pagamento.em_atraso": "payment_overdue",
  "pagamento.recusado": "payment_rejected",
  "pagamento.falhado": "payment_failed",
  "payment.failed": "payment_failed",
  "lead.criado": "lead_created",
  "lead.convertido": "lead_converted",
  "lead.sem_atividade": "lead_no_activity",
  "cliente.criado": "customer_created",
  "cliente.bloqueado": "client_blocked",
  "cliente.inativo": "client_inactive",
  "acesso.negado": "access_denied",
  "acesso.concedido": "access_granted",
  "curso.acesso.concedido": "course_access_granted",
  "aulas.esgotadas": "lessons_exhausted",
  "subscricao.ativada": "subscription_activated",
  "subscricao.renovada": "subscription_renewed",
  "subscricao.a_expirar": "subscription_expiring",
  "subscricao.expirada": "subscription_expired",
  "subscricao.em_atraso": "payment_overdue",
  "aniversario.cliente": "customer_birthday",
  "nps.pedido": "nps_requested",
  "payment.confirmed": "payment_confirmed",
  "payment.pending": "payment_pending",
  "payment.overdue": "payment_overdue",
  "lead.created": "lead_created",
  "lead.converted": "lead_converted",
  "client.blocked": "client_blocked",
  "client.inactive": "client_inactive",
  "access.denied": "access_denied",
  "access.granted": "access_granted",
  "lessons.exhausted": "lessons_exhausted",
  "subscription.activated": "subscription_activated",
  "subscription.renewed": "subscription_renewed",
  "subscription.expiring": "subscription_expiring",
  "subscription.expired": "subscription_expired",
  "customer.created": "customer_created",
  "customer.birthday": "customer_birthday",
  "nps.requested": "nps_requested",
};

const EVENT_TITLES = {
  payment_confirmed: "Pagamento confirmado",
  payment_pending: "Pagamento pendente",
  payment_overdue: "Pagamento em atraso",
  payment_rejected: "Pagamento recusado",
  payment_failed: "Pagamento falhado",
  lead_created: "Nova lead",
  lead_converted: "Lead convertida",
  lead_no_activity: "Lead sem atividade",
  customer_created: "Novo cliente",
  client_blocked: "Cliente bloqueado",
  client_inactive: "Cliente inativo",
  access_denied: "Acesso negado",
  access_granted: "Acesso concedido",
  course_access_granted: "Acesso a curso concedido",
  lessons_exhausted: "Aulas esgotadas",
  subscription_activated: "Subscrição ativada",
  subscription_renewed: "Subscrição renovada",
  subscription_expiring: "Subscrição a expirar",
  subscription_expired: "Subscrição expirada",
  customer_birthday: "Aniversário do cliente",
  nps_requested: "Pedido de NPS",
};

const KNOWN_TRIGGERS = new Set(Object.values(TRIGGER_ALIASES));
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ATTEMPTS = 5;

export function canonicalTrigger(value) {
  const raw = String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
  if (!raw) return "";
  return TRIGGER_ALIASES[raw] || raw;
}

function asObject(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return null;
}

function toActionList(action) {
  const raw = String(action || "").trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    return list
      .map((item) => {
        if (typeof item === "string") return { type: item, params: {} };
        if (item && typeof item === "object" && item.type) return { type: String(item.type), params: item.params || item };
        return null;
      })
      .filter(Boolean);
  } catch {
    return [{ type: raw, params: {} }];
  }
}

function render(template, ctx) {
  return String(template || "").replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key) => {
    const value = key.split(".").reduce((acc, part) => (acc == null ? acc : acc[part]), ctx);
    return value == null ? "" : String(value);
  });
}

function defaultMessage(eventType, ctx) {
  const name = ctx.customerName || ctx.name || ctx.leadName || "Cliente";
  const amount = ctx.amount != null ? `${ctx.amount} Kz` : "";
  const plan = ctx.planName ? ` (${ctx.planName})` : "";
  const code = ctx.code || ctx.paymentCode || "";
  switch (eventType) {
    case "payment_confirmed":
      return `Pagamento confirmado para ${name}${plan}${amount ? `: ${amount}` : ""}${code ? ` — ${code}` : ""}.`;
    case "payment_pending":
      return `Pagamento pendente para ${name}${plan}${amount ? `: ${amount}` : ""}${code ? ` — ${code}` : ""}.`;
    case "payment_overdue":
      return `Pagamento em atraso para ${name}${plan}${code ? ` — ${code}` : ""}.`;
    case "payment_failed":
    case "payment_rejected":
      return `O pagamento de ${name}${plan} não foi concluído.`;
    case "lead_created":
      return `Nova lead: ${ctx.leadName || name}${ctx.source ? ` (${ctx.source})` : ""}.`;
    case "lead_converted":
      return `A lead ${ctx.leadName || name} foi convertida em cliente.`;
    case "lead_no_activity":
      return `A lead ${ctx.leadName || name} está sem contacto há vários dias.`;
    case "customer_created":
      return `Novo cliente registado: ${name}.`;
    case "lessons_exhausted":
      return `${name} concluiu as aulas incluídas no plano${plan}.`;
    case "client_blocked":
    case "access_denied":
      return `Acesso bloqueado para ${name}.`;
    case "access_granted":
      return `Acesso concedido a ${name}${plan}.`;
    case "course_access_granted":
      return `Acesso ao curso concedido a ${name}.`;
    case "subscription_activated":
      return `Subscrição ativada para ${name}${plan}.`;
    case "subscription_renewed":
      return `Subscrição renovada para ${name}${plan}.`;
    case "subscription_expiring":
      return `A subscrição de ${name}${plan} está a expirar.`;
    case "subscription_expired":
      return `A subscrição de ${name}${plan} expirou.`;
    case "customer_birthday":
      return `Hoje é o aniversário de ${name}.`;
    case "nps_requested":
      return `Pedido de avaliação (NPS) para ${name}.`;
    default:
      return EVENT_TITLES[eventType] || `Evento ${eventType}`;
  }
}

function addMonths(date, months) {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d;
}

function periodMonths(periodicity) {
  const p = String(periodicity || "mensal").toLowerCase();
  if (p === "anual") return 12;
  if (p === "semestral") return 6;
  if (p === "trimestral") return 3;
  return 1;
}

function actionFailed(result) {
  if (!result || typeof result !== "object") return false;
  if (result.error) return true;
  if (result.ok === false) return true;
  return false;
}

export function createAutomationEngine({ pool, whatsapp, onSyncCademi, getSetting, dryRun } = {}) {
  let processing = false;
  const isDryRun = dryRun === undefined
    ? String(process.env.AUTOMATION_DRY_RUN || "").toLowerCase() === "true" || String(process.env.AUTOMATION_DRY_RUN || "") === "1"
    : Boolean(dryRun);

  async function ensureSchema() {
    await pool.query(`CREATE TABLE IF NOT EXISTS automation_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_type VARCHAR(80) NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      processed_at TIMESTAMPTZ,
      last_error TEXT,
      result JSONB,
      dedupe_key VARCHAR(200),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query("ALTER TABLE automation_events ADD COLUMN IF NOT EXISTS result JSONB").catch(() => {});
    await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS automation_events_dedupe_idx ON automation_events (dedupe_key) WHERE dedupe_key IS NOT NULL");
    await pool.query("CREATE INDEX IF NOT EXISTS automation_events_pending_idx ON automation_events (status, available_at)");
    await pool.query("CREATE INDEX IF NOT EXISTS automation_events_created_idx ON automation_events (created_at DESC)");
    await pool.query("CREATE INDEX IF NOT EXISTS automation_events_type_created_idx ON automation_events (event_type, created_at DESC)");
  }

  async function enqueue(eventType, payload = {}, { dedupeKey = null, availableAt = null, client = null } = {}) {
    const type = canonicalTrigger(eventType);
    if (!KNOWN_TRIGGERS.has(type)) return null;
    const runner = client || pool;
    try {
      const r = await runner.query(
        `INSERT INTO automation_events (event_type, payload, dedupe_key, available_at)
         VALUES ($1, $2::jsonb, $3, COALESCE($4::timestamptz, NOW()))
         ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
         RETURNING id`,
        [type, JSON.stringify(payload || {}), dedupeKey ? String(dedupeKey).slice(0, 200) : null, availableAt]
      );
      if (r.rows[0]?.id && !client) setImmediate(() => processPending().catch(() => {}));
      return r.rows[0]?.id || null;
    } catch (err) {
      console.error("[AUTOMATION] enqueue:", err.message);
      return null;
    }
  }

  async function resolvePlanForPayment(client, payment, meta) {
    if (meta.plan_id && UUID_RE.test(String(meta.plan_id))) {
      const r = await client.query("SELECT * FROM plans WHERE id = $1 LIMIT 1", [meta.plan_id]);
      if (r.rows[0]) return r.rows[0];
    }
    const product = String(meta.cademi_produto || meta.plan_name || "").trim();
    if (!product) return null;
    const r = await client.query(
      `SELECT * FROM plans
        WHERE lower(btrim(name)) = lower(btrim($1))
           OR lower(btrim(COALESCE(description,''))) = lower(btrim($1))
        ORDER BY active DESC, created_at DESC LIMIT 1`,
      [product]
    );
    return r.rows[0] || null;
  }

  async function applyPaymentConfirmed(code) {
    const client = await pool.connect();
    const queued = [];
    let primaryEvent = null;
    try {
      await client.query("BEGIN");
      const pr = await client.query(
        `SELECT p.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
                c.whatsapp_phone, s.plan_id, s.end_date, s.start_date, pl.name AS plan_name, pl.periodicity
           FROM payments p
           LEFT JOIN customers c ON c.id = p.customer_id
           LEFT JOIN subscriptions s ON s.id = p.subscription_id
           LEFT JOIN plans pl ON pl.id = s.plan_id
          WHERE p.code = $1
          FOR UPDATE OF p`,
        [code]
      );
      const p = pr.rows[0];
      if (!p) {
        await client.query("ROLLBACK");
        return null;
      }
      let meta = asObject(p.metadata) || {};
      if (String(p.status) !== "confirmado" || meta.lifecycle_processed_at) {
        await client.query("ROLLBACK");
        return null;
      }

      let subscription = null;
      let plan = null;
      let subscriptionCreated = false;
      let reconciliation = null;

      if (p.subscription_id) {
        const sr = await client.query(
          `SELECT s.*, pl.name AS plan_name, pl.periodicity
             FROM subscriptions s LEFT JOIN plans pl ON pl.id = s.plan_id
            WHERE s.id = $1 FOR UPDATE OF s`,
          [p.subscription_id]
        );
        subscription = sr.rows[0] || null;
        if (subscription) {
          plan = { id: subscription.plan_id, name: subscription.plan_name, periodicity: subscription.periodicity };
        } else {
          reconciliation = "subscricao_nao_encontrada";
        }
      } else {
        plan = await resolvePlanForPayment(client, p, meta);
        if (plan && p.customer_id) {
          const existing = await client.query(
            `SELECT * FROM subscriptions
              WHERE customer_id = $1 AND plan_id = $2
              ORDER BY active DESC, end_date DESC NULLS LAST, created_at DESC
              LIMIT 1 FOR UPDATE`,
            [p.customer_id, plan.id]
          );
          subscription = existing.rows[0] || null;
          if (subscription) {
            await client.query("UPDATE payments SET subscription_id = $2, updated_at = NOW() WHERE id = $1", [p.id, subscription.id]);
          } else {
            const start = new Date();
            const end = addMonths(start, periodMonths(plan.periodicity));
            const ins = await client.query(
              `INSERT INTO subscriptions (customer_id, plan_id, start_date, end_date, active)
               VALUES ($1, $2, $3, $4, TRUE) RETURNING *`,
              [p.customer_id, plan.id, start, end]
            );
            subscription = ins.rows[0];
            subscriptionCreated = true;
            await client.query("UPDATE payments SET subscription_id = $2, updated_at = NOW() WHERE id = $1", [p.id, subscription.id]);
          }
        } else if (!p.customer_id) {
          reconciliation = "pagamento_sem_cliente";
        } else {
          reconciliation = "plano_nao_identificado";
        }
      }

      if (subscription) {
        const now = new Date();
        const base = !subscriptionCreated && subscription.end_date && new Date(subscription.end_date) > now
          ? new Date(subscription.end_date)
          : now;
        const end = addMonths(base, periodMonths(plan?.periodicity || subscription.periodicity));
        const upd = await client.query(
          `UPDATE subscriptions SET active = TRUE, end_date = $2, updated_at = NOW()
            WHERE id = $1 RETURNING *`,
          [subscription.id, end]
        );
        subscription = upd.rows[0] || subscription;
        if (p.customer_id) {
          await client.query("UPDATE customers SET state = 'activo', updated_at = NOW() WHERE id = $1", [p.customer_id]);
        }
      }

      if (reconciliation) meta.reconciliation_required = reconciliation;
      else delete meta.reconciliation_required;
      meta.lifecycle_processed_at = new Date().toISOString();
      await client.query("UPDATE payments SET metadata = $2::jsonb, updated_at = NOW() WHERE code = $1", [code, JSON.stringify(meta)]);

      const basePayload = {
        paymentId: p.id,
        code: p.code,
        customerId: p.customer_id,
        customerName: p.customer_name,
        customerEmail: p.customer_email,
        phone: p.customer_phone,
        whatsapp: p.whatsapp_phone,
        amount: p.amount,
        method: p.method,
        subscriptionId: subscription?.id || p.subscription_id || null,
        planId: plan?.id || subscription?.plan_id || null,
        planName: plan?.name || p.plan_name || null,
        product: meta.cademi_produto || null,
        dueDate: p.expires_at || null,
        reconciled: Boolean(reconciliation),
        reconciliationRequired: reconciliation,
      };

      primaryEvent = await enqueue("payment_confirmed", basePayload, {
        dedupeKey: `payment_confirmed:${p.code}`,
        client,
      });
      if (primaryEvent) queued.push(primaryEvent);
      if (subscription) {
        const eventType = subscriptionCreated ? "subscription_activated" : "subscription_renewed";
        const eventId = await enqueue(eventType, {
          ...basePayload,
          endDate: subscription.end_date,
          startDate: subscription.start_date,
        }, {
          dedupeKey: `${eventType}:${subscription.id}:${p.code}`,
          client,
        });
        if (eventId) queued.push(eventId);
      }
      if (meta.cademi_produto && p.customer_id) {
        const accessEvent = await enqueue("course_access_granted", basePayload, {
          dedupeKey: `course_access_granted:${p.code}`,
          client,
        });
        if (accessEvent) queued.push(accessEvent);
      }

      await client.query("COMMIT");
      if (queued.length) setImmediate(() => processPending().catch(() => {}));
      return primaryEvent;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("[AUTOMATION] payment_confirmed:", err.message);
      return null;
    } finally {
      client.release();
    }
  }

  async function settingValue(key, fallback = "") {
    if (!getSetting) return fallback;
    try {
      const value = await getSetting(key);
      return value == null ? fallback : String(value);
    } catch {
      return fallback;
    }
  }

  async function settingEnabled(key, fallback = false) {
    const raw = String(await settingValue(key, fallback ? "true" : "false")).toLowerCase();
    return raw === "true" || raw === "1" || raw === "sim";
  }

  async function settingNumber(key, fallback) {
    const n = Number.parseInt(await settingValue(key, String(fallback)), 10);
    return Number.isFinite(n) ? n : fallback;
  }

  async function consentAllows(payload) {
    if (!payload?.customerId) return { ok: true };
    try {
      const r = await pool.query("SELECT whatsapp_opt_in FROM customers WHERE id = $1", [payload.customerId]);
      if (r.rows[0] && r.rows[0].whatsapp_opt_in === false) return { ok: false, reason: "opt_out" };
    } catch {}
    return { ok: true };
  }

  async function executeAction(action, event) {
    const type = String(action?.type || "").trim();
    const params = action?.params || {};
    const payload = event.payload || {};
    const ctx = {
      ...payload,
      name: payload.customerName || payload.name || payload.leadName || "",
      amountLabel: payload.amount != null ? `${payload.amount} Kz` : "",
      event: event.event_type,
    };
    if (isDryRun) {
      return { ok: true, dryRun: true, skipped: "modo de simulação ativo" };
    }
    if (type === "send_notification") {
      const title = String(render(params.title || EVENT_TITLES[event.event_type] || "Automação", ctx)).slice(0, 200);
      const body = String(render(params.message || defaultMessage(event.event_type, ctx), ctx)).slice(0, 2000);
      const recipients = await pool.query(
        `SELECT id FROM users WHERE COALESCE(active, TRUE) = TRUE AND role IN ('administrador','gestor')`
      );
      let sent = 0;
      for (const row of recipients.rows) {
        await pool.query(
          `INSERT INTO notifications (user_id, type, title, body, lead_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [row.id, `automation_${event.event_type}`.slice(0, 50), title, body, payload.leadId || null]
        ).catch(() => {});
        sent += 1;
      }
      return { ok: true, sent };
    }
    if (type === "send_whatsapp" || type === "send_whatsapp_template") {
      const allowed = await consentAllows(payload);
      if (!allowed.ok) return { ok: true, skipped: `sem consentimento (${allowed.reason})` };
      const to = params.to || payload.whatsapp || payload.phone || payload.customerPhone;
      if (!to) return { ok: true, skipped: "sem telefone" };
      const idempotencyKey = `automation:${event.id}:${event.automation?.id || "auto"}:${event.actionIndex ?? 0}`;
      if (type === "send_whatsapp_template") {
        const templateName = params.template || params.name || params.templateName;
        if (!templateName) return { ok: false, error: "template em falta" };
        const components = Array.isArray(params.components)
          ? params.components
          : (Array.isArray(payload.templateParams)
            ? [{ type: "body", parameters: payload.templateParams.map((v) => ({ type: "text", text: String(v) })) }]
            : undefined);
        return whatsapp.sendTemplate(to, templateName, params.language || payload.language || "pt_PT", components, {
          customerId: payload.customerId || null,
          leadId: payload.leadId || null,
          paymentCode: payload.code || payload.paymentCode || null,
          idempotencyKey,
          sourceEvent: event.event_type,
          automationEventId: event.id,
          metadata: { automationId: event.automation?.id || null },
        });
      }
      const body = String(render(params.message || defaultMessage(event.event_type, ctx), ctx)).slice(0, 4000);
      return whatsapp.sendText(to, body, {
        customerId: payload.customerId || null,
        leadId: payload.leadId || null,
        paymentCode: payload.code || payload.paymentCode || null,
        idempotencyKey,
        sourceEvent: event.event_type,
        automationEventId: event.id,
        metadata: { automationId: event.automation?.id || null },
      });
    }
    if (type === "update_customer_state") {
      const customerId = payload.customerId;
      if (!customerId) return { ok: true, skipped: "sem cliente" };
      const allowed = new Set(["activo", "inactivo", "em_atraso", "suspenso"]);
      const fallback = event.event_type === "payment_overdue" || event.event_type === "subscription_expired"
        ? "em_atraso"
        : ["access_denied", "client_blocked", "client_inactive"].includes(event.event_type)
          ? "suspenso"
          : "activo";
      const state = String(params.state || fallback);
      if (!allowed.has(state)) return { ok: true, skipped: "estado inválido" };
      const r = await pool.query(
        "UPDATE customers SET state = $2, updated_at = NOW() WHERE id = $1 RETURNING id",
        [customerId, state]
      );
      return { ok: true, updated: r.rowCount };
    }
    if (type === "create_task") {
      const recipients = await pool.query(
        `SELECT id FROM users WHERE COALESCE(active, TRUE) = TRUE AND role IN ('administrador','gestor')`
      );
      const title = String(render(params.title || `Tarefa: ${EVENT_TITLES[event.event_type] || event.event_type}`, ctx)).slice(0, 200);
      const body = String(render(params.message || defaultMessage(event.event_type, ctx), ctx)).slice(0, 2000);
      for (const row of recipients.rows) {
        await pool.query(
          `INSERT INTO notifications (user_id, type, title, body, lead_id)
           VALUES ($1, 'automation_task', $2, $3, $4)`,
          [row.id, title, body, payload.leadId || null]
        ).catch(() => {});
      }
      return { ok: true, sent: recipients.rows.length };
    }
    if (type === "sync_to_cademi") {
      if (!onSyncCademi || !(payload.code || payload.paymentCode)) return { ok: true, skipped: "sem pagamento" };
      const result = await onSyncCademi(payload.code || payload.paymentCode);
      const failed = result && result.ok === false && !String(result.skipped || "").startsWith("já enviado");
      return { ok: !failed, ...(result || {}) };
    }
    return { ok: true, skipped: `ação desconhecida: ${type}` };
  }

  async function processEvent(event) {
    const automations = await pool.query("SELECT * FROM automations WHERE active = TRUE ORDER BY created_at ASC");
    const matching = automations.rows.filter((a) => canonicalTrigger(a.trigger) === event.event_type);
    const previous = asObject(event.result) || {};
    const actionState = asObject(previous.actions) || {};
    const results = [];
    const failures = [];
    for (const automation of matching) {
      const actions = toActionList(automation.action);
      for (let index = 0; index < actions.length; index += 1) {
        const action = actions[index];
        const key = `${automation.id}:${index}`;
        if (actionState[key]?.ok) {
          results.push(actionState[key]);
          continue;
        }
        let result;
        try {
          result = await executeAction(action, { ...event, automation, actionIndex: index });
        } catch (err) {
          result = { ok: false, error: err.message };
          console.error(`[AUTOMATION] ${automation.id} ${action.type}:`, err.message);
        }
        const record = {
          automationId: automation.id,
          automationName: automation.name,
          action: action.type,
          actionIndex: index,
          ok: !actionFailed(result),
          ...result,
        };
        actionState[key] = record;
        results.push(record);
        await pool.query(
          "UPDATE automation_events SET result = $2::jsonb, updated_at = NOW() WHERE id = $1",
          [event.id, JSON.stringify({ actions: actionState })]
        ).catch(() => {});
        if (!record.ok) failures.push(`${automation.name || automation.id}/${action.type}: ${record.error || "falha"}`);
      }
      await pool.query(
        "UPDATE automations SET run_count = COALESCE(run_count, 0) + 1, last_run_at = NOW(), updated_at = NOW() WHERE id = $1",
        [automation.id]
      ).catch(() => {});
    }
    await pool.query(
      `INSERT INTO audit_logs (actor, action, entity, details)
       VALUES ('automation', 'automation.event_processed', 'automation_events', $1::jsonb)`,
      [JSON.stringify({ eventId: event.id, eventType: event.event_type, automations: matching.length, results })]
    ).catch(() => {});
    if (failures.length) throw new Error(failures.join("; ").slice(0, 500));
    return { matched: matching.length, results };
  }

  async function processPending(limit = 20) {
    if (processing) return { busy: true };
    processing = true;
    try {
      await pool.query(
        `UPDATE automation_events
            SET status = 'pending', available_at = NOW(), updated_at = NOW(),
                last_error = COALESCE(last_error, 'recuperado após reinício')
          WHERE status = 'processing' AND updated_at < NOW() - INTERVAL '10 minutes'`
      ).catch(() => {});
      await pool.query(
        `UPDATE automation_events
            SET status = 'failed', updated_at = NOW(),
                last_error = COALESCE(last_error, 'limite de tentativas atingido')
          WHERE status = 'pending' AND attempts >= $1`,
        [MAX_ATTEMPTS]
      ).catch(() => {});
      const claimed = await pool.query(
        `UPDATE automation_events SET status = 'processing', attempts = attempts + 1, updated_at = NOW()
          WHERE id IN (
            SELECT id FROM automation_events
             WHERE status = 'pending' AND available_at <= NOW() AND attempts < $2
             ORDER BY created_at ASC LIMIT $1 FOR UPDATE SKIP LOCKED
          )
          RETURNING *`,
        [limit, MAX_ATTEMPTS]
      );
      for (const event of claimed.rows) {
        try {
          const result = await processEvent(event);
          await pool.query(
            "UPDATE automation_events SET status = 'processed', processed_at = NOW(), last_error = NULL, updated_at = NOW() WHERE id = $1",
            [event.id]
          );
          if (result.matched === 0) {
            await pool.query("UPDATE automation_events SET last_error = 'Sem automação ativa para este evento' WHERE id = $1", [event.id]).catch(() => {});
          }
        } catch (err) {
          const retry = event.attempts < MAX_ATTEMPTS;
          const delay = retry ? Math.min(300, 2 ** event.attempts * 5) : null;
          await pool.query(
            `UPDATE automation_events
                SET status = $2, last_error = $3, updated_at = NOW(),
                    available_at = CASE WHEN $4::int IS NULL THEN available_at ELSE NOW() + ($4::int * INTERVAL '1 second') END
              WHERE id = $1`,
            [event.id, retry ? "pending" : "failed", String(err.message || err).slice(0, 500), delay]
          ).catch(() => {});
        }
      }
      return { processed: claimed.rowCount };
    } finally {
      processing = false;
    }
  }

  async function reconcilePayments(limit = 20) {
    const confirmed = await pool.query(
      `SELECT code FROM payments
        WHERE status = 'confirmado'
          AND created_at > NOW() - INTERVAL '60 days'
          AND COALESCE(metadata->>'lifecycle_processed_at', '') = ''
        ORDER BY created_at ASC LIMIT $1`,
      [limit]
    );
    let processed = 0;
    for (const row of confirmed.rows) {
      const event = await applyPaymentConfirmed(row.code);
      if (event) processed += 1;
    }
    return { processed };
  }

  async function runScheduledHygiene() {
    const day = new Date().toISOString().slice(0, 10);
    const month = day.slice(0, 7);
    const year = new Date().getUTCFullYear();
    const week = `${year}-W${String(Math.ceil((((Date.now() - Date.UTC(year, 0, 1)) / 86400000) + 1) / 7)).padStart(2, "0")}`;

    await reconcilePayments(20).catch((err) => console.error("[AUTOMATION] reconciliação:", err.message));

    try {
      const overdue = await pool.query(
        `SELECT s.id, s.customer_id, s.end_date, s.plan_id, c.name, c.phone, c.whatsapp_phone, p.name AS plan_name
           FROM subscriptions s
           JOIN customers c ON c.id = s.customer_id
           LEFT JOIN plans p ON p.id = s.plan_id
          WHERE s.active = TRUE AND s.end_date IS NOT NULL AND s.end_date < NOW()
            AND COALESCE(c.whatsapp_opt_in, TRUE) = TRUE
            AND NOT EXISTS (
              SELECT 1 FROM payments pay
               WHERE pay.customer_id = s.customer_id AND pay.status = 'confirmado'
                 AND pay.paid_at > s.end_date
            )
          ORDER BY s.end_date ASC LIMIT 500`
      );
      for (const row of overdue.rows) {
        const payload = {
          customerId: row.customer_id,
          customerName: row.name,
          phone: row.phone,
          whatsapp: row.whatsapp_phone,
          subscriptionId: row.id,
          planId: row.plan_id,
          planName: row.plan_name,
          dueDate: row.end_date,
        };
        await enqueue("payment_overdue", payload, { dedupeKey: `payment_overdue:${row.id}:${day}` });
        await enqueue("subscription_expired", payload, { dedupeKey: `subscription_expired:${row.id}:${day}` });
      }
    } catch (err) {
      console.error("[AUTOMATION] overdue:", err.message);
    }

    if (await settingEnabled("automation_subscription_expiring")) {
      try {
        const days = await settingNumber("automation_subscription_expiring_days", 7);
        const expiring = await pool.query(
          `SELECT s.id, s.customer_id, s.end_date, s.plan_id, c.name, c.phone, c.whatsapp_phone, p.name AS plan_name
             FROM subscriptions s
             JOIN customers c ON c.id = s.customer_id
             LEFT JOIN plans p ON p.id = s.plan_id
            WHERE s.active = TRUE AND s.end_date > NOW()
              AND s.end_date <= NOW() + ($1::int * INTERVAL '1 day')
              AND COALESCE(c.whatsapp_opt_in, TRUE) = TRUE
            ORDER BY s.end_date ASC LIMIT 500`,
          [days]
        );
        for (const row of expiring.rows) {
          await enqueue("subscription_expiring", {
            customerId: row.customer_id,
            customerName: row.name,
            phone: row.phone,
            whatsapp: row.whatsapp_phone,
            subscriptionId: row.id,
            planId: row.plan_id,
            planName: row.plan_name,
            dueDate: row.end_date,
            daysLeft: Math.max(1, Math.ceil((new Date(row.end_date).getTime() - Date.now()) / 86400000)),
          }, { dedupeKey: `subscription_expiring:${row.id}:${day}` });
        }
      } catch (err) {
        console.error("[AUTOMATION] expiração:", err.message);
      }
    }

    try {
      const exhausted = await pool.query(
        `SELECT s.id, s.customer_id, s.lessons_total, s.lessons_done, c.name, c.phone, c.whatsapp_phone, p.name AS plan_name
           FROM subscriptions s
           JOIN customers c ON c.id = s.customer_id
           LEFT JOIN plans p ON p.id = s.plan_id
          WHERE s.active = TRUE AND s.lessons_total IS NOT NULL AND s.lessons_total > 0
            AND COALESCE(s.lessons_done, 0) >= s.lessons_total
            AND COALESCE(c.whatsapp_opt_in, TRUE) = TRUE
          LIMIT 500`
      );
      for (const row of exhausted.rows) {
        await enqueue("lessons_exhausted", {
          customerId: row.customer_id,
          customerName: row.name,
          phone: row.phone,
          whatsapp: row.whatsapp_phone,
          subscriptionId: row.id,
          planName: row.plan_name,
          lessonsTotal: row.lessons_total,
          lessonsDone: row.lessons_done,
        }, { dedupeKey: `lessons_exhausted:${row.id}:${day}` });
      }
    } catch (err) {
      console.error("[AUTOMATION] lessons:", err.message);
    }

    if (await settingEnabled("automation_birthday")) {
      try {
        const birthdays = await pool.query(
          `SELECT id, name, phone, whatsapp_phone FROM customers
            WHERE birth_date IS NOT NULL
              AND EXTRACT(MONTH FROM birth_date) = EXTRACT(MONTH FROM CURRENT_DATE)
              AND EXTRACT(DAY FROM birth_date) = EXTRACT(DAY FROM CURRENT_DATE)
              AND state <> 'suspenso'
              AND COALESCE(whatsapp_opt_in, TRUE) = TRUE
            LIMIT 500`
        );
        for (const row of birthdays.rows) {
          await enqueue("customer_birthday", {
            customerId: row.id,
            customerName: row.name,
            phone: row.phone,
            whatsapp: row.whatsapp_phone,
          }, { dedupeKey: `customer_birthday:${row.id}:${year}` });
        }
      } catch (err) {
        console.error("[AUTOMATION] aniversários:", err.message);
      }
    }

    if (await settingEnabled("automation_customer_inactive")) {
      try {
        const days = await settingNumber("automation_customer_inactive_days", 45);
        const inactive = await pool.query(
          `SELECT c.id, c.name, c.phone, c.whatsapp_phone
             FROM customers c
            WHERE c.state NOT IN ('suspenso')
              AND COALESCE(c.whatsapp_opt_in, TRUE) = TRUE
              AND NOT EXISTS (
                SELECT 1 FROM subscriptions s
                 WHERE s.customer_id = c.id AND s.active = TRUE AND s.end_date > NOW()
              )
              AND COALESCE(
                (SELECT MAX(p.paid_at) FROM payments p WHERE p.customer_id = c.id AND p.status = 'confirmado'),
                c.created_at
              ) < NOW() - ($1::int * INTERVAL '1 day')
            ORDER BY c.created_at ASC LIMIT 500`,
          [days]
        );
        for (const row of inactive.rows) {
          await enqueue("client_inactive", {
            customerId: row.id,
            customerName: row.name,
            phone: row.phone,
            whatsapp: row.whatsapp_phone,
          }, { dedupeKey: `client_inactive:${row.id}:${month}` });
        }
      } catch (err) {
        console.error("[AUTOMATION] inativos:", err.message);
      }
    }

    if (await settingEnabled("automation_nps")) {
      try {
        const days = await settingNumber("automation_nps_days", 3);
        const nps = await pool.query(
          `SELECT s.id, s.customer_id, s.end_date, c.name, c.phone, c.whatsapp_phone, p.name AS plan_name
             FROM subscriptions s
             JOIN customers c ON c.id = s.customer_id
             LEFT JOIN plans p ON p.id = s.plan_id
            WHERE s.end_date IS NOT NULL
              AND s.end_date < NOW() - ($1::int * INTERVAL '1 day')
              AND s.end_date > NOW() - (($1::int + 7) * INTERVAL '1 day')
              AND COALESCE(c.whatsapp_opt_in, TRUE) = TRUE
            LIMIT 500`,
          [days]
        );
        for (const row of nps.rows) {
          await enqueue("nps_requested", {
            customerId: row.customer_id,
            customerName: row.name,
            phone: row.phone,
            whatsapp: row.whatsapp_phone,
            subscriptionId: row.id,
            planName: row.plan_name,
            dueDate: row.end_date,
          }, { dedupeKey: `nps_requested:${row.id}` });
        }
      } catch (err) {
        console.error("[AUTOMATION] nps:", err.message);
      }
    }

    try {
      const stale = await pool.query(
        `SELECT l.id, l.name, l.email, l.phone, l.whatsapp, l.source, l.status
           FROM leads l
          WHERE l.status NOT IN ('convertido','perdido')
            AND COALESCE((SELECT MAX(c.created_at) FROM lead_contacts c WHERE c.lead_id = l.id), l.updated_at, l.created_at) < NOW() - INTERVAL '7 days'
          ORDER BY l.updated_at ASC LIMIT 500`
      );
      for (const row of stale.rows) {
        await enqueue("lead_no_activity", {
          leadId: row.id,
          leadName: row.name,
          customerName: row.name,
          email: row.email,
          phone: row.phone,
          whatsapp: row.whatsapp,
          source: row.source,
          status: row.status,
        }, { dedupeKey: `lead_no_activity:${row.id}:${week}` });
      }
    } catch (err) {
      console.error("[AUTOMATION] leads:", err.message);
    }
  }

  return {
    applyPaymentConfirmed,
    canonicalTrigger,
    enqueue,
    ensureSchema,
    executeAction,
    isDryRun,
    processEvent,
    processPending,
    reconcilePayments,
    runScheduledHygiene,
    toActionList,
  };
}

import { db } from "@workspace/db";
import {
  automationsTable,
  auditLogsTable,
  customersTable,
  leadsTable,
  paymentsTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { logger } from "./logger";
import { triggerWebhooks } from "./webhook-delivery";
import { whatsappClient } from "./whatsapp";

export type AutomationEventType =
  | "payment_confirmed"
  | "payment_overdue"
  | "lead_created"
  | "lead_no_activity";

interface AutomationContext {
  eventType: AutomationEventType;
  data: Record<string, unknown>;
  userId?: string;
}

interface AutomationAction {
  type: "update_customer_state" | "create_task" | "send_notification" | "sync_to_cademi" | "send_whatsapp";
  params: Record<string, unknown>;
}

export async function processEvent(
  eventType: AutomationEventType,
  data: Record<string, unknown>,
  userId?: string,
): Promise<void> {
  logger.info({ eventType, data }, "Processing automation event");

  const activeAutomations = await db.query.automationsTable.findMany({
    where: and(
      eq(automationsTable.trigger, eventType),
      eq(automationsTable.active, true),
    ),
  });

  if (activeAutomations.length === 0) {
    logger.debug({ eventType }, "No active automations for event");
    return;
  }

  for (const automation of activeAutomations) {
    try {
      const actions = parseActions(automation.action);

      for (const action of actions) {
        await executeAction(action, { eventType, data, userId });
      }

      await db
        .update(automationsTable)
        .set({
          runCount: automation.runCount + 1,
          lastRunAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(automationsTable.id, automation.id));

      await db.insert(auditLogsTable).values({
        actor: "automation",
        actorId: automation.id,
        action: `automation_executed:${eventType}`,
        entity: "automation",
        entityId: automation.id,
        details: { eventType, actions: actions.map((a) => a.type), data },
      });

      logger.info(
        { automationId: automation.id, eventType, actionCount: actions.length },
        "Automation executed successfully",
      );
    } catch (err) {
      logger.error(
        { err, automationId: automation.id, eventType },
        "Automation execution failed",
      );

      await db.insert(auditLogsTable).values({
        actor: "automation",
        actorId: automation.id,
        action: `automation_failed:${eventType}`,
        entity: "automation",
        entityId: automation.id,
        details: { eventType, error: (err as Error).message, data },
      });
    }
  }

  await triggerWebhooks(eventType, data).catch((err) => {
    logger.error({ err, eventType }, "Failed to trigger webhooks for event");
  });
}

function parseActions(actionJson: string): AutomationAction[] {
  try {
    const parsed = JSON.parse(actionJson);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [parsed];
  } catch {
    logger.warn({ actionJson }, "Failed to parse automation action, treating as notification");
    return [{ type: "send_notification", params: { message: actionJson } }];
  }
}

async function executeAction(
  action: AutomationAction,
  context: AutomationContext,
): Promise<void> {
  switch (action.type) {
    case "update_customer_state":
      await handleUpdateCustomerState(action.params, context);
      break;
    case "create_task":
      await handleCreateTask(action.params, context);
      break;
    case "send_notification":
      await handleSendNotification(action.params, context);
      break;
    case "sync_to_cademi":
      await handleSyncToCademi(action.params, context);
      break;
    case "send_whatsapp":
      await handleSendWhatsApp(action.params, context);
      break;
    default:
      logger.warn({ actionType: action.type }, "Unknown automation action type");
  }
}

async function handleUpdateCustomerState(
  params: Record<string, unknown>,
  context: AutomationContext,
): Promise<void> {
  const customerId = (params.customerId as string) || (context.data.customerId as string);
  const newState = params.state as string;

  if (!customerId || !newState) {
    logger.warn("Missing customerId or state for update_customer_state action");
    return;
  }

  await db
    .update(customersTable)
    .set({ state: newState as "activo" | "inactivo" | "em_atraso" | "suspenso", updatedAt: new Date() })
    .where(eq(customersTable.id, customerId));

  logger.info({ customerId, newState }, "Customer state updated");
}

async function handleCreateTask(
  params: Record<string, unknown>,
  context: AutomationContext,
): Promise<void> {
  const title = params.title as string;
  const description = (params.description as string) || `Auto-generated from ${context.eventType}`;
  const assigneeId = (params.assigneeId as string) || context.userId;

  logger.info({ title, assigneeId }, "Task created by automation");

  await db.insert(auditLogsTable).values({
    actor: "automation",
    action: "task_created",
    entity: "customer",
    entityId: (context.data.customerId as string) || null,
    details: { title, description, assigneeId, source: context.eventType },
  });
}

function renderTemplate(text: string, ctx: Record<string, unknown>): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, key: string) => {
    const val = key.split(".").reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as any)[k] : undefined), ctx);
    return val == null ? "" : String(val);
  });
}

async function resolveCustomerPhone(context: AutomationContext): Promise<string | null> {
  const direct = (context.data.customerPhone as string) || (context.data.phone as string) || (context.data.to as string);
  if (direct && String(direct).trim()) return String(direct).trim();

  const customerId = context.data.customerId as string | undefined;
  if (!customerId) return null;
  const customer = await db.query.customersTable.findFirst({
    where: eq(customersTable.id, customerId),
  });
  return customer?.phone || null;
}

async function handleSendWhatsApp(
  params: Record<string, unknown>,
  context: AutomationContext,
): Promise<void> {
  const mode = ((params.mode as string) || "text") as "text" | "template";
  const to = (params.to as string) || (await resolveCustomerPhone(context));
  if (!to) {
    logger.warn({ context: context.data }, "send_whatsapp skipped: no destination phone");
    return;
  }
  if (!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)) {
    logger.warn("send_whatsapp skipped: WhatsApp not configured");
    return;
  }

  const ctx = { ...context.data, eventType: context.eventType };

  if (mode === "template") {
    const templateName = params.template_name as string;
    if (!templateName) {
      logger.warn("send_whatsapp template skipped: missing template_name");
      return;
    }
    const languageCode = (params.language_code as string) || "pt_BR";
    const vars = Array.isArray(params.variables)
      ? (params.variables as string[]).map((v) => renderTemplate(String(v), ctx))
      : [];
    const resp = await whatsappClient.sendTemplate(to, templateName, vars, languageCode);
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      throw new Error(`WhatsApp template failed (${resp.status}): ${body.slice(0, 500)}`);
    }
    logger.info({ to, templateName }, "WhatsApp template sent by automation");
    return;
  }

  const textRaw = (params.message as string) || (params.text as string) || "";
  if (!textRaw.trim()) {
    logger.warn("send_whatsapp text skipped: empty message");
    return;
  }
  const text = renderTemplate(textRaw, ctx);
  const resp = await whatsappClient.sendText(to, text);
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`WhatsApp text failed (${resp.status}): ${body.slice(0, 500)}`);
  }
  logger.info({ to }, "WhatsApp text sent by automation");
}

async function handleSendNotification(
  params: Record<string, unknown>,
  context: AutomationContext,
): Promise<void> {
  const channel = (params.channel as string) || "internal";
  const message = renderTemplate((params.message as string) || `Evento: ${context.eventType}`, {
    ...context.data,
    eventType: context.eventType,
  });
  const recipients = params.recipients as string[] | undefined;

  logger.info({ channel, message, recipients }, "Notification logged by automation");

  await db.insert(auditLogsTable).values({
    actor: "automation",
    action: "notification_sent",
    details: { channel, message, recipients, eventType: context.eventType },
  });
}

async function handleSyncToCademi(
  params: Record<string, unknown>,
  context: AutomationContext,
): Promise<void> {
  const { cademi } = await import("./cademi");
  const customerId = (params.customerId as string) || (context.data.customerId as string);

  if (!customerId) {
    logger.warn("Missing customerId for sync_to_cademi action");
    return;
  }

  const customer = await db.query.customersTable.findFirst({
    where: eq(customersTable.id, customerId),
  });

  if (!customer) {
    logger.warn({ customerId }, "Customer not found for Cademi sync");
    return;
  }

  logger.info({ customerId, cademiId: customer.cademiId }, "Syncing customer to Cademi");
}

export async function testAutomation(
  automationId: string,
  testData?: Record<string, unknown>,
): Promise<{ success: boolean; message: string }> {
  const automation = await db.query.automationsTable.findFirst({
    where: eq(automationsTable.id, automationId),
  });

  if (!automation) {
    throw new Error("Automation not found");
  }

  const mockData = testData || {
    customerId: "test-customer-id",
    paymentId: "test-payment-id",
    amount: 10000,
    timestamp: new Date().toISOString(),
  };

  try {
    const actions = parseActions(automation.action);

    logger.info(
      { automationId, actionCount: actions.length, trigger: automation.trigger },
      "Testing automation",
    );

    return {
      success: true,
      message: `Automation "${automation.name}" test passed. ${actions.length} action(s) would execute.`,
    };
  } catch (err) {
    return {
      success: false,
      message: `Automation test failed: ${(err as Error).message}`,
    };
  }
}

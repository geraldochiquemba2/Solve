import crypto from "crypto";
import { db } from "@workspace/db";
import { webhooksTable, webhookDeliveriesTable } from "@workspace/db/schema";
import { eq, and, lte, desc } from "drizzle-orm";
import { logger } from "./logger";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

export async function deliverWebhook(
  webhookId: string,
  event: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const webhook = await db.query.webhooksTable.findFirst({
    where: eq(webhooksTable.id, webhookId),
  });

  if (!webhook) {
    throw new Error("Webhook not found");
  }

  const [delivery] = await db
    .insert(webhookDeliveriesTable)
    .values({
      webhookId,
      event,
      payload,
      status: "pendente",
      attempts: 0,
    })
    .returning();

  logger.info({ deliveryId: delivery.id, event, webhookId }, "Webhook delivery created");

  processSingleDelivery(delivery.id, webhook.url, event, payload, webhook.secret || undefined).catch((err) => {
    logger.error({ err, deliveryId: delivery.id }, "Initial webhook delivery failed");
  });

  return delivery.id;
}

async function processSingleDelivery(
  deliveryId: string,
  url: string,
  event: string,
  payload: Record<string, unknown>,
  secret?: string,
  attempt: number = 1,
): Promise<void> {
  try {
    const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Webhook-Event": event,
      "X-Delivery-Id": deliveryId,
    };

    if (secret) {
      const signature = crypto.createHmac("sha256", secret).update(body).digest("hex");
      headers["X-Signature"] = `sha256=${signature}`;
    }

    logger.info({ deliveryId, url, attempt }, "Delivering webhook");

    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(30000),
    });

    const responseCode = response.status;
    const success = responseCode >= 200 && responseCode < 300;

    await db
      .update(webhookDeliveriesTable)
      .set({
        status: success ? "entregue" : "falha",
        responseCode,
        attempts: attempt,
      })
      .where(eq(webhookDeliveriesTable.id, deliveryId));

    if (success) {
      logger.info({ deliveryId, responseCode }, "Webhook delivered successfully");
    } else {
      logger.warn({ deliveryId, responseCode, attempt }, "Webhook delivery failed");
      if (attempt < MAX_RETRIES) {
        await scheduleRetry(deliveryId, url, event, payload, secret, attempt + 1);
      }
    }
  } catch (err) {
    logger.error({ err, deliveryId, attempt }, "Webhook delivery error");

    await db
      .update(webhookDeliveriesTable)
      .set({
        status: "falha",
        attempts: attempt,
      })
      .where(eq(webhookDeliveriesTable.id, deliveryId));

    if (attempt < MAX_RETRIES) {
      await scheduleRetry(deliveryId, url, event, payload, secret, attempt + 1);
    }
  }
}

async function scheduleRetry(
  deliveryId: string,
  url: string,
  event: string,
  payload: Record<string, unknown>,
  secret: string | undefined,
  nextAttempt: number,
): Promise<void> {
  const delay = Math.min(BASE_DELAY_MS * Math.pow(2, nextAttempt - 1), 30000);
  const nextRetryAt = new Date(Date.now() + delay);

  await db
    .update(webhookDeliveriesTable)
    .set({
      status: "pendente",
      nextRetryAt,
      attempts: nextAttempt - 1,
    })
    .where(eq(webhookDeliveriesTable.id, deliveryId));

  logger.info({ deliveryId, nextAttempt, delayMs: delay }, "Retry scheduled");

  setTimeout(() => {
    processSingleDelivery(deliveryId, url, event, payload, secret, nextAttempt).catch((err) => {
      logger.error({ err, deliveryId }, "Retry delivery failed");
    });
  }, delay);
}

export async function retryDelivery(deliveryId: string): Promise<void> {
  const delivery = await db.query.webhookDeliveriesTable.findFirst({
    where: eq(webhookDeliveriesTable.id, deliveryId),
  });

  if (!delivery) {
    throw new Error("Delivery not found");
  }

  const webhook = await db.query.webhooksTable.findFirst({
    where: eq(webhooksTable.id, delivery.webhookId),
  });

  if (!webhook) {
    throw new Error("Webhook not found");
  }

  const payload = (delivery.payload as Record<string, unknown>) || {};

  await db
    .update(webhookDeliveriesTable)
    .set({ status: "pendente", attempts: 0 })
    .where(eq(webhookDeliveriesTable.id, deliveryId));

  processSingleDelivery(deliveryId, webhook.url, delivery.event, payload, webhook.secret || undefined, 1).catch((err) => {
    logger.error({ err, deliveryId }, "Retry delivery failed");
  });
}

export async function processQueue(): Promise<void> {
  const now = new Date();

  const pendingDeliveries = await db
    .select({
      deliveryId: webhookDeliveriesTable.id,
      webhookId: webhookDeliveriesTable.webhookId,
      event: webhookDeliveriesTable.event,
      payload: webhookDeliveriesTable.payload,
      attempts: webhookDeliveriesTable.attempts,
    })
    .from(webhookDeliveriesTable)
    .where(
      and(
        eq(webhookDeliveriesTable.status, "pendente"),
        lte(webhookDeliveriesTable.nextRetryAt, now),
      )
    )
    .orderBy(desc(webhookDeliveriesTable.createdAt))
    .limit(50);

  logger.info({ count: pendingDeliveries.length }, "Processing webhook queue");

  for (const item of pendingDeliveries) {
    const webhook = await db.query.webhooksTable.findFirst({
      where: eq(webhooksTable.id, item.webhookId),
    });

    if (!webhook || !webhook.active) {
      await db
        .update(webhookDeliveriesTable)
        .set({ status: "falha", responseCode: 0 })
        .where(eq(webhookDeliveriesTable.id, item.deliveryId));
      continue;
    }

    const payload = (item.payload as Record<string, unknown>) || {};

    processSingleDelivery(
      item.deliveryId,
      webhook.url,
      item.event,
      payload,
      webhook.secret || undefined,
      item.attempts + 1,
    ).catch((err) => {
      logger.error({ err, deliveryId: item.deliveryId }, "Queue processing delivery failed");
    });
  }
}

export async function triggerWebhooks(event: string, payload: Record<string, unknown>): Promise<void> {
  const activeWebhooks = await db.query.webhooksTable.findMany({
    where: and(eq(webhooksTable.event, event), eq(webhooksTable.active, true)),
  });

  logger.info({ event, count: activeWebhooks.length }, "Triggering webhooks");

  for (const webhook of activeWebhooks) {
    const [delivery] = await db
      .insert(webhookDeliveriesTable)
      .values({
        webhookId: webhook.id,
        event,
        payload,
        status: "pendente",
        attempts: 0,
      })
      .returning();

    await db
      .update(webhooksTable)
      .set({ lastTriggeredAt: new Date() })
      .where(eq(webhooksTable.id, webhook.id));

    processSingleDelivery(
      delivery.id,
      webhook.url,
      event,
      payload,
      webhook.secret || undefined,
    ).catch((err) => {
      logger.error({ err, deliveryId: delivery.id }, "Webhook trigger failed");
    });
  }
}

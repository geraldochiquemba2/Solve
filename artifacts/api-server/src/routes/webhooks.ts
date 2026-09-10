import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { webhooksTable, webhookDeliveriesTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { authenticate, authorize } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import { AppError } from "../middlewares/error";

const router = Router();

const webhookSchema = z.object({
  url: z.string().url(),
  event: z.string(),
  active: z.boolean().default(true),
  secret: z.string().optional(),
});

// List all webhooks
router.get("/webhooks", authenticate, async (req, res, next) => {
  try {
    const webhooks = await db.query.webhooksTable.findMany();

    res.json({ data: webhooks, total: webhooks.length });
  } catch (err) {
    next(err);
  }
});

// Create webhook
router.post("/webhooks", authenticate, authorize("administrador"), validate(webhookSchema), async (req, res, next) => {
  try {
    const [webhook] = await db.insert(webhooksTable).values(req.body).returning();

    res.status(201).json({ data: webhook });
  } catch (err) {
    next(err);
  }
});

// Delete webhook
router.delete("/webhooks/:id", authenticate, authorize("administrador"), async (req, res, next) => {
  try {
    const existing = await db.query.webhooksTable.findFirst({
      where: eq(webhooksTable.id, req.params.id as string),
    });

    if (!existing) {
      throw new AppError(404, "Webhook não encontrado");
    }

    await db.delete(webhooksTable).where(eq(webhooksTable.id, req.params.id as string));

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// List webhook deliveries
router.get("/webhooks/:id/deliveries", authenticate, async (req, res, next) => {
  try {
    const deliveries = await db.query.webhookDeliveriesTable.findMany({
      where: eq(webhookDeliveriesTable.webhookId, req.params.id as string),
      orderBy: [desc(webhookDeliveriesTable.createdAt)],
      limit: 50,
    });

    res.json({ data: deliveries, total: deliveries.length });
  } catch (err) {
    next(err);
  }
});

// Reprocess failed delivery
router.post("/webhooks/deliveries/:id/reprocess", authenticate, authorize("administrador"), async (req, res, next) => {
  try {
    const delivery = await db.query.webhookDeliveriesTable.findFirst({
      where: eq(webhookDeliveriesTable.id, req.params.id as string),
    });

    if (!delivery) {
      throw new AppError(404, "Entrega não encontrada");
    }

    // Get the parent webhook to find the destination URL
    const webhook = await db.query.webhooksTable.findFirst({
      where: eq(webhooksTable.id, delivery.webhookId),
    });

    if (!webhook) {
      throw new AppError(404, "Webhook pai não encontrado");
    }

    // Set to pending and increment attempts
    await db
      .update(webhookDeliveriesTable)
      .set({
        status: "pendente",
        attempts: delivery.attempts + 1,
        nextRetryAt: new Date(),
      })
      .where(eq(webhookDeliveriesTable.id, req.params.id as string));

    // Attempt to send the webhook
    let finalStatus: string = "entregue";
    let responseCode: number | null = null;

    try {
      const response = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Secret": webhook.secret || "",
          "X-Webhook-Event": delivery.event,
        },
        body: JSON.stringify(delivery.payload),
        signal: AbortSignal.timeout(10000),
      });

      responseCode = response.status;
      finalStatus = response.ok ? "entregue" : "falha";
    } catch (fetchErr) {
      finalStatus = "falha";
      responseCode = null;
    }

    const [updated] = await db
      .update(webhookDeliveriesTable)
      .set({
        status: finalStatus as any,
        responseCode,
      })
      .where(eq(webhookDeliveriesTable.id, req.params.id as string))
      .returning();

    res.json({
      data: updated,
      message: finalStatus === "entregue" ? "Webhook reenviado com sucesso" : "Falha no reenvio",
    });
  } catch (err) {
    next(err);
  }
});

export default router;

import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { customersTable, leadsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { authenticate, authorize } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import { AppError } from "../middlewares/error";
import { whatsappClient, WhatsAppMessage, WhatsAppWebhookEvent, WhatsAppMessageType, WhatsAppMessageStatusType } from "../lib/whatsapp";
import { auditLogsTable } from "@workspace/db/schema";
import { sql } from "drizzle-orm";

const router = Router();

function isConfigured(): boolean {
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

// Health check
router.get("/whatsapp/health", authenticate, (req, res) => {
  res.json({
    status: "ok",
    configured: isConfigured(),
    tokenConfigured: !!process.env.WHATSAPP_TOKEN,
    phoneNumberId: !!process.env.WHATSAPP_PHONE_NUMBER_ID,
    timestamp: new Date().toISOString(),
  });
});

// Webhook receiver for WhatsApp messages (public - receive from WhatsApp)
router.post("/whatsapp/webhook", async (req, res, next) => {
  try {
    const body = req.body;
    const event = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!event) {
      res.status(200).json({ status: "ignored" });
      return;
    }

    // Log do evento no audit
    await db.insert(auditLogsTable).values({
      actor: "WhatsApp System",
      action: "Webhook received",
      entity: "whatsapp",
      entityId: event?.id || "unknown",
      details: JSON.stringify(body),
    });

    res.status(200).json({ status: "ok" });
  } catch (err) {
    next(err);
  }
});

// Enviar mensagem para cliente (requer autenticação)
router.post(
  "/whatsapp/send-text",
  authenticate,
  authorize("administrador", "gestor", "comercial"),
  validate(
    z.object({
      to: z.string().regex(/^\+?[1-9][0-9]{8,14}$/, "Número de WhatsApp inválido"),
      text: z.string().min(1).max(2000),
    })
  ),
  async (req, res, next) => {
    try {
      if (!isConfigured()) {
        throw new AppError(503, "WhatsApp não configurado. Configure WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID no .env");
      }

      const { to, text } = req.body;
      const result = await whatsappClient.sendText(to, text);

      await db.insert(auditLogsTable).values({
        actor: req.user?.email || "admin",
        action: "WhatsApp message sent",
        entity: "whatsapp",
        entityId: `wa-${to}`,
        details: JSON.stringify({ textLength: text.length, to }),
      });

      res.json({ status: "sent", data: result });
    } catch (err) {
      next(err);
    }
  }
);

// Enviar template message (requer aprovação do Facebook)
router.post(
  "/whatsapp/send-template",
  authenticate,
  authorize("administrador", "gestor"),
  validate(
    z.object({
      to: z.string().regex(/^\+?[1-9][0-9]{8,14}$/, "Número de WhatsApp inválido"),
      template_name: z.string().min(1),
      language_code: z.string().default("pt_BR"),
      variables: z.array(z.string()).optional(),
    })
  ),
  async (req, res, next) => {
    try {
      if (!isConfigured()) {
        throw new AppError(503, "WhatsApp não configurado. Configure WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID no .env");
      }

      const { to, template_name, language_code, variables } = req.body;
      const result = await whatsappClient.sendTemplate(to, template_name, variables || [], language_code);

      await db.insert(auditLogsTable).values({
        actor: req.user?.email || "admin",
        action: "WhatsApp template message sent",
        entity: "whatsapp",
        entityId: `wa-${to}`,
        details: JSON.stringify({ template_name, has_variables: !!variables }),
      });

      res.json({ status: "sent", data: result });
    } catch (err) {
      next(err);
    }
  }
);

// Lista de mensagens recebidas (admin)
router.get(
  "/whatsapp/messages",
  authenticate,
  authorize("administrador", "gestor"),
  async (req, res, next) => {
    try {
      if (!isConfigured()) {
        res.json({ status: "ok", data: [], message: "WhatsApp não configurado" });
        return;
      }

      const limit = Number(req.query.limit) || 50;
      const status = req.query.status as string | undefined;
      const result = await whatsappClient.getMessages(status, undefined, limit);
      res.json({ status: "ok", data: result });
    } catch (err) {
      next(err);
    }
  }
);

// Status de uma mensagem específica
router.get(
  "/whatsapp/messages/:messageId",
  authenticate,
  authorize("administrador"),
  async (req, res, next) => {
    try {
      if (!isConfigured()) {
        throw new AppError(503, "WhatsApp não configurado");
      }

      const messageId = req.params.messageId;
      const result = await whatsappClient.getMessageStatus(messageId as string);
      res.json({ status: "ok", data: result });
    } catch (err) {
      next(err);
    }
  }
);

export default router;

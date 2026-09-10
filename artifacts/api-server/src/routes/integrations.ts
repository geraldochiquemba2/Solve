import { Router } from "express";
import { db } from "@workspace/db";
import { integrationsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { authenticate, authorize } from "../middlewares/auth";
import { AppError } from "../middlewares/error";

const router = Router();

// List all integrations
router.get("/integrations", authenticate, async (req, res, next) => {
  try {
    const integrations = await db.query.integrationsTable.findMany();

    res.json({ data: integrations, total: integrations.length });
  } catch (err) {
    next(err);
  }
});

// Get integration by name
router.get("/integrations/:name", authenticate, async (req, res, next) => {
  try {
    const integration = await db.query.integrationsTable.findFirst({
      where: eq(integrationsTable.name, req.params.name as string),
    });

    if (!integration) {
      throw new AppError(404, "Integração não encontrada");
    }

    res.json({ data: integration });
  } catch (err) {
    next(err);
  }
});

// Sync integration
router.post("/integrations/:name/sync", authenticate, authorize("administrador", "gestor", "operacional"), async (req, res, next) => {
  try {
    const integration = await db.query.integrationsTable.findFirst({
      where: eq(integrationsTable.name, req.params.name as string),
    });

    if (!integration) {
      throw new AppError(404, "Integração não encontrada");
    }

    const name = req.params.name as string;
    let syncResult = { synced: 0, errors: [] as string[] };

    // Perform actual sync based on integration name
    switch (name) {
      case "ovg": {
        // OVG sync is handled by dedicated /ovg/sync route
        const configured = !!(process.env.OVG_API_URL && process.env.OVG_USERNAME && process.env.OVG_PASSWORD);
        if (!configured) {
          syncResult.errors.push("OVG não configurado");
        } else {
          syncResult = { synced: 0, errors: ["Use /api/ovg/sync para sincronizar membros OVG"] };
        }
        break;
      }
      case "cademi": {
        const configured = !!(process.env.CADEMI_API_URL && process.env.CADEMI_API_KEY);
        if (!configured) {
          syncResult.errors.push("Cademi não configurado");
        } else {
          syncResult = { synced: 0, errors: ["Cademi sync em desenvolvimento"] };
        }
        break;
      }
      case "whatsapp": {
        const configured = !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
        if (!configured) {
          syncResult.errors.push("WhatsApp não configurado");
        } else {
          syncResult = { synced: 0, errors: ["WhatsApp sync não requerido - mensagens recebidas via webhook"] };
        }
        break;
      }
      case "pay4all":
      case "website": {
        // These are passive integrations (receive data, don't push)
        syncResult = { synced: 0, errors: [] };
        break;
      }
      default:
        syncResult.errors.push(`Sync não suportado para: ${name}`);
    }

    const hasErrors = syncResult.errors.length > 0;
    const [updated] = await db
      .update(integrationsTable)
      .set({
        lastSyncAt: new Date(),
        errorCount: syncResult.errors.length,
        status: hasErrors ? "atencao" : "operacional",
        updatedAt: new Date(),
      })
      .where(eq(integrationsTable.name, name))
      .returning();

    res.json({
      data: updated,
      sync: syncResult,
      message: hasErrors
        ? `Sincronização com erros: ${syncResult.errors.join("; ")}`
        : "Sincronização concluída com sucesso",
    });
  } catch (err) {
    next(err);
  }
});

// Update integration config
router.patch("/integrations/:name", authenticate, authorize("administrador"), async (req, res, next) => {
  try {
    const integration = await db.query.integrationsTable.findFirst({
      where: eq(integrationsTable.name, req.params.name as string),
    });

    if (!integration) {
      throw new AppError(404, "Integração não encontrada");
    }

    const [updated] = await db
      .update(integrationsTable)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(integrationsTable.name, req.params.name as string))
      .returning();

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

export default router;

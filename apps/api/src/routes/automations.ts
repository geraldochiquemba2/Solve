import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { automationsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { authenticate, authorize } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import { AppError } from "../middlewares/error";
import { processEvent, testAutomation, type AutomationEventType } from "../lib/automation-engine";

const router = Router();

const automationSchema = z.object({
  name: z.string().min(1).max(255),
  trigger: z.enum([
    "payment_confirmed",
    "payment_overdue",
    "lead_created",
    "lead_no_activity",
    "ovg_lead_qualified",
  ]),
  action: z.string(),
  active: z.boolean().default(true),
});

const automationUpdateSchema = automationSchema.partial();

router.get("/automations", authenticate, async (req, res, next) => {
  try {
    const automations = await db.query.automationsTable.findMany({
      orderBy: [desc(automationsTable.createdAt)],
    });

    res.json({ data: automations, total: automations.length });
  } catch (err) {
    next(err);
  }
});

router.get("/automations/:id", authenticate, async (req, res, next) => {
  try {
    const automation = await db.query.automationsTable.findFirst({
      where: eq(automationsTable.id, req.params.id as string),
    });

    if (!automation) {
      throw new AppError(404, "Automação não encontrada");
    }

    res.json({ data: automation });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/automations",
  authenticate,
  authorize("administrador", "gestor"),
  validate(automationSchema),
  async (req, res, next) => {
    try {
      const [automation] = await db
        .insert(automationsTable)
        .values(req.body)
        .returning();

      res.status(201).json({ data: automation });
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  "/automations/:id",
  authenticate,
  authorize("administrador", "gestor"),
  validate(automationUpdateSchema),
  async (req, res, next) => {
    try {
      const existing = await db.query.automationsTable.findFirst({
        where: eq(automationsTable.id, req.params.id as string),
      });

      if (!existing) {
        throw new AppError(404, "Automação não encontrada");
      }

      const [automation] = await db
        .update(automationsTable)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(automationsTable.id, req.params.id as string))
        .returning();

      res.json({ data: automation });
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  "/automations/:id/toggle",
  authenticate,
  authorize("administrador", "gestor"),
  async (req, res, next) => {
    try {
      const existing = await db.query.automationsTable.findFirst({
        where: eq(automationsTable.id, req.params.id as string),
      });

      if (!existing) {
        throw new AppError(404, "Automação não encontrada");
      }

      const [automation] = await db
        .update(automationsTable)
        .set({ active: !existing.active, updatedAt: new Date() })
        .where(eq(automationsTable.id, req.params.id as string))
        .returning();

      res.json({ data: automation });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  "/automations/:id",
  authenticate,
  authorize("administrador"),
  async (req, res, next) => {
    try {
      const existing = await db.query.automationsTable.findFirst({
        where: eq(automationsTable.id, req.params.id as string),
      });

      if (!existing) {
        throw new AppError(404, "Automação não encontrada");
      }

      await db.delete(automationsTable).where(eq(automationsTable.id, req.params.id as string));

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/automations/:id/test",
  authenticate,
  authorize("administrador", "gestor"),
  async (req, res, next) => {
    try {
      const result = await testAutomation(req.params.id as string, req.body);

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/automations/trigger",
  authenticate,
  authorize("administrador", "gestor"),
  async (req, res, next) => {
    try {
      const { eventType, data } = req.body as {
        eventType: AutomationEventType;
        data: Record<string, unknown>;
      };

      if (!eventType || !data) {
        throw new AppError(400, "eventType e data são obrigatórios");
      }

      await processEvent(eventType, data, req.user?.userId);

      res.json({ message: "Evento processado com sucesso" });
    } catch (err) {
      next(err);
    }
  },
);

export default router;

import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { plansTable, subscriptionsTable } from "@workspace/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { authenticate, authorize } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import { AppError } from "../middlewares/error";

const router = Router();

const planSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  price: z.number().int().min(0),
  periodicity: z.enum(["mensal", "trimestral", "semestral", "anual"]).default("mensal"),
  duration: z.number().int().optional(),
  active: z.boolean().default(true),
  ovgPlanId: z.string().optional(),
});

const planUpdateSchema = planSchema.partial();

// List all plans
router.get("/plans", authenticate, async (req, res, next) => {
  try {
    const plans = await db.query.plansTable.findMany({
      orderBy: [desc(plansTable.createdAt)],
    });

    const enriched = await Promise.all(plans.map(async (plan) => {
      const count = await db.$count(subscriptionsTable, eq(subscriptionsTable.planId, plan.id));
      return { ...plan, clientCount: count };
    }));

    res.json({ data: enriched, total: enriched.length });
  } catch (err) {
    next(err);
  }
});

// Get plan by ID
router.get("/plans/:id", authenticate, async (req, res, next) => {
  try {
    const plan = await db.query.plansTable.findFirst({
      where: eq(plansTable.id, req.params.id as string),
    });

    if (!plan) {
      throw new AppError(404, "Plano não encontrado");
    }

    res.json({ data: plan });
  } catch (err) {
    next(err);
  }
});

// Create plan
router.post("/plans", authenticate, authorize("administrador", "gestor"), validate(planSchema), async (req, res, next) => {
  try {
    const [plan] = await db.insert(plansTable).values(req.body).returning();

    res.status(201).json({ data: plan });
  } catch (err) {
    next(err);
  }
});

// Update plan
router.patch("/plans/:id", authenticate, authorize("administrador", "gestor"), validate(planUpdateSchema), async (req, res, next) => {
  try {
    const existing = await db.query.plansTable.findFirst({
      where: eq(plansTable.id, req.params.id as string),
    });

    if (!existing) {
      throw new AppError(404, "Plano não encontrado");
    }

    const [plan] = await db
      .update(plansTable)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(plansTable.id, req.params.id as string))
      .returning();

    res.json({ data: plan });
  } catch (err) {
    next(err);
  }
});

// Toggle plan active status
router.patch("/plans/:id/toggle", authenticate, authorize("administrador", "gestor"), async (req, res, next) => {
  try {
    const existing = await db.query.plansTable.findFirst({
      where: eq(plansTable.id, req.params.id as string),
    });

    if (!existing) {
      throw new AppError(404, "Plano não encontrado");
    }

    const [plan] = await db
      .update(plansTable)
      .set({ active: !existing.active, updatedAt: new Date() })
      .where(eq(plansTable.id, req.params.id as string))
      .returning();

    res.json({ data: plan });
  } catch (err) {
    next(err);
  }
});

// Delete plan
router.delete("/plans/:id", authenticate, authorize("administrador"), async (req, res, next) => {
  try {
    const existing = await db.query.plansTable.findFirst({
      where: eq(plansTable.id, req.params.id as string),
    });

    if (!existing) {
      throw new AppError(404, "Plano não encontrado");
    }

    await db.delete(plansTable).where(eq(plansTable.id, req.params.id as string));

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;

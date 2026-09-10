import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { paymentsTable, customersTable } from "@workspace/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { authenticate, authorize } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import { AppError } from "../middlewares/error";

const router = Router();

const paymentSchema = z.object({
  customerId: z.string().uuid(),
  subscriptionId: z.string().uuid().optional(),
  amount: z.number().int().min(0),
  method: z.string().optional(),
  referenceCode: z.string().optional(),
});

// List all payments
router.get("/payments", authenticate, async (req, res, next) => {
  try {
    const rows = await db
      .select({
        id: paymentsTable.id,
        code: paymentsTable.code,
        customerId: paymentsTable.customerId,
        subscriptionId: paymentsTable.subscriptionId,
        amount: paymentsTable.amount,
        method: paymentsTable.method,
        status: paymentsTable.status,
        referenceCode: paymentsTable.referenceCode,
        entity: paymentsTable.entity,
        ekwanzaCode: paymentsTable.ekwanzaCode,
        ekwanzaOperationCode: paymentsTable.ekwanzaOperationCode,
        paidAt: paymentsTable.paidAt,
        reconciledAt: paymentsTable.reconciledAt,
        createdAt: paymentsTable.createdAt,
        updatedAt: paymentsTable.updatedAt,
        customerName: sql<string | null>`COALESCE(${customersTable.name}, '')`,
        customerPhone: sql<string | null>`COALESCE(${customersTable.phone}, '')`,
        customerEmail: sql<string | null>`COALESCE(${customersTable.email}, '')`,
      })
      .from(paymentsTable)
      .leftJoin(customersTable, eq(paymentsTable.customerId, customersTable.id))
      .orderBy(desc(paymentsTable.createdAt));

    res.json({ data: rows, total: rows.length });
  } catch (err) {
    next(err);
  }
});

// Get payment by ID
router.get("/payments/:id", authenticate, async (req, res, next) => {
  try {
    const payment = await db.query.paymentsTable.findFirst({
      where: eq(paymentsTable.id, req.params.id as string),
    });

    if (!payment) {
      throw new AppError(404, "Pagamento não encontrado");
    }

    res.json({ data: payment });
  } catch (err) {
    next(err);
  }
});

// Create payment (manual entry)
router.post("/payments", authenticate, authorize("administrador", "gestor", "financeiro"), validate(paymentSchema), async (req, res, next) => {
  try {
    const count = await db.$count(paymentsTable);
    const code = `TRX-${String(81000 + count + 1).padStart(5, "0")}`;

    const [payment] = await db
      .insert(paymentsTable)
      .values({
        ...req.body,
        code,
      })
      .returning();

    res.status(201).json({ data: payment });
  } catch (err) {
    next(err);
  }
});

// Reconcile payment
router.patch("/payments/:id/reconcile", authenticate, authorize("administrador", "gestor", "financeiro"), async (req, res, next) => {
  try {
    const existing = await db.query.paymentsTable.findFirst({
      where: eq(paymentsTable.id, req.params.id as string),
    });

    if (!existing) {
      throw new AppError(404, "Pagamento não encontrado");
    }

    const [payment] = await db
      .update(paymentsTable)
      .set({
        status: "confirmado",
        reconciledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(paymentsTable.id, req.params.id as string))
      .returning();

    res.json({ data: payment });
  } catch (err) {
    next(err);
  }
});

// Delete payment
router.delete("/payments/:id", authenticate, authorize("administrador"), async (req, res, next) => {
  try {
    const existing = await db.query.paymentsTable.findFirst({
      where: eq(paymentsTable.id, req.params.id as string),
    });

    if (!existing) {
      throw new AppError(404, "Pagamento não encontrado");
    }

    await db.delete(paymentsTable).where(eq(paymentsTable.id, req.params.id as string));

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;

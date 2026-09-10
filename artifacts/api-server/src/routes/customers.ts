import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { customersTable, subscriptionsTable, paymentsTable, plansTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { authenticate, authorize } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import { AppError } from "../middlewares/error";

const router = Router();

const customerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  nif: z.string().optional(),
  birthDate: z.string().optional(),
  state: z.enum(["activo", "inactivo", "em_atraso", "suspenso"]).default("activo"),
  leadId: z.string().uuid().optional(),
  ovgId: z.string().optional(),
  cademiId: z.string().optional(),
  whatsappPhone: z.string().optional(),
});

const customerUpdateSchema = customerSchema.partial();

// List all customers
router.get("/customers", authenticate, async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const customers = await db.query.customersTable.findMany({
      orderBy: [desc(customersTable.createdAt)],
      limit,
    });

    res.json({ data: customers, total: customers.length });
  } catch (err) {
    next(err);
  }
});

// Get customer by ID with subscriptions and payments
router.get("/customers/:id", authenticate, async (req, res, next) => {
  try {
    const customer = await db.query.customersTable.findFirst({
      where: eq(customersTable.id, req.params.id as string),
      with: {
        // TODO: Add relations when defined
      },
    });

    if (!customer) {
      throw new AppError(404, "Cliente não encontrado");
    }

    // Get subscriptions
    const subscriptions = await db.query.subscriptionsTable.findMany({
      where: eq(subscriptionsTable.customerId, req.params.id as string),
    });

    // Get recent payments
    const payments = await db.query.paymentsTable.findMany({
      where: eq(paymentsTable.customerId, req.params.id as string),
      orderBy: [desc(paymentsTable.createdAt)],
      limit: 10,
    });

    res.json({
      data: {
        ...customer,
        subscriptions,
        payments,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Create customer
router.post("/customers", authenticate, authorize("administrador", "gestor", "comercial"), validate(customerSchema), async (req, res, next) => {
  try {
    // Generate unique code
    const count = await db.$count(customersTable);
    const code = `CL-${String(842 + count + 1).padStart(5, "0")}`;

    // Check for duplicate by NIF or email
    if (req.body.nif) {
      const existing = await db.query.customersTable.findFirst({
        where: eq(customersTable.nif, req.body.nif),
      });
      if (existing) {
        throw new AppError(409, "Cliente com este NIF já existe");
      }
    }

    if (req.body.email) {
      const existing = await db.query.customersTable.findFirst({
        where: eq(customersTable.email, req.body.email),
      });
      if (existing) {
        throw new AppError(409, "Cliente com este email já existe");
      }
    }

    const [customer] = await db
      .insert(customersTable)
      .values({
        ...req.body,
        code,
      })
      .returning();

    res.status(201).json({ data: customer });
  } catch (err) {
    next(err);
  }
});

// Update customer
router.patch("/customers/:id", authenticate, authorize("administrador", "gestor"), validate(customerUpdateSchema), async (req, res, next) => {
  try {
    const existing = await db.query.customersTable.findFirst({
      where: eq(customersTable.id, req.params.id as string),
    });

    if (!existing) {
      throw new AppError(404, "Cliente não encontrado");
    }

    const [customer] = await db
      .update(customersTable)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(customersTable.id, req.params.id as string))
      .returning();

    res.json({ data: customer });
  } catch (err) {
    next(err);
  }
});

// Delete customer
router.delete("/customers/:id", authenticate, authorize("administrador"), async (req, res, next) => {
  try {
    const existing = await db.query.customersTable.findFirst({
      where: eq(customersTable.id, req.params.id as string),
    });

    if (!existing) {
      throw new AppError(404, "Cliente não encontrado");
    }

    await db.delete(customersTable).where(eq(customersTable.id, req.params.id as string));

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;

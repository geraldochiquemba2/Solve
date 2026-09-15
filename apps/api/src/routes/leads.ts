import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { leadsTable, customersTable, subscriptionsTable } from "@workspace/db/schema";
import { eq, like, or, desc, and, sql } from "drizzle-orm";
import { authenticate, authorize } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import { AppError } from "../middlewares/error";

const router = Router();

const leadSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  source: z.string().optional(),
  status: z.enum(["novo_lead", "contacto", "qualificado", "proposta", "negociacao", "convertido", "perdido"]).default("novo_lead"),
  ownerId: z.string().uuid().optional(),
  estimatedValue: z.number().int().optional(),
  notes: z.string().optional(),
  ovgId: z.string().optional(),
});

const leadUpdateSchema = leadSchema.partial();

// List all leads with filters
router.get("/leads", authenticate, async (req, res, next) => {
  try {
    const { search, status, source, owner } = req.query;

    const conditions = [];

    if (search && typeof search === "string") {
      const pattern = `%${search}%`;
      conditions.push(
        or(
          like(leadsTable.name, pattern),
          like(leadsTable.email, pattern),
          like(leadsTable.company, pattern),
          like(leadsTable.phone, pattern)
        )
      );
    }

    if (status && typeof status === "string" && status !== "Todos") {
      conditions.push(eq(leadsTable.status, status as any));
    }

    if (source && typeof source === "string" && source !== "Todas") {
      conditions.push(eq(leadsTable.source, source));
    }

    if (owner && typeof owner === "string") {
      conditions.push(eq(leadsTable.owner_id, owner));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const leads = await db
      .select()
      .from(leadsTable)
      .where(where)
      .orderBy(desc(leadsTable.createdAt));

    res.json({ data: leads, total: leads.length });
  } catch (err) {
    next(err);
  }
});

// Get lead by ID
router.get("/leads/:id", authenticate, async (req, res, next) => {
  try {
    const lead = await db.query.leadsTable.findFirst({
      where: eq(leadsTable.id, req.params.id as string),
    });

    if (!lead) {
      throw new AppError(404, "Lead não encontrado");
    }

    res.json({ data: lead });
  } catch (err) {
    next(err);
  }
});

// Create lead
router.post("/leads", authenticate, authorize("administrador", "gestor", "comercial"), validate(leadSchema), async (req, res, next) => {
  try {
    const count = await db.$count(leadsTable);
    const code = `LED-${String(1000 + count + 1).padStart(4, "0")}`;

    const [lead] = await db
      .insert(leadsTable)
      .values({
        ...req.body,
        code,
      })
      .returning();

    res.status(201).json({ data: lead });
  } catch (err) {
    next(err);
  }
});

// Update lead
router.patch("/leads/:id", authenticate, authorize("administrador", "gestor", "comercial"), validate(leadUpdateSchema), async (req, res, next) => {
  try {
    const existing = await db.query.leadsTable.findFirst({
      where: eq(leadsTable.id, req.params.id as string),
    });

    if (!existing) {
      throw new AppError(404, "Lead não encontrado");
    }

    const [lead] = await db
      .update(leadsTable)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(leadsTable.id, req.params.id as string))
      .returning();

    res.json({ data: lead });
  } catch (err) {
    next(err);
  }
});

// Delete lead
router.delete("/leads/:id", authenticate, authorize("administrador", "gestor"), async (req, res, next) => {
  try {
    const existing = await db.query.leadsTable.findFirst({
      where: eq(leadsTable.id, req.params.id as string),
    });

    if (!existing) {
      throw new AppError(404, "Lead não encontrado");
    }

    await db.delete(leadsTable).where(eq(leadsTable.id, req.params.id as string));

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// Convert lead to customer
router.post("/leads/:id/convert", authenticate, authorize("administrador", "gestor", "comercial"), async (req, res, next) => {
  try {
    const lead = await db.query.leadsTable.findFirst({
      where: eq(leadsTable.id, req.params.id as string),
    });

    if (!lead) {
      throw new AppError(404, "Lead não encontrado");
    }

    if (lead.status === "convertido") {
      throw new AppError(400, "Lead já foi convertido");
    }

    // Generate customer code
    const customerCount = await db.$count(customersTable);
    const customerCode = `CLI-${String(2000 + customerCount + 1).padStart(4, "0")}`;

    // Create customer from lead data
    const [customer] = await db
      .insert(customersTable)
      .values({
        code: customerCode,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        company: lead.company,
        nif: null,
        state: "activo",
        ovgId: lead.ovgId,
        leadId: lead.id,
      })
      .returning();

    // Update lead status to "convertido"
    await db
      .update(leadsTable)
      .set({
        status: "convertido",
        convertedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(leadsTable.id, lead.id));

    res.json({
      message: "Lead convertido com sucesso",
      data: { lead: { ...lead, status: "convertido" }, customer },
    });
  } catch (err) {
    next(err);
  }
});

export default router;

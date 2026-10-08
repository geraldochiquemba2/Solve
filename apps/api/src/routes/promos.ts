import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { promoCodesTable, promoUsagesTable, paymentsTable, customersTable } from "@workspace/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { authenticate, authorize } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import { AppError } from "../middlewares/error";
import { rateLimit } from "../middlewares/rate-limit";
import {
  generatePromoCode,
  normalizeCode,
  validatePromo,
} from "../lib/promo";

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Exceções: admin pode tudo, gestor só lê/gera (o delete fica para admin).
const readRoles = authorize("administrador", "gestor");
const writeRoles = authorize("administrador");

const dateish = z.union([z.string(), z.null()]).optional();

function parseDateInput(value: string | null | undefined, field: string): Date | null {
  if (value == null || value === "") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new AppError(400, `Data inválida em ${field}`);
  return d;
}

const promoObjectSchema = z.object({
  code: z.string().trim().min(3, "Código demasiado curto").max(50).optional(),
  type: z.enum(["percent", "fixed"]).default("percent"),
  value: z.coerce.number().min(0, "Valor inválido"),
  min_amount: z.coerce.number().min(0).nullable().optional(),
  max_discount: z.coerce.number().min(0).nullable().optional(),
  applies_to: z.enum(["all", "plans"]).default("all"),
  plan_ids: z.array(z.string().min(1)).nullable().optional(),
  usage_limit: z.coerce.number().int().min(1).nullable().optional(),
  per_user: z.boolean().default(true),
  active: z.boolean().default(true),
  starts_at: dateish,
  expires_at: dateish,
});

const promoBodySchema = promoObjectSchema.superRefine((body, ctx) => {
  if (body.type === "percent" && body.value > 100) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "Percentagem máxima é 100" });
  }
  if (body.min_amount != null && body.max_discount != null && body.max_discount > body.min_amount) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["max_discount"], message: "Desconto máximo não pode exceder o mínimo da compra" });
  }
});

const promoPatchSchema = promoObjectSchema.partial();

type PromoBody = z.infer<typeof promoBodySchema>;

function createdByFrom(userId?: string): string | null {
  // API-key autentica como userId "api-key" — não é uuid, não pode ir para a FK.
  return userId && UUID_RE.test(userId) ? userId : null;
}

function toRow(body: PromoBody, createdBy: string | null) {
  const code = normalizeCode(body.code);
  if (!code) throw new AppError(400, "Código obrigatório");
  const startsAt = parseDateInput(body.starts_at, "starts_at");
  const expiresAt = parseDateInput(body.expires_at, "expires_at");
  if (startsAt && expiresAt && expiresAt.getTime() <= startsAt.getTime()) {
    throw new AppError(400, "A expiração tem de ser posterior ao início");
  }
  return {
    code,
    type: body.type,
    value: Math.round(body.value),
    minAmount: body.min_amount ?? null,
    maxDiscount: body.max_discount ?? null,
    appliesTo: body.applies_to,
    planIds: body.plan_ids ?? null,
    usageLimit: body.usage_limit ?? null,
    perUser: body.per_user,
    active: body.active,
    startsAt,
    expiresAt,
    createdBy,
    updatedAt: new Date(),
  };
}

// ─── POST /promos/validate — público (widget/portal/cobrança) ────────────────
router.post("/promos/validate", rateLimit({ windowMs: 60_000, max: 60, keyFn: (req) => `promo-validate:${req.ip}` }), async (req, res, next) => {
  try {
    const { code, amount, email, phone, cademi_produto, plan_ids } = req.body ?? {};
    const result = await validatePromo({
      code,
      base: amount,
      email,
      phone,
      cademiProduto: cademi_produto,
      planIds: plan_ids,
    });
    if (!result.valid) {
      res.json({ valid: false, reason: result.reason });
      return;
    }
    res.json({
      valid: true,
      discount: result.discount,
      original: result.original,
      final: result.final,
      type: result.promo.type,
      value: Number(result.promo.value),
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /promos — lista com contagem de usos ativos ─────────────────────────
router.get("/promos", authenticate, readRoles, async (req, res, next) => {
  try {
    const promos = await db.select().from(promoCodesTable).orderBy(desc(promoCodesTable.createdAt));
    const counts = await db.execute(sql`
      SELECT u.promo_id, COUNT(*)::int AS n
        FROM ${promoUsagesTable} u
        JOIN ${paymentsTable} p ON p.code = u.payment_code
       WHERE p.status NOT IN ('rejeitado', 'expirado', 'cancelado')
       GROUP BY u.promo_id`);
    const byPromo = new Map(
      (counts.rows as Array<{ promo_id: string; n: number }>).map((r) => [String(r.promo_id), Number(r.n)]),
    );
    const data = promos.map((p) => ({ ...p, usageCount: byPromo.get(String(p.id)) ?? 0 }));
    res.json({ data, total: data.length });
  } catch (err) {
    next(err);
  }
});

// ─── GET /promos/:id/usages — quem/usos pagos com este código ────────────────
router.get("/promos/:id/usages", authenticate, readRoles, async (req, res, next) => {
  try {
    const promo = await db.query.promoCodesTable.findFirst({ where: eq(promoCodesTable.id, req.params.id as string) });
    if (!promo) throw new AppError(404, "Código não encontrado");

    const rows = await db.execute(sql`
      SELECT u.id, u.user_key, u.email, u.phone, u.payment_code, u.discount_applied,
             u.amount_before, u.amount_after, u.used_at,
             p.status AS payment_status, p.amount AS payment_amount, c.name AS customer_name
        FROM ${promoUsagesTable} u
        LEFT JOIN ${paymentsTable} p ON p.code = u.payment_code
        LEFT JOIN ${customersTable} c ON c.id = u.customer_id
       WHERE u.promo_id = ${promo.id}
       ORDER BY u.used_at DESC
       LIMIT 200`);
    res.json({ data: rows.rows, total: (rows.rows as Array<unknown>).length });
  } catch (err) {
    next(err);
  }
});

// ─── POST /promos — criação (código gerado no servidor se omitido) ───────────
router.post("/promos", authenticate, writeRoles, validate(promoBodySchema), async (req, res, next) => {
  try {
    const body = req.body as PromoBody;
    const createdBy = createdByFrom(req.user?.userId);

    // Sem código (ou `generate`) → geração aleatória; o servidor garante unicidade.
    const wantsGenerated = !body.code || req.body?.generate === true;
    const attempts = wantsGenerated ? 5 : 1;

    let lastDuplicate = false;
    for (let i = 0; i < attempts; i++) {
      const row = toRow({ ...body, code: wantsGenerated ? generatePromoCode() : body.code }, createdBy);
      try {
        const [created] = await db.insert(promoCodesTable).values(row).returning();
        res.status(201).json({ data: created });
        return;
      } catch (err: any) {
        if (err?.code !== "23505") throw err;
        lastDuplicate = true;
      }
    }
    if (lastDuplicate) throw new AppError(409, "Já existe um código com esse nome.");
    throw new AppError(500, "Erro ao criar código");
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /promos/:id/toggle ────────────────────────────────────────────────
router.patch("/promos/:id/toggle", authenticate, writeRoles, async (req, res, next) => {
  try {
    const existing = await db.query.promoCodesTable.findFirst({ where: eq(promoCodesTable.id, req.params.id as string) });
    if (!existing) throw new AppError(404, "Código não encontrado");

    const [row] = await db
      .update(promoCodesTable)
      .set({ active: !existing.active, updatedAt: new Date() })
      .where(eq(promoCodesTable.id, req.params.id as string))
      .returning();
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /promos/:id ───────────────────────────────────────────────────────
router.patch("/promos/:id", authenticate, writeRoles, validate(promoPatchSchema), async (req, res, next) => {
  try {
    const existing = await db.query.promoCodesTable.findFirst({ where: eq(promoCodesTable.id, req.params.id as string) });
    if (!existing) throw new AppError(404, "Código não encontrado");

    const patch = req.body as Partial<PromoBody>;
    const update: Record<string, unknown> = { updatedAt: new Date() };

    if (patch.code !== undefined) update.code = normalizeCode(patch.code);
    if (patch.type !== undefined) update.type = patch.type;
    if (patch.value !== undefined) update.value = Math.round(patch.value);
    if (patch.min_amount !== undefined) update.minAmount = patch.min_amount ?? null;
    if (patch.max_discount !== undefined) update.maxDiscount = patch.max_discount ?? null;
    if (patch.applies_to !== undefined) update.appliesTo = patch.applies_to;
    if (patch.plan_ids !== undefined) update.planIds = patch.plan_ids ?? null;
    if (patch.usage_limit !== undefined) update.usageLimit = patch.usage_limit ?? null;
    if (patch.per_user !== undefined) update.perUser = patch.per_user;
    if (patch.active !== undefined) update.active = patch.active;
    if (patch.starts_at !== undefined) update.startsAt = parseDateInput(patch.starts_at, "starts_at");
    if (patch.expires_at !== undefined) update.expiresAt = parseDateInput(patch.expires_at, "expires_at");

    const finalType = patch.type ?? existing.type;
    const finalValue = patch.value !== undefined ? Math.round(patch.value) : Number(existing.value);
    if (finalType === "percent" && finalValue > 100) throw new AppError(400, "Percentagem máxima é 100");
    if (finalValue < 0) throw new AppError(400, "Valor inválido");

    const startsAt = (update.startsAt as Date | null | undefined) !== undefined ? (update.startsAt as Date | null) : existing.startsAt;
    const expiresAt = (update.expiresAt as Date | null | undefined) !== undefined ? (update.expiresAt as Date | null) : existing.expiresAt;
    if (startsAt && expiresAt && new Date(expiresAt).getTime() <= new Date(startsAt).getTime()) {
      throw new AppError(400, "A expiração tem de ser posterior ao início");
    }

    const [updated] = await db
      .update(promoCodesTable)
      .set(update)
      .where(eq(promoCodesTable.id, req.params.id as string))
      .returning();
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /promos/:id ──────────────────────────────────────────────────────
router.delete("/promos/:id", authenticate, writeRoles, async (req, res, next) => {
  try {
    const existing = await db.query.promoCodesTable.findFirst({ where: eq(promoCodesTable.id, req.params.id as string) });
    if (!existing) throw new AppError(404, "Código não encontrado");

    // promo_usages apaga em cascade; histórico de pagamentos mantém metadata.promo.
    await db.delete(promoCodesTable).where(eq(promoCodesTable.id, req.params.id as string));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;

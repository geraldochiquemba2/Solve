import { Hono } from "hono";
import { db } from "@workspace/db";
import { promoCodesTable, promoUsagesTable } from "@workspace/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../middleware/auth";

const app = new Hono();

function normCode(c: string) { return String(c || "").trim().toUpperCase(); }

function extractUserKey({ email, phone }: { email?: string; phone?: string }) {
  if (email) return String(email).trim().toLowerCase();
  if (phone) {
    let d = String(phone).replace(/\D/g, "");
    if (d.startsWith("244") && d.length > 9) d = d.slice(3);
    if (d.startsWith("00")) d = d.slice(2);
    if (d.length >= 9) d = d.slice(-9);
    return d || null;
  }
  return null;
}

app.get("/", requireAuth, requireRole("administrador", "gestor"), async (c) => {
  const rows = await db.select().from(promoCodesTable).orderBy(desc(promoCodesTable.createdAt));
  return c.json({ data: rows, total: rows.length });
});

app.post("/", requireAuth, requireRole("administrador"), async (c) => {
  try {
    const body = await c.req.json();
    const code = normCode(body.code);
    if (!code) return c.json({ error: "Código obrigatório" }, 400);
    const type = body.type === "fixed" ? "fixed" : "percent";
    const value = Number(body.value);
    if (!Number.isFinite(value) || value < 0) return c.json({ error: "Valor inválido" }, 400);
    if (type === "percent" && value > 100) return c.json({ error: "Percentagem máxima é 100" }, 400);
    const appliesTo = body.applies_to === "plans" ? "plans" : "all";
    const planIds = Array.isArray(body.plan_ids) ? body.plan_ids : null;
    const [row] = await db.insert(promoCodesTable).values({
      code,
      type,
      value,
      minAmount: body.min_amount != null && body.min_amount !== "" ? Number(body.min_amount) : null,
      maxDiscount: body.max_discount != null && body.max_discount !== "" ? Number(body.max_discount) : null,
      appliesTo,
      planIds,
      usageLimit: body.usage_limit != null && body.usage_limit !== "" ? Number(body.usage_limit) : null,
      perUser: body.per_user === undefined ? true : !!body.per_user,
      active: body.active === undefined ? true : !!body.active,
      startsAt: body.starts_at ? new Date(body.starts_at) : null,
      expiresAt: body.expires_at ? new Date(body.expires_at) : null,
      createdBy: (c.get("user") as any)?.id,
    }).returning();
    return c.json({ data: row }, 201);
  } catch (e: any) {
    if (e?.code === "23505") return c.json({ error: "Já existe um código com esse nome." }, 409);
    return c.json({ error: "Erro ao criar código" }, 500);
  }
});

app.patch("/:id", requireAuth, requireRole("administrador"), async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const update: any = { updatedAt: new Date() };
  if (body.code !== undefined) update.code = normCode(body.code);
  if (body.type !== undefined) update.type = body.type === "fixed" ? "fixed" : "percent";
  if (body.value !== undefined) update.value = Number(body.value);
  if (body.min_amount !== undefined) update.minAmount = body.min_amount === null ? null : Number(body.min_amount);
  if (body.max_discount !== undefined) update.maxDiscount = body.max_discount === null ? null : Number(body.max_discount);
  if (body.applies_to !== undefined) update.appliesTo = body.applies_to === "plans" ? "plans" : "all";
  if (body.plan_ids !== undefined) update.planIds = Array.isArray(body.plan_ids) ? body.plan_ids : null;
  if (body.usage_limit !== undefined) update.usageLimit = body.usage_limit === null ? null : Number(body.usage_limit);
  if (body.per_user !== undefined) update.perUser = !!body.per_user;
  if (body.active !== undefined) update.active = !!body.active;
  if (body.starts_at !== undefined) update.startsAt = body.starts_at ? new Date(body.starts_at) : null;
  if (body.expires_at !== undefined) update.expiresAt = body.expires_at ? new Date(body.expires_at) : null;
  const [row] = await db.update(promoCodesTable).set(update).where(eq(promoCodesTable.id, id)).returning();
  if (!row) return c.json({ error: "Não encontrado" }, 404);
  return c.json({ data: row });
});

app.post("/validate", async (c) => {
  try {
    const { code, amount, email, phone, cademi_produto, plan_ids } = await c.req.json();
    const base = Number(amount);
    if (!code || !Number.isFinite(base) || base <= 0) return c.json({ valid: false, reason: "Dados inválidos" }, 400);
    const [promo] = await db.select().from(promoCodesTable).where(eq(promoCodesTable.code, normCode(code)));
    if (!promo) return c.json({ valid: false, reason: "Código inválido" });
    if (!promo.active) return c.json({ valid: false, reason: "Código inativo" });
    const now = Date.now();
    if (promo.startsAt && now < promo.startsAt.getTime()) return c.json({ valid: false, reason: "Código ainda não começou" });
    if (promo.expiresAt && now > promo.expiresAt.getTime()) return c.json({ valid: false, reason: "Código expirado" });
    if (promo.minAmount != null && base < promo.minAmount) return c.json({ valid: false, reason: Compra mínima  Kz });
    if (promo.appliesTo !== "all") {
      const allowed: string[] = Array.isArray(promo.planIds) ? (promo.planIds as string[]) : [];
      const ctx: string[] = [cademi_produto, ...(Array.isArray(plan_ids) ? plan_ids : plan_ids ? [plan_ids] : [])].filter(Boolean) as string[];
      if (!ctx.some((x) => allowed.includes(String(x)))) return c.json({ valid: false, reason: "Código não aplicável" });
    }
    const key = extractUserKey({ email, phone });
    if (promo.perUser && key) {
      const used = await db.execute(sql
        SELECT 1 FROM  u
        JOIN payments p ON p.code = u.payment_code
        WHERE u.promo_id =  AND u.user_key = 
          AND p.status NOT IN ('rejeitado','expirado','cancelado')
        LIMIT 1
      );
      const rows = (used as any).rows;
      if (rows && rows.length > 0) return c.json({ valid: false, reason: "Já utilizou este código" });
    }
    if (promo.usageLimit != null) {
      const cnt = await db.execute(sql
        SELECT COUNT(*)::int AS n FROM  u
        JOIN payments p ON p.code = u.payment_code
        WHERE u.promo_id = 
          AND p.status NOT IN ('rejeitado','expirado','cancelado')
      );
      const n = (cnt as any).rows?.[0]?.n || 0;
      if (n >= promo.usageLimit) return c.json({ valid: false, reason: "Limite de usos atingido" });
    }
    let discount = 0;
    if (promo.type === "percent") discount = Math.floor((base * (promo.value as number)) / 100);
    else discount = promo.value as number;
    if (discount > base) discount = base;
    if (discount < 0) discount = 0;
    if (promo.maxDiscount != null && discount > promo.maxDiscount) discount = promo.maxDiscount;
    const finalAmt = base - discount;
    return c.json({ valid: true, discount, original: base, final: finalAmt, type: promo.type, value: promo.value });
  } catch (e) {
    return c.json({ valid: false, reason: "Erro ao validar" }, 500);
  }
});

export default app;

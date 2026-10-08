import { db } from "@workspace/db";
import { promoCodesTable, promoUsagesTable, paymentsTable } from "@workspace/db/schema";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

export type PromoCode = typeof promoCodesTable.$inferSelect;

// Sem 0/O/1/I/I para o código ser ditável ao telefone.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

/** Código aleatório no formato FIT-XXXXXXXX (único — o chamador trata o 23505). */
export function generatePromoCode(prefix = "FIT"): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return `${prefix}-${out}`;
}

export function normalizeCode(code: unknown): string {
  return String(code ?? "").trim().toUpperCase();
}

/** Normaliza telefone AO: só dígitos, sem +/00/prefixo 244 → 9XXXXXXXX. */
export function normPhone(phone: unknown): string {
  let d = String(phone ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("244") && d.length > 9) d = d.slice(3);
  if (d.length > 9) d = d.slice(-9);
  return d;
}

/**
 * Identidade do utilizador para o limite de "um uso por utilizador":
 * email normalizado (minúsculas) > telefone normalizado. É a mesma chave que o
 * standalone-server grava em promo_usages.user_key.
 */
export function promoUserKey({ email, phone }: { email?: string | null; phone?: string | null } = {}): string | null {
  const e = String(email ?? "").trim().toLowerCase();
  if (e) return e;
  const p = normPhone(phone);
  return p || null;
}

/** Calcula o desconto. `type`: "percent" | "fixed". Sempre ≥ 0 e ≤ base. */
export function computeDiscount({
  base,
  promo,
}: {
  base: number | string;
  promo: Pick<PromoCode, "type" | "value" | "maxDiscount">;
}): { discount: number; final: number } {
  const amount = Number(base);
  if (!Number.isFinite(amount) || amount <= 0) return { discount: 0, final: 0 };
  const value = Number(promo.value);
  if (!Number.isFinite(value) || value < 0) return { discount: 0, final: amount };
  let discount = promo.type === "fixed" ? value : Math.floor((amount * value) / 100);
  if (promo.maxDiscount != null && discount > Number(promo.maxDiscount)) discount = Number(promo.maxDiscount);
  discount = Math.max(0, Math.min(discount, amount));
  return { discount, final: amount - discount };
}

export async function findPromoByCode(code: unknown): Promise<PromoCode | null> {
  const rows = await db
    .select()
    .from(promoCodesTable)
    .where(sql`UPPER(${promoCodesTable.code}) = ${normalizeCode(code)}`)
    .limit(1);
  return rows[0] ?? null;
}

export interface PromoValidationOk {
  valid: true;
  promo: PromoCode;
  discount: number;
  original: number;
  final: number;
}
export interface PromoValidationErr {
  valid: false;
  reason: string;
}
export type PromoValidation = PromoValidationOk | PromoValidationErr;

export interface PromoContext {
  code?: unknown;
  /** Montante de partida (preço oficial do plano/conteúdo). */
  base?: number | unknown;
  email?: string | null;
  phone?: string | null;
  /** Slug/ID do produto Cademi e/ou IDs de planos do CRM — para o âmbito. */
  cademiProduto?: string | null;
  planIds?: string[] | string | null;
}

/**
 * Valida um código para um contexto de compra. O servidor é autoritativo:
 * nunca confia no desconto que o cliente calculou.
 */
export async function validatePromo(ctx: PromoContext = {}): Promise<PromoValidation> {
  const code = normalizeCode(ctx.code);
  if (!code) return { valid: false, reason: "Código em branco" };

  const promo = await findPromoByCode(code);
  if (!promo) return { valid: false, reason: "Código inexistente" };
  if (!promo.active) return { valid: false, reason: "Código inativo" };

  const now = Date.now();
  if (promo.startsAt && now < promo.startsAt.getTime()) return { valid: false, reason: "Código ainda não é válido" };
  if (promo.expiresAt && now > promo.expiresAt.getTime()) return { valid: false, reason: "Código expirado" };

  const amount = Number(ctx.base);
  if (!Number.isFinite(amount) || amount <= 0) return { valid: false, reason: "Valor inválido" };
  if (promo.minAmount != null && amount < Number(promo.minAmount)) {
    return { valid: false, reason: `Compra mínima de ${promo.minAmount} Kz` };
  }

  if (promo.appliesTo !== "all") {
    const allowed = Array.isArray(promo.planIds) ? (promo.planIds as string[]).map(String) : [];
    const planIds = ctx.planIds == null ? [] : Array.isArray(ctx.planIds) ? ctx.planIds : [ctx.planIds];
    const context = [ctx.cademiProduto, ...planIds].filter(Boolean).map(String);
    if (!context.some((item) => allowed.includes(item))) {
      return { valid: false, reason: "Código não aplicável a este item" };
    }
  }

  const key = promoUserKey({ email: ctx.email, phone: ctx.phone });

  // Uso único por utilizador — conta apenas pagamentos que não falharam/cancelaram.
  if (promo.perUser && key) {
    const used = await db.execute(sql`
      SELECT 1 AS one
        FROM ${promoUsagesTable} u
        JOIN ${paymentsTable} p ON p.code = u.payment_code
       WHERE u.promo_id = ${promo.id} AND u.user_key = ${key}
         AND p.status NOT IN ('rejeitado', 'expirado', 'cancelado')
       LIMIT 1`);
    if ((used.rows as Array<unknown>).length > 0) return { valid: false, reason: "Já utilizou este código" };
  }

  if (promo.usageLimit != null) {
    const cnt = await db.execute(sql`
      SELECT COUNT(*)::int AS n
        FROM ${promoUsagesTable} u
        JOIN ${paymentsTable} p ON p.code = u.payment_code
       WHERE u.promo_id = ${promo.id}
         AND p.status NOT IN ('rejeitado', 'expirado', 'cancelado')`);
    const n = Number((cnt.rows as Array<{ n?: number | string }>)[0]?.n ?? 0);
    if (n >= Number(promo.usageLimit)) return { valid: false, reason: "Código esgotado" };
  }

  const { discount, final } = computeDiscount({ base: amount, promo });
  return { valid: true, promo, discount, original: amount, final };
}

export interface RegisterPromoUsageInput {
  promo: Pick<PromoCode, "id">;
  original: number;
  discount: number;
  final: number;
  email?: string | null;
  phone?: string | null;
  customerId?: string | null;
  userId?: string | null;
  paymentCode?: string | null;
}

/** Grava o uso do código e incrementa o contador. Falhas nunca bloqueiam o pagamento. */
export async function registerPromoUsage(input: RegisterPromoUsageInput): Promise<void> {
  try {
    const userKey = promoUserKey({ email: input.email, phone: input.phone });
    await db.insert(promoUsagesTable).values({
      promoId: input.promo.id,
      userId: input.userId ?? null,
      customerId: input.customerId ?? null,
      userKey,
      email: input.email ?? null,
      phone: input.phone ?? null,
      paymentCode: input.paymentCode ?? null,
      amountBefore: Math.round(input.original),
      amountAfter: Math.round(input.final),
      discountApplied: Math.round(input.discount),
    });
    await db
      .update(promoCodesTable)
      .set({ usedCount: sql`${promoCodesTable.usedCount} + 1`, updatedAt: new Date() })
      .where(sql`${promoCodesTable.id} = ${input.promo.id}`);
  } catch (err) {
    logger.error({ err }, "Promo: falha ao registar uso do código");
  }
}

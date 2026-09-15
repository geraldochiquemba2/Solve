import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { customersTable, portalOtpsTable } from "@workspace/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { validate } from "../middlewares/validate";
import { AppError } from "../middlewares/error";
import { hashOtp, normalizePhone, requestOtp } from "../lib/portal-otp";
import { generatePortalToken } from "../middlewares/portal-auth";

const router = Router();

const requestSchema = z.object({
  phone: z.string().min(9, "Telefone é obrigatório"),
});

const verifySchema = z.object({
  phone: z.string().min(9, "Telefone é obrigatório"),
  code: z.string().regex(/^\d{6}$/, "Código deve ter 6 dígitos"),
});

// Rate-limit simples em memória: max 5/hora por phone
const requestHits = new Map<string, number[]>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_HOUR = 5;

function checkRateLimit(phone: string): void {
  const now = Date.now();
  const hits = (requestHits.get(phone) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= MAX_PER_HOUR) {
    throw new AppError(429, "Demasiados pedidos. Tente novamente mais tarde");
  }
  hits.push(now);
  requestHits.set(phone, hits);
}

export function __clearPortalRateLimit() {
  requestHits.clear();
}

router.post("/portal/otp/request", validate(requestSchema), async (req, res, next) => {
  try {
    const { phone } = req.body as { phone: string };
    const normalized = normalizePhone(phone);
    checkRateLimit(normalized);
    const { sentVia, devCode } = await requestOtp(phone);
    res.json({
      sentVia,
      ...(devCode && !process.env.WHATSAPP_TOKEN ? { devCode } : {}),
    });
  } catch (err) {
    next(err);
  }
});

router.post("/portal/otp/verify", validate(verifySchema), async (req, res, next) => {
  try {
    const { phone: rawPhone, code } = req.body as { phone: string; code: string };
    const phone = normalizePhone(rawPhone);

    const otp = await db.query.portalOtpsTable.findFirst({
      where: and(eq(portalOtpsTable.phone, phone), eq(portalOtpsTable.consumed, false)),
      orderBy: [desc(portalOtpsTable.createdAt)],
    });

    if (!otp) {
      throw new AppError(400, "Código inválido ou expirado");
    }
    if (otp.expiresAt.getTime() < Date.now()) {
      throw new AppError(400, "Código expirado");
    }
    if ((otp.attempts ?? 0) >= 3) {
      throw new AppError(429, "Demasiadas tentativas. Peça um novo código");
    }

    if (hashOtp(code) !== otp.codeHash) {
      await db
        .update(portalOtpsTable)
        .set({ attempts: (otp.attempts ?? 0) + 1 })
        .where(eq(portalOtpsTable.id, otp.id));
      throw new AppError(400, "Código inválido");
    }

    await db
      .update(portalOtpsTable)
      .set({ consumed: true, attempts: (otp.attempts ?? 0) + 1 })
      .where(eq(portalOtpsTable.id, otp.id));

    // Revalida cliente (existe + activo) no momento do verify
    const customer = await db.query.customersTable.findFirst({
      where: eq(customersTable.phone, phone),
    });
    // Fallback: tenta formatos alternativos (+244... vs 9XXXXXXXX) e whatsappPhone
    let resolved = customer;
    if (!resolved && phone.startsWith("+244")) {
      const short = phone.slice(4);
      const long = phone.slice(1);
      resolved =
        (await db.query.customersTable.findFirst({ where: eq(customersTable.phone, short) })) ??
        (await db.query.customersTable.findFirst({ where: eq(customersTable.phone, long) })) ??
        (await db.query.customersTable.findFirst({ where: eq(customersTable.whatsappPhone, phone) })) ??
        (await db.query.customersTable.findFirst({ where: eq(customersTable.whatsappPhone, short) })) ??
        undefined;
    }
    if (!resolved) {
      const byWa = await db.query.customersTable.findFirst({
        where: eq(customersTable.whatsappPhone, phone),
      });
      resolved = byWa ?? undefined;
    }

    if (!resolved) {
      throw new AppError(404, "Número não registado como cliente");
    }
    if (resolved.state !== "activo") {
      throw new AppError(403, "Conta de cliente inactiva");
    }

    const token = generatePortalToken(resolved.id, phone);
    res.json({
      token,
      customer: { id: resolved.id, name: resolved.name, state: resolved.state },
    });
  } catch (err) {
    next(err);
  }
});

export default router;

import { Router, type Request } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { customersTable, plansTable, subscriptionsTable, paymentsTable } from "@workspace/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { authenticatePortal } from "../middlewares/portal-auth";
import { validate } from "../middlewares/validate";
import { AppError } from "../middlewares/error";
import { ekwanzaClient, EkwanzaError } from "../lib/ekwanza";
import { validatePromo, registerPromoUsage } from "../lib/promo";
import { deliverInBackground } from "../lib/cademi-delivery";
import { logger } from "../lib/logger";

const router = Router();

const phoneNumberSchema = z
  .string()
  .min(9, "NÃºmero de telemÃ³vel invÃ¡lido")
  .max(16, "NÃºmero de telemÃ³vel invÃ¡lido")
  .regex(/^\+?[0-9\s\-().]{9,16}$/, "NÃºmero de telemÃ³vel invÃ¡lido");

const pagarSchema = z.object({
  method: z.enum(["express", "referencia"]),
  subscriptionId: z.string().uuid("SubscriÃ§Ã£o invÃ¡lida").optional(),
  // Express pode ser pago a partir de QUALQUER nÃºmero (ex: familiar paga pelo
  // cliente). Se omitido, usa o nÃºmero da conta.
  phoneNumber: phoneNumberSchema.optional(),
  // CÃ³digo promocional opcional â€” o desconto Ã© recalculado no servidor.
  promoCode: z.string().trim().min(1).max(50).optional(),
});

const pagamentosQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const reciboParamsSchema = z.object({
  id: z.string().uuid("Recibo invÃ¡lido"),
});

function requireCustomerId(req: Request): string {
  if (!req.customerId) {
    throw new AppError(401, "Token de cliente necessÃ¡rio");
  }
  return req.customerId;
}

// â”€â”€â”€ GET /portal/minha-conta â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.get("/portal/minha-conta", authenticatePortal, async (req, res, next) => {
  try {
    const customerId = requireCustomerId(req);

    const customer = await db.query.customersTable.findFirst({
      where: eq(customersTable.id, customerId),
    });
    if (!customer) {
      throw new AppError(404, "Cliente nÃ£o encontrado");
    }

    const subs = await db.query.subscriptionsTable.findMany({
      where: and(eq(subscriptionsTable.customerId, customerId), eq(subscriptionsTable.active, true)),
      orderBy: [desc(subscriptionsTable.endDate)],
      limit: 1,
    });
    const sub = subs[0] ?? null;
    const plan = sub
      ? await db.query.plansTable.findFirst({ where: eq(plansTable.id, sub.planId) })
      : null;

    // Aulas: progresso guardado na subscriÃ§Ã£o (lessons_done / lessons_total).
    // limite cai para a duraÃ§Ã£o do plano quando a subscriÃ§Ã£o nÃ£o tem total.
    const usadas = sub?.lessonsDone ?? 0;
    const limite = sub?.lessonsTotal ?? plan?.duration ?? null;
    const restantes = limite != null ? Math.max(0, limite - usadas) : null;

    res.json({
      data: {
        customer: {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
          state: customer.state,
        },
        subscription: sub
          ? {
              id: sub.id,
              planId: plan?.id ?? null,
              planName: plan?.name ?? null,
              price: plan?.price ?? null,
              periodicity: plan?.periodicity ?? null,
              endDate: sub.endDate,
              active: sub.active,
            }
          : null,
        aulas: { usadas, limite, restantes, fonte: "crm" as const },
        proximaMensalidade:
          sub && plan && sub.endDate
            ? { amount: plan.price, dueDate: sub.endDate }
            : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

// â”€â”€â”€ POST /portal/pagar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Cria payment pendente (code SCâ€¦, expiresAt +24h) e, se method=express,
// dispara cobranÃ§a Multicaixa Express via ekwanzaClient.createGPOCharge
// (mesmo fluxo do staff em routes/payments-ekwanza.ts).

router.post("/portal/pagar", authenticatePortal, validate(pagarSchema), async (req, res, next) => {
  try {
    const customerId = requireCustomerId(req);
    const { method, subscriptionId, phoneNumber, promoCode } = req.body as {
      method: "express" | "referencia";
      subscriptionId?: string;
      phoneNumber?: string;
      promoCode?: string;
    };

    const customer = await db.query.customersTable.findFirst({
      where: eq(customersTable.id, customerId),
    });
    if (!customer) {
      throw new AppError(404, "Cliente nÃ£o encontrado");
    }

    let sub;
    if (subscriptionId) {
      sub =
        (await db.query.subscriptionsTable.findFirst({
          where: and(eq(subscriptionsTable.id, subscriptionId), eq(subscriptionsTable.customerId, customerId)),
        })) ?? null;
      if (!sub) {
        throw new AppError(404, "SubscriÃ§Ã£o nÃ£o encontrada");
      }
    } else {
      const subs = await db.query.subscriptionsTable.findMany({
        where: and(eq(subscriptionsTable.customerId, customerId), eq(subscriptionsTable.active, true)),
        orderBy: [desc(subscriptionsTable.endDate)],
        limit: 1,
      });
      sub = subs[0] ?? null;
      if (!sub) {
        throw new AppError(404, "Sem subscriÃ§Ã£o activa para pagar");
      }
    }

    const plan = await db.query.plansTable.findFirst({
      where: eq(plansTable.id, sub.planId),
    });
    if (!plan) {
      throw new AppError(404, "Plano nÃ£o encontrado");
    }
    const originalAmount = plan.price;
    let amount = originalAmount;
    let promoApplied: {
      code: string;
      codeId: string;
      original: number;
      discount: number;
      final: number;
      type: "percent" | "fixed";
      value: number;
    } | null = null;
    // CÃ³digo que cobre a totalidade: confirma sem gateway e entrega jÃ¡ o acesso.
    let autoConfirm = false;

    if (promoCode) {
      const result = await validatePromo({
        code: promoCode,
        base: originalAmount,
        email: customer.email,
        phone: customer.phone,
        planIds: [plan.id],
      });
      if (!result.valid) throw new AppError(400, result.reason);
      promoApplied = {
        code: String(promoCode).trim().toUpperCase(),
        codeId: result.promo.id,
        original: result.original,
        discount: result.discount,
        final: result.final,
        type: result.promo.type,
        value: Number(result.promo.value),
      };
      amount = result.final;
      if (amount <= 0) {
        amount = 0;
        autoConfirm = true;
      }
    }

    // Mesmo padrÃ£o de cÃ³digo do staff (payments-ekwanza.ts)
    const count = await db.$count(paymentsTable);
    const code = `SC${String(81000 + count + 1).padStart(5, "0")}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    let [payment] = await db
      .insert(paymentsTable)
      .values({
        code,
        customerId,
        subscriptionId: sub.id,
        amount,
        method: method === "express" ? "mcx_express" : "referencia",
        status: autoConfirm ? "confirmado" : "pendente",
        paidAt: autoConfirm ? new Date() : null,
        referenceCode: code,
        expiresAt,
        ...(promoApplied ? { metadata: { promo: promoApplied } } : {}),
      })
      .returning();

    // Registo de uso do cÃ³digo (ligado a este pagamento; conta para o limite).
    if (promoApplied) {
      await registerPromoUsage({
        promo: { id: promoApplied.codeId },
        original: promoApplied.original,
        discount: promoApplied.discount,
        final: promoApplied.final,
        email: customer.email,
        phone: customer.phone,
        customerId,
        paymentCode: code,
      });
    }

    let express: { initiated: boolean } | null = null;
    let referencia: { entity: string | null; reference: string; expiresAt: Date } | null = null;

    if (autoConfirm) {
      // Promo 100%: sem cobranÃ§a â€” entrega o acesso na Cademi em background.
      deliverInBackground(code);
    } else if (method === "express") {
      // Qualquer nÃºmero pode pagar via Express (ex: familiar). Valida formato AO:
      // 9XXXXXXXX local â€” normaliza removendo +244/244/espaÃ§os para o GPO.
      const rawPhone = (phoneNumber?.trim() ? phoneNumber : customer.phone || customer.whatsappPhone) || "";
      const digits = rawPhone.replace(/\D/g, "");
      const local = digits.startsWith("244") ? digits.slice(3) : digits;
      if (!/^9\d{8}$/.test(local)) {
        throw new AppError(400, "NÃºmero de telemÃ³vel invÃ¡lido para Multicaixa Express (usa 9XXXXXXXX)");
      }
      // Strip +244/244 para o Multicaixa Express (igual ao staff)
      const cleanPhone = local;

      try {
        const result = await ekwanzaClient.createGPOCharge(
          amount,
          `Portal - ${plan.name} - ${customer.name}`,
          code,
          cleanPhone,
        );

        logger.info({ code, customerId, amount, phoneNumber: cleanPhone }, "Portal GPO charge initiated");

        // Guarda o nÃºmero Express usado (pode nÃ£o ser o da conta) para
        // auditoria â€” merge com dueDate/referÃªncia EMIS abaixo.

        // Extrai referÃªncia EMIS da resposta (igual ao staff)
        const gpoData = result as Record<string, unknown>;
        const respStatus = (gpoData.responseStatus as Record<string, unknown>) || {};
        const refData = (respStatus.reference as Record<string, unknown>) || null;
        const ekwanzaReferenceNumber = refData?.referenceNumber as string | undefined;
        const ekwanzaDueDate = refData?.dueDate as string | undefined;
        const ekwanzaEntity = refData?.entity as string | undefined;

        if (ekwanzaReferenceNumber) {
          await db
            .update(paymentsTable)
            .set({
              referenceCode: ekwanzaReferenceNumber,
              ekwanzaCode: ekwanzaReferenceNumber,
              entity: ekwanzaEntity || null,
              metadata: { dueDate: ekwanzaDueDate, ekwanzaReference: refData, expressPhone: cleanPhone },
            })
            .where(eq(paymentsTable.id, payment.id));
          payment = {
            ...payment,
            referenceCode: ekwanzaReferenceNumber,
            ekwanzaCode: ekwanzaReferenceNumber,
            entity: ekwanzaEntity || null,
          };
        }

        // Estado sÃ­ncrono da resposta GPO (igual ao staff)
        const gpoStatus = respStatus.status as string | undefined;
        const gpoSuccessful = respStatus.successful as boolean | undefined;
        const gpoProviderTxId = (respStatus.gpo as Record<string, unknown>)?.providerTransactionId as
          | string
          | undefined;

        if (gpoStatus === "Success" || gpoSuccessful === true) {
          await db
            .update(paymentsTable)
            .set({ status: "confirmado", paidAt: new Date(), reconciledAt: new Date(), ekwanzaOperationCode: gpoProviderTxId || null, updatedAt: new Date() })
            .where(eq(paymentsTable.id, payment.id));
          payment = { ...payment, status: "confirmado" };
          const { broadcastPaymentUpdate } = await import("../app");
          broadcastPaymentUpdate({ type: "payment_updated", code, status: "confirmado" });
          deliverInBackground(code);
        } else if (gpoStatus === "Failed" || gpoStatus === "Cancelled" || gpoStatus === "Expired") {
          await db
            .update(paymentsTable)
            .set({ status: "rejeitado", ekwanzaOperationCode: gpoProviderTxId || null, updatedAt: new Date() })
            .where(eq(paymentsTable.id, payment.id));
          payment = { ...payment, status: "rejeitado" };
          const { broadcastPaymentUpdate } = await import("../app");
          broadcastPaymentUpdate({ type: "payment_updated", code, status: "rejeitado" });
        }

        express = { initiated: true };
      } catch (err) {
        // O payment fica pendente e visÃ­vel em /portal/pagamentos para retry.
        if (err instanceof EkwanzaError) {
          return next(new AppError(err.status || 502, `Ã‰-kwanza: ${err.message}`));
        }
        throw err;
      }
    } else {
      referencia = {
        entity: process.env.EKWANZA_ACCOUNT_NUMBER || null,
        reference: payment.referenceCode ?? code,
        expiresAt,
      };
      logger.info({ code, customerId, amount }, "Portal referencia payment created");
    }

    res.status(201).json({
      data: {
        payment: { id: payment.id, code: payment.code, status: payment.status, amount: payment.amount },
        express,
        referencia,
        promo: promoApplied
          ? { code: promoApplied.code, original: promoApplied.original, discount: promoApplied.discount, final: promoApplied.final }
          : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

// â”€â”€â”€ GET /portal/pagamentos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.get("/portal/pagamentos", authenticatePortal, validate(pagamentosQuerySchema, "query"), async (req, res, next) => {
  try {
    const customerId = requireCustomerId(req);
    const limit = (req.query as unknown as { limit?: number }).limit ?? 20;

    const rows = await db.query.paymentsTable.findMany({
      where: eq(paymentsTable.customerId, customerId),
      orderBy: [desc(paymentsTable.createdAt)],
      limit,
    });

    res.json({ data: rows, total: rows.length });
  } catch (err) {
    next(err);
  }
});

// â”€â”€â”€ GET /portal/recibos/:id â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Detalhe para recibo. O filtro por customerId impede um cliente de ver
// recibos de outro cliente.

router.get("/portal/recibos/:id", authenticatePortal, validate(reciboParamsSchema, "params"), async (req, res, next) => {
  try {
    const customerId = requireCustomerId(req);
    const id = String(req.params.id);

    const payment = await db.query.paymentsTable.findFirst({
      where: and(eq(paymentsTable.id, id), eq(paymentsTable.customerId, customerId)),
    });
    if (!payment) {
      throw new AppError(404, "Recibo nÃ£o encontrado");
    }

    const customer = await db.query.customersTable.findFirst({
      where: eq(customersTable.id, customerId),
    });

    const sub = payment.subscriptionId
      ? await db.query.subscriptionsTable.findFirst({
          where: eq(subscriptionsTable.id, payment.subscriptionId),
        })
      : null;
    const plan = sub
      ? await db.query.plansTable.findFirst({ where: eq(plansTable.id, sub.planId) })
      : null;

    res.json({
      data: {
        payment,
        customer: customer
          ? { id: customer.id, name: customer.name, phone: customer.phone, email: customer.email }
          : null,
        subscription: sub
          ? {
              id: sub.id,
              planName: plan?.name ?? null,
              price: plan?.price ?? null,
              periodicity: plan?.periodicity ?? null,
              startDate: sub.startDate,
              endDate: sub.endDate,
              active: sub.active,
            }
          : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;

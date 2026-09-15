import { Router, type Request } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { customersTable, plansTable, subscriptionsTable, paymentsTable } from "@workspace/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { authenticatePortal } from "../middlewares/portal-auth";
import { validate } from "../middlewares/validate";
import { AppError } from "../middlewares/error";
import { ekwanzaClient, EkwanzaError } from "../lib/ekwanza";
import { logger } from "../lib/logger";

const router = Router();

const phoneNumberSchema = z
  .string()
  .min(9, "Número de telemóvel inválido")
  .max(16, "Número de telemóvel inválido")
  .regex(/^\+?[0-9\s\-().]{9,16}$/, "Número de telemóvel inválido");

const pagarSchema = z.object({
  method: z.enum(["express", "referencia"]),
  subscriptionId: z.string().uuid("Subscrição inválida").optional(),
  // Express pode ser pago a partir de QUALQUER número (ex: familiar paga pelo
  // cliente). Se omitido, usa o número da conta.
  phoneNumber: phoneNumberSchema.optional(),
});

const pagamentosQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const reciboParamsSchema = z.object({
  id: z.string().uuid("Recibo inválido"),
});

function requireCustomerId(req: Request): string {
  if (!req.customerId) {
    throw new AppError(401, "Token de cliente necessário");
  }
  return req.customerId;
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ─── GET /portal/minha-conta ─────────────────────────────────────────────────

router.get("/portal/minha-conta", authenticatePortal, async (req, res, next) => {
  try {
    const customerId = requireCustomerId(req);

    const customer = await db.query.customersTable.findFirst({
      where: eq(customersTable.id, customerId),
    });
    if (!customer) {
      throw new AppError(404, "Cliente não encontrado");
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

    // Aulas: mesma fonte das stats de staff (solve_access_logs, ver routes/access.ts
    // e routes/solve-access.ts). solve_access_logs.customer_id é o id remoto
    // (OVG); a ponte é customers.ovgId. Sem ovgId não há como mapear → usadas=0.
    // limite = plans.duration (nº de sessões do plano); restantes = limite - usadas.
    let usadas = 0;
    const ovgNumericId = customer.ovgId != null ? Number(customer.ovgId) : NaN;
    if (Number.isInteger(ovgNumericId)) {
      const startStr = sub?.startDate ? toDateStr(new Date(sub.startDate)) : null;
      const countRes = startStr
        ? await db.execute(
            sql`SELECT COUNT(*)::int AS cnt FROM solve_access_logs WHERE customer_id = ${ovgNumericId} AND result = 'Autorizado' AND access_date >= ${startStr}`,
          )
        : await db.execute(
            sql`SELECT COUNT(*)::int AS cnt FROM solve_access_logs WHERE customer_id = ${ovgNumericId} AND result = 'Autorizado'`,
          );
      usadas = Number((countRes.rows as Array<{ cnt: number | string }>)[0]?.cnt ?? 0);
    }
    const limite = plan?.duration ?? null;
    const restantes = limite != null ? Math.max(0, limite - usadas) : null;

    res.json({
      data: {
        customer: {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          state: customer.state,
        },
        subscription: sub
          ? {
              id: sub.id,
              planName: plan?.name ?? null,
              price: plan?.price ?? null,
              periodicity: plan?.periodicity ?? null,
              endDate: sub.endDate,
              active: sub.active,
            }
          : null,
        aulas: { usadas, limite, restantes, fonte: "solve-access" as const },
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

// ─── POST /portal/pagar ──────────────────────────────────────────────────────
// Cria payment pendente (code SC…, expiresAt +24h) e, se method=express,
// dispara cobrança Multicaixa Express via ekwanzaClient.createGPOCharge
// (mesmo fluxo do staff em routes/payments-ekwanza.ts).

router.post("/portal/pagar", authenticatePortal, validate(pagarSchema), async (req, res, next) => {
  try {
    const customerId = requireCustomerId(req);
    const { method, subscriptionId, phoneNumber } = req.body as {
      method: "express" | "referencia";
      subscriptionId?: string;
      phoneNumber?: string;
    };

    const customer = await db.query.customersTable.findFirst({
      where: eq(customersTable.id, customerId),
    });
    if (!customer) {
      throw new AppError(404, "Cliente não encontrado");
    }

    let sub;
    if (subscriptionId) {
      sub =
        (await db.query.subscriptionsTable.findFirst({
          where: and(eq(subscriptionsTable.id, subscriptionId), eq(subscriptionsTable.customerId, customerId)),
        })) ?? null;
      if (!sub) {
        throw new AppError(404, "Subscrição não encontrada");
      }
    } else {
      const subs = await db.query.subscriptionsTable.findMany({
        where: and(eq(subscriptionsTable.customerId, customerId), eq(subscriptionsTable.active, true)),
        orderBy: [desc(subscriptionsTable.endDate)],
        limit: 1,
      });
      sub = subs[0] ?? null;
      if (!sub) {
        throw new AppError(404, "Sem subscrição activa para pagar");
      }
    }

    const plan = await db.query.plansTable.findFirst({
      where: eq(plansTable.id, sub.planId),
    });
    if (!plan) {
      throw new AppError(404, "Plano não encontrado");
    }
    const amount = plan.price;

    // Mesmo padrão de código do staff (payments-ekwanza.ts)
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
        status: "pendente",
        referenceCode: code,
        expiresAt,
      })
      .returning();

    let express: { initiated: boolean } | null = null;
    let referencia: { entity: string | null; reference: string; expiresAt: Date } | null = null;

    if (method === "express") {
      // Qualquer número pode pagar via Express (ex: familiar). Valida formato AO:
      // 9XXXXXXXX local — normaliza removendo +244/244/espaços para o GPO.
      const rawPhone = (phoneNumber?.trim() ? phoneNumber : customer.phone || customer.whatsappPhone) || "";
      const digits = rawPhone.replace(/\D/g, "");
      const local = digits.startsWith("244") ? digits.slice(3) : digits;
      if (!/^9\d{8}$/.test(local)) {
        throw new AppError(400, "Número de telemóvel inválido para Multicaixa Express (usa 9XXXXXXXX)");
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

        // Guarda o número Express usado (pode não ser o da conta) para
        // auditoria — merge com dueDate/referência EMIS abaixo.

        // Extrai referência EMIS da resposta (igual ao staff)
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

        // Estado síncrono da resposta GPO (igual ao staff)
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
        // O payment fica pendente e visível em /portal/pagamentos para retry.
        if (err instanceof EkwanzaError) {
          return next(new AppError(err.status || 502, `É-kwanza: ${err.message}`));
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
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /portal/pagamentos ──────────────────────────────────────────────────

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

// ─── GET /portal/recibos/:id ─────────────────────────────────────────────────
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
      throw new AppError(404, "Recibo não encontrado");
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

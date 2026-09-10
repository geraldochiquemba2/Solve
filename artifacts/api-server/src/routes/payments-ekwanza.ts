import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { paymentsTable, customersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { authenticate, authorize } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import { AppError } from "../middlewares/error";
import { ekwanzaClient, EkwanzaError } from "../lib/ekwanza";
import { logger } from "../lib/logger";

const router = Router();

const createCodeSchema = z.object({
  amount: z.number().positive("Valor deve ser positivo"),
  referenceCode: z.string().min(1, "Código de referência é obrigatório"),
  mobileNumber: z.string().min(9, "Número de telemóvel inválido"),
});

const sendSchema = z.object({
  mobileNumber: z.string().min(9, "Número de telemóvel inválido"),
  amount: z.number().positive("Valor deve ser positivo"),
  operationCode: z.string().min(1, "Código de operação é obrigatório"),
});

const kwikSchema = z.object({
  iban: z.string().min(23, "IBAN inválido"),
  amount: z.number().positive("Valor deve ser positivo"),
  operationCode: z.string().min(1, "Código de operação é obrigatório"),
});

const gpoChargeSchema = z.object({
  customerId: z.string().uuid(),
  amount: z.number().positive("Valor deve ser positivo"),
  description: z.string().optional(),
  phoneNumber: z.string().min(9, "Número de telemóvel inválido").optional(),
  entity: z.string().optional(),
  referenceCode: z.string().optional(),
});

// Create payment code (QR Code)
router.post(
  "/payments/ekwanza/create-code",
  authenticate,
  authorize("administrador", "gestor", "financeiro"),
  validate(createCodeSchema),
  async (req, res, next) => {
    try {
      const { amount, referenceCode, mobileNumber } = req.body;

      const result = await ekwanzaClient.createPaymentCode(amount, referenceCode, mobileNumber);

      logger.info({ referenceCode, amount }, "É-kwanza payment code created");

      res.status(201).json({ data: result });
    } catch (err) {
      if (err instanceof EkwanzaError) {
        return next(new AppError(err.status || 502, `É-kwanza: ${err.message}`));
      }
      next(err);
    }
  },
);

// GPO Charge (Multicaixa Express) - cria pagamento e cobraça
router.post(
  "/payments/ekwanza/charge",
  authenticate,
  authorize("administrador", "gestor", "financeiro"),
  validate(gpoChargeSchema),
  async (req, res, next) => {
    try {
      const { customerId, amount, description, phoneNumber, entity, referenceCode } = req.body;

      // Verify customer exists
      const customer = await db.query.customersTable.findFirst({
        where: eq(customersTable.id, customerId),
      });
      if (!customer) {
        throw new AppError(404, "Cliente não encontrado");
      }

      // Generate unique transaction ID
      const count = await db.$count(paymentsTable);
      const merchantTransactionId = `SC${String(81000 + count + 1).padStart(5, "0")}`;
      const code = merchantTransactionId;

      // Create payment record (pendente) - expires in 24h
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      let [payment] = await db
        .insert(paymentsTable)
        .values({
          code,
          customerId,
          amount,
          method: phoneNumber ? "mcx_express" : "referencia",
          status: "pendente",
          referenceCode: referenceCode || code,
          entity: entity || null,
          expiresAt,
        })
        .returning();

      // Strip +244 or 244 prefix for Multicaixa Express
      const cleanPhone = phoneNumber ? phoneNumber.replace(/^(\+?244)/, '') : phoneNumber;

      // Initiate GPO charge
      const result = await ekwanzaClient.createGPOCharge(
        amount,
        description || `Pagamento - ${customer.name}`,
        merchantTransactionId,
        cleanPhone,
      );

      logger.info({ code, customerId, amount, phoneNumber: cleanPhone }, "GPO charge initiated");

      // Extract reference number from É-kwanza response for reference payments
      const gpoData = result as Record<string, unknown>;
      const respStatus = (gpoData.responseStatus as Record<string, unknown>) || {};
      const refData = (respStatus.reference as Record<string, unknown>) || null;
      const ekwanzaReferenceNumber = refData?.referenceNumber as string | undefined;
      const ekwanzaDueDate = refData?.dueDate as string | undefined;
      const ekwanzaEntity = refData?.entity as string | undefined;

      // Update payment with É-kwanza reference if available
      if (ekwanzaReferenceNumber) {
        await db
          .update(paymentsTable)
          .set({
            referenceCode: ekwanzaReferenceNumber,
            ekwanzaCode: ekwanzaReferenceNumber,
            entity: ekwanzaEntity || entity || null,
            metadata: JSON.stringify({ dueDate: ekwanzaDueDate, ekwanzaReference: refData }),
          })
          .where(eq(paymentsTable.id, payment.id));
        payment = { ...payment, referenceCode: ekwanzaReferenceNumber, ekwanzaCode: ekwanzaReferenceNumber, entity: ekwanzaEntity || entity || null };
      }

      // Update status from synchronous GPO response
      const gpoStatus = respStatus.status as string | undefined;
      const gpoSuccessful = respStatus.successful as boolean | undefined;
      const gpoProviderTxId = (respStatus.gpo as Record<string, unknown>)?.providerTransactionId as string | undefined;

      if (gpoStatus === "Success" || gpoSuccessful === true) {
        await db.update(paymentsTable).set({
          status: "confirmado",
          paidAt: new Date(),
          reconciledAt: new Date(),
          ekwanzaOperationCode: gpoProviderTxId || null,
          updatedAt: new Date(),
        }).where(eq(paymentsTable.id, payment.id));
        payment = { ...payment, status: "confirmado" };
      } else if (gpoStatus === "Failed" || gpoStatus === "Cancelled" || gpoStatus === "Expired") {
        await db.update(paymentsTable).set({
          status: "rejeitado",
          ekwanzaOperationCode: gpoProviderTxId || null,
          updatedAt: new Date(),
        }).where(eq(paymentsTable.id, payment.id));
        payment = { ...payment, status: "rejeitado" };
      }

      res.status(201).json({ data: { payment, gpo: result } });
    } catch (err) {
      if (err instanceof EkwanzaError) {
        return next(new AppError(err.status || 502, `É-kwanza: ${err.message}`));
      }
      next(err);
    }
  },
);

// Send to customer wallet (eMoney)
router.post(
  "/payments/ekwanza/send",
  authenticate,
  authorize("administrador", "gestor", "financeiro"),
  validate(sendSchema),
  async (req, res, next) => {
    try {
      const { mobileNumber, amount, operationCode } = req.body;

      const result = await ekwanzaClient.sendToCustomer(mobileNumber, amount, operationCode);

      logger.info({ operationCode, mobileNumber, amount }, "É-kwanza send to customer initiated");

      res.status(201).json({ data: result });
    } catch (err) {
      if (err instanceof EkwanzaError) {
        return next(new AppError(err.status || 502, `É-kwanza: ${err.message}`));
      }
      next(err);
    }
  },
);

// Send via KWiK (IBAN transfer)
router.post(
  "/payments/ekwanza/kwik",
  authenticate,
  authorize("administrador", "gestor", "financeiro"),
  validate(kwikSchema),
  async (req, res, next) => {
    try {
      const { iban, amount, operationCode } = req.body;

      const result = await ekwanzaClient.sendKWiKToCustomer(iban, amount, operationCode);

      logger.info({ operationCode, iban, amount }, "É-kwanza KWiK transfer initiated");

      res.status(201).json({ data: result });
    } catch (err) {
      if (err instanceof EkwanzaError) {
        return next(new AppError(err.status || 502, `É-kwanza: ${err.message}`));
      }
      next(err);
    }
  },
);

// Check payment status
router.get(
  "/payments/ekwanza/status/:ticketCode",
  authenticate,
  async (req, res, next) => {
    try {
      const ticketCode = String(req.params.ticketCode);

      const result = await ekwanzaClient.getPaymentStatus(ticketCode);

      res.json({ data: result });
    } catch (err) {
      if (err instanceof EkwanzaError) {
        return next(new AppError(err.status || 502, `É-kwanza: ${err.message}`));
      }
      next(err);
    }
  },
);

// Check KWiK status
router.get(
  "/payments/ekwanza/kwik-status/:externalReferenceId",
  authenticate,
  async (req, res, next) => {
    try {
      const externalReferenceId = String(req.params.externalReferenceId);

      const result = await ekwanzaClient.getKWiKStatus(externalReferenceId);

      res.json({ data: result });
    } catch (err) {
      if (err instanceof EkwanzaError) {
        return next(new AppError(err.status || 502, `É-kwanza: ${err.message}`));
      }
      next(err);
    }
  },
);

// Check payment status from É-kwanza API
router.get(
  "/payments/ekwanza/check-status/:id",
  authenticate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const payment = await db.query.paymentsTable.findFirst({
        where: eq(paymentsTable.id, id),
      });

      if (!payment) throw new AppError(404, "Pagamento não encontrado");

      const chargeStatus = await ekwanzaClient.getChargeStatus(payment.code);

      if (!chargeStatus) {
        res.json({ paymentId: id, code: payment.code, ekwanzaStatus: "NOT_FOUND", currentStatus: payment.status });
        return;
      }

      const statusMap: Record<string, string> = {
        Success: "confirmado",
        Pending: "pendente",
        Failed: "rejeitado",
        Cancelled: "rejeitado",
        Expired: "rejeitado",
      };

      const newStatus = statusMap[chargeStatus.status] || payment.status;
      const changed = newStatus !== payment.status;

      if (changed) {
        const updateData: Record<string, any> = {
          status: newStatus,
          updatedAt: new Date(),
        };
        if (chargeStatus.status === "Success") {
          updateData.paidAt = new Date();
          updateData.reconciledAt = new Date();
        }
        await db.update(paymentsTable).set(updateData).where(eq(paymentsTable.id, id));
        logger.info({ paymentId: id, oldStatus: payment.status, newStatus, ekwanzaStatus: chargeStatus.status }, "Payment status synced from É-kwanza");
      }

      res.json({
        paymentId: id,
        code: payment.code,
        ekwanzaStatus: chargeStatus.status,
        previousStatus: payment.status,
        newStatus,
        changed,
        amount: chargeStatus.amount,
        paymentMethod: chargeStatus.paymentMethod,
        createdDate: chargeStatus.createdDate,
        updatedDate: chargeStatus.updatedDate,
        reference: chargeStatus.reference,
      });
    } catch (err) {
      next(err);
    }
  },
);

// GPO payment callback webhook
router.post(
  "/webhooks/ekwanza",
  async (req, res, next) => {
    try {
      const body = req.body;

      logger.info({ merchantTransactionId: body.merchantTransactionId }, "É-kwanza callback received");

      // Verify signature if API key is configured
      const apiKey = process.env.EKWANZA_API_KEY;
      if (apiKey && body.meta?.signature) {
        const isValid = ekwanzaClient.verifyCallback(body);
        if (!isValid) {
          logger.warn("É-kwanza callback signature verification failed");
          throw new AppError(401, "Assinatura inválida");
        }
      }

      const { merchantTransactionId, ekwanzaTransactionId, operationStatus, operationData } = body;

      // Status mapping: 1=Success, 3=Cancelled/Expired, 4=Failed, 5=Error
      const statusMap: Record<number, string> = {
        1: "confirmado",
        3: "rejeitado",
        4: "rejeitado",
        5: "rejeitado",
      };

      const mappedStatus = statusMap[operationStatus] || "pendente";

      logger.info(
        {
          merchantTransactionId,
          ekwanzaTransactionId,
          operationStatus: mappedStatus,
          amount: operationData?.amount,
        },
        "É-kwanza callback processed",
      );

      // Update payment record in database based on merchantTransactionId
      const payment = await db.query.paymentsTable.findFirst({
        where: eq(paymentsTable.code, merchantTransactionId),
      });

      if (payment) {
        const updateData: Record<string, any> = {
          status: mappedStatus as any,
          updatedAt: new Date(),
        };

        if (ekwanzaTransactionId) {
          updateData.ekwanzaOperationCode = ekwanzaTransactionId;
        }

        if (mappedStatus === "confirmado") {
          updateData.paidAt = new Date();
          updateData.reconciledAt = new Date();
        }

        await db
          .update(paymentsTable)
          .set(updateData)
          .where(eq(paymentsTable.code, merchantTransactionId));

        logger.info({ paymentId: payment.id, newStatus: mappedStatus }, "Payment updated from É-kwanza callback");
      } else {
        logger.warn({ merchantTransactionId }, "Payment not found for É-kwanza callback");
      }

      res.json({ received: true });
    } catch (err) {
      logger.error({ err }, "Error processing É-kwanza callback");
      next(err);
    }
  },
);

export default router;

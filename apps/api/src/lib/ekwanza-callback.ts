import { db } from "@workspace/db";
import { paymentsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { ekwanzaClient } from "./ekwanza";
import { logger } from "./logger";
import { AppError } from "../middlewares/error";

const STATUS_MAP: Record<number, "confirmado" | "rejeitado"> = {
  1: "confirmado",
  3: "rejeitado",
  4: "rejeitado",
  5: "rejeitado",
};

export interface CallbackOutcome {
  received: true;
  verified: boolean;
  code?: string;
  status?: string;
}

/**
 * SEGURANÇA: um callback HTTP nunca é confiável sozinho — qualquer pessoa na
 * internet pode fazer POST. Por isso este processador:
 *  1. valida o formato (400 em lixo);
 *  2. nunca cria pagamentos (só atualiza os que existem);
 *  3. só muda o estado com confirmação server-side (consulta à É-kwanza);
 *     sem confirmação, regista em metadata para revisão e mantém "pendente";
 *  4. rejeita divergência de valor (operationData.amount != BD).
 */
export async function processEkwanzaCallback(body: unknown): Promise<CallbackOutcome> {
  const b = (body ?? {}) as Record<string, any>;
  const { merchantTransactionId, ekwanzaTransactionId, operationStatus, operationData } = b;

  if (
    typeof merchantTransactionId !== "string" ||
    merchantTransactionId.length === 0 ||
    merchantTransactionId.length > 100
  ) {
    throw new AppError(400, "Callback inválido");
  }
  if (!Object.hasOwn(STATUS_MAP, operationStatus)) {
    logger.warn({ merchantTransactionId }, "É-kwanza callback com operationStatus desconhecido");
    throw new AppError(400, "Callback inválido");
  }

  const payment = await db.query.paymentsTable.findFirst({
    where: eq(paymentsTable.code, merchantTransactionId),
  });

  // Pagamento inexistente: responde ok (não enumera), não cria nada.
  if (!payment) {
    logger.warn({ merchantTransactionId }, "Callback para pagamento inexistente — ignorado");
    return { received: true, verified: false };
  }

  // Divergência de valor: não confirma, marca para revisão humana.
  if (operationData?.amount != null && Number(operationData.amount) !== Number((payment as any).amount)) {
    logger.warn(
      { merchantTransactionId, callbackAmount: operationData.amount },
      "Callback com valor divergente — a aguardar revisão",
    );
    await flagUnverified(payment.id, payment, { reason: "amount_mismatch", operationData });
    return { received: true, verified: false, code: merchantTransactionId };
  }

  // Confirmação autoritativa junto da É-kwanza (fonte da verdade).
  let authoritativeSuccess: boolean | null = null;
  try {
    const authoritative = await ekwanzaClient.getChargeStatus(merchantTransactionId);
    if (authoritative) authoritativeSuccess = authoritative.status === "Success";
  } catch (err) {
    logger.warn({ err, merchantTransactionId }, "Falha na confirmação É-kwanza — callback adiado");
  }

  if (authoritativeSuccess === null) {
    await flagUnverified(payment.id, payment, {
      reason: "no_authoritative_confirmation",
      operationStatus,
      ekwanzaTransactionId,
    });
    return { received: true, verified: false, code: merchantTransactionId };
  }

  const mappedStatus = authoritativeSuccess ? "confirmado" : STATUS_MAP[operationStatus];
  const updateData: Record<string, any> = { status: mappedStatus, updatedAt: new Date() };
  if (ekwanzaTransactionId) updateData.ekwanzaOperationCode = String(ekwanzaTransactionId);
  if (mappedStatus === "confirmado") {
    updateData.paidAt = new Date();
    updateData.reconciledAt = new Date();
  }

  await db.update(paymentsTable).set(updateData).where(eq(paymentsTable.code, merchantTransactionId));
  logger.info(
    { paymentId: payment.id, newStatus: mappedStatus },
    "Pagamento atualizado por callback É-kwanza verificado",
  );

  return { received: true, verified: true, code: merchantTransactionId, status: mappedStatus };
}

async function flagUnverified(paymentId: string, payment: any, detail: Record<string, any>) {
  const meta =
    payment.metadata && typeof payment.metadata === "object" ? payment.metadata : {};
  await db
    .update(paymentsTable)
    .set({
      metadata: { ...meta, ekwanza_unverified_callback: { ...detail, at: new Date().toISOString() } },
      updatedAt: new Date(),
    })
    .where(eq(paymentsTable.id, paymentId));
}

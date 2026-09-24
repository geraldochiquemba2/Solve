import crypto from "node:crypto";
import { db } from "@workspace/db";
import { customersTable, portalOtpsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { whatsappClient } from "./whatsapp";
import { logger } from "./logger";
import { AppError } from "../middlewares/error";

export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_LENGTH = 6;

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[\s\-().]/g, "");
  // Aceita 9XXXXXXXX (9 dígitos a começar por 9, Angola) -> +244...
  if (/^9\d{8}$/.test(digits)) return `+244${digits}`;
  // Aceita 2449XXXXXXXX sem + -> +244...
  if (/^2449\d{8}$/.test(digits)) return `+${digits}`;
  // Aceita +244... ou outros formatos internacionais já normalizados
  if (/^\+\d{9,15}$/.test(digits)) return digits;
  // Aceita só dígitos longos -> prefixa +
  if (/^\d{9,15}$/.test(digits)) return `+${digits}`;
  throw new AppError(400, "Número de telefone inválido");
}

export function generateOtp(): string {
  const n = crypto.randomInt(0, 10 ** OTP_LENGTH);
  return String(n).padStart(OTP_LENGTH, "0");
}

export function hashOtp(code: string): string {
  return crypto.createHash("sha256").update(code, "utf8").digest("hex");
}

function phoneCandidates(normalized: string): string[] {
  const out = new Set<string>([normalized]);
  // Permite match com o formato guardado sem prefixo (+2449XXXXXXXX <-> 9XXXXXXXX)
  if (normalized.startsWith("+244")) {
    out.add(normalized.slice(4)); // 9XXXXXXXX
    out.add(normalized.slice(1)); // 2449XXXXXXXX
  }
  return [...out];
}

async function findCustomerByPhone(normalized: string) {
  for (const candidate of phoneCandidates(normalized)) {
    const byPhone = await db.query.customersTable.findFirst({
      where: eq(customersTable.phone, candidate),
    });
    if (byPhone) return byPhone;
    const byWhatsapp = await db.query.customersTable.findFirst({
      where: eq(customersTable.whatsappPhone, candidate),
    });
    if (byWhatsapp) return byWhatsapp;
  }
  return undefined;
}

export type SentVia = "whatsapp" | "dev";

export async function requestOtp(rawPhone: string): Promise<{ sentVia: SentVia; devCode?: string }> {
  const phone = normalizePhone(rawPhone);
  const customer = await findCustomerByPhone(phone);

  // SEGURANÇA anti-enumeração: número desconhecido ou conta inactiva responde
  // igual a sucesso, mas NÃO cria OTP. O atacante não distingue.
  if (!customer || customer.state !== "activo") {
    logger.warn({ phone }, "OTP pedido para número desconhecido/inactivo (resposta genérica)");
    return { sentVia: "whatsapp" };
  }

  const code = generateOtp();
  await db.insert(portalOtpsTable).values({
    phone,
    codeHash: hashOtp(code),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });

  let sentVia: SentVia = "whatsapp";
  let devCode: string | undefined;

  // Sem WHATSAPP_TOKEN: em dev, loga e devolve devCode para testes manuais;
  // em produção NUNCA devolve o código (falha segura — configurar WhatsApp).
  if (!process.env.WHATSAPP_TOKEN) {
    if (process.env.NODE_ENV === "production") {
      logger.error({ phone }, "WHATSAPP_TOKEN em falta em produção — OTP não enviado");
      return { sentVia, devCode };
    }
    sentVia = "dev";
    devCode = code;
    logger.warn({ phone }, `[DEV] OTP ${code} (WhatsApp não configurado)`);
    return { sentVia, devCode };
  }

  try {
    await whatsappClient.sendText(
      phone,
      `O seu código de acesso Solve Corporate é: ${code}. Válido por 5 minutos.`,
    );
  } catch (err) {
    // Nunca falha o request por causa do WhatsApp
    logger.error({ err, phone }, "Falha ao enviar OTP via WhatsApp");
  }

  return { sentVia, devCode };
}

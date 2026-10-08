import { db } from "@workspace/db";
import { paymentsTable, customersTable, settingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { cademi } from "./cademi";
import { logger } from "./logger";

async function cfg(key: string): Promise<string> {
  const row = await db.query.settingsTable.findFirst({ where: eq(settingsTable.key, key) });
  const value = row?.value;
  if (value == null) return "";
  return typeof value === "string" ? value : String(value);
}

function slugify(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseMetadata(raw: unknown): Record<string, any> {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) || {};
    } catch {
      return {};
    }
  }
  return (raw as Record<string, any>) || {};
}

export interface DeliveryResult {
  ok: boolean;
  skipped?: string;
  email?: string;
}

/**
 * Entrega o acesso do pagamento confirmado na Cademi.
 *
 * Espelha `sendCademiDelivery` do standalone-server (produção): o produto vem da
 * metadata da compra (seletor do widget) ou da configuração `cademi_produto_id`,
 * o email/nome têm PRIORIDADE na metadata (quem pagou pode não ser o aluno) e a
 * entrega só conta como enviada quando a Cademi confirma mesmo o acesso.
 */
export async function sendCademiDelivery(paymentCode: string, force = false): Promise<DeliveryResult> {
  try {
    const [payment] = await db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.code, paymentCode))
      .limit(1);
    if (!payment) return { ok: false, skipped: "pagamento inexistente" };
    if (payment.status !== "confirmado") return { ok: false, skipped: `estado ${payment.status}` };

    const meta = parseMetadata(payment.metadata);
    if (meta.cademi_delivery === "sent" && !force) return { ok: false, skipped: "já enviado" };

    const auto = (await cfg("cademi_auto_delivery")).trim();
    const defaultProduto = (await cfg("cademi_produto_id")).trim();
    const produtoId = String(meta.cademi_produto || defaultProduto).trim();
    if (auto !== "1" || !produtoId) {
      return { ok: false, skipped: "cademi_auto_delivery/produto por configurar (Academia)" };
    }

    let nome: string | null = meta.name || null;
    let email: string | null = meta.email || null;

    if ((!email || !nome) && payment.customerId) {
      const customer = await db.query.customersTable.findFirst({
        where: eq(customersTable.id, payment.customerId),
      });
      if (customer) {
        email = email || customer.email || null;
        nome = nome || customer.name || null;
      }
    }
    if (!email) return { ok: false, skipped: "sem email (preenche no cliente e reenvia)" };

    const sent = await cademi.sendDelivery({
      codigo: payment.code,
      status: "aprovado",
      produto_id: produtoId,
      cliente_nome: nome || email,
      cliente_email: email,
    });
    if (!sent.success) return { ok: false, skipped: `Cademi: ${sent.error || "falha no envio"}` };

    meta.cademi_resp = JSON.stringify(sent.data ?? sent).slice(0, 500);

    // Verificação: a API pode responder sucesso sem criar acesso (slug errado,
    // regra de entrega inativa) — só "sent" com acesso mesmo existente.
    let verified = false;
    let acessosCount = 0;
    try {
      const users = await cademi.getUsers();
      const found = (users.data?.usuario ?? []).find(
        (u) => String(u.email ?? "").toLowerCase() === String(email).toLowerCase(),
      );
      if (found?.id) {
        const access = await cademi.getUserAccess(String(found.id));
        const acessos = access.data?.acesso ?? [];
        acessosCount = acessos.length;
        verified = acessos.some((ac) => {
          if (ac.encerrado) return false;
          return slugify(ac.produto?.nome) === produtoId || String(ac.produto?.id ?? "") === produtoId;
        });
      }
    } catch (err) {
      logger.error({ err, code: payment.code }, "Cademi: falha a verificar acesso");
    }

    meta.cademi_verified = verified;
    meta.cademi_acessos = acessosCount;
    meta.cademi_checked_at = new Date().toISOString();
    meta.cademi_delivery_at = new Date().toISOString();
    meta.cademi_delivery = verified ? "sent" : "sent_unverified";

    await db
      .update(paymentsTable)
      .set({ metadata: meta, updatedAt: new Date() })
      .where(eq(paymentsTable.id, payment.id));

    logger.info({ code: payment.code, produtoId, verified, acessosCount }, "Cademi: entrega processada");
    if (!verified) {
      return { ok: false, skipped: "entrega aceite pela Cademi mas acesso não confirmado" };
    }
    return { ok: true, email };
  } catch (err) {
    logger.error({ err, paymentCode }, "Cademi: entrega falhou");
    return { ok: false, skipped: (err as Error).message };
  }
}

/** Dispara a entrega sem bloquear a resposta (falhas ficam no log/metadata). */
export function deliverInBackground(paymentCode: string, force = false): void {
  void sendCademiDelivery(paymentCode, force).then((r) => {
    if (!r.ok) logger.info({ code: paymentCode, skipped: r.skipped }, "Cademi: entrega não concluída");
  });
}

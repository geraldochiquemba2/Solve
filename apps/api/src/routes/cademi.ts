import { Router } from "express";
import { db } from "@workspace/db";
import { customersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { authenticate, authorize } from "../middlewares/auth";
import { AppError } from "../middlewares/error";
import { logger } from "../lib/logger";
import { cademi } from "../lib/cademi";

const router = Router();

router.get("/cademi/health", authenticate, async (req, res) => {
  try {
    const configured = await cademi.isConfigured();
    if (!configured) {
      res.json({ data: { status: "not_configured", message: "Cademi não configurado. Configure CADEMI_API_URL e CADEMI_API_KEY no .env" } });
      return;
    }
    const result = await cademi.healthCheck();
    res.json({ data: { status: result.connected ? "operacional" : "unreachable", message: result.message } });
  } catch (err: any) {
    res.json({ data: { status: "error", message: err.message || "Erro ao verificar Cademi" } });
  }
});

router.get("/cademi/users", authenticate, async (req, res, next) => {
  try {
    const configured = await cademi.isConfigured();
    if (!configured) {
      res.json({ data: [], total: 0, message: "Cademi não configurado" });
      return;
    }
    const result = await cademi.getUsers();
    if (!result.success) {
      res.json({ data: [], total: 0, message: result.error || "Erro ao buscar utilizadores Cademi" });
      return;
    }
    const users = result.data?.usuario || [];
    res.json({ data: users, total: users.length });
  } catch (err) {
    next(err);
  }
});

router.get("/cademi/users/:identifier", authenticate, async (req, res, next) => {
  try {
    const configured = await cademi.isConfigured();
    if (!configured) {
      res.status(400).json({ error: "Cademi não configurado" });
      return;
    }
    const result = await cademi.getUser(req.params.identifier as string);
    if (!result.success) {
      res.status(404).json({ error: result.error || "Utilizador não encontrado" });
      return;
    }
    res.json({ data: result.data?.usuario });
  } catch (err) {
    next(err);
  }
});

router.get("/cademi/users/:identifier/access", authenticate, async (req, res, next) => {
  try {
    const configured = await cademi.isConfigured();
    if (!configured) {
      res.status(400).json({ error: "Cademi não configurado" });
      return;
    }
    const result = await cademi.getUserAccess(req.params.identifier as string);
    if (!result.success) {
      res.status(404).json({ error: result.error || "Erro ao buscar acessos" });
      return;
    }
    res.json({ data: result.data });
  } catch (err) {
    next(err);
  }
});

router.get("/cademi/products", authenticate, async (req, res, next) => {
  try {
    const configured = await cademi.isConfigured();
    if (!configured) {
      res.json({ data: [], total: 0, message: "Cademi não configurado" });
      return;
    }
    const result = await cademi.getProducts();
    if (!result.success) {
      res.json({ data: [], total: 0, message: result.error || "Erro ao buscar produtos" });
      return;
    }
    const products = result.data?.produto || [];
    res.json({ data: products, total: products.length });
  } catch (err) {
    next(err);
  }
});

router.post("/cademi/sync", authenticate, authorize("administrador", "gestor", "operacional"), async (req, res, next) => {
  try {
    const configured = await cademi.isConfigured();
    if (!configured) {
      res.json({ data: { created: 0, updated: 0, errors: ["Cademi não configurado"] }, message: "Configure CADEMI_API_URL e CADEMI_API_KEY no .env" });
      return;
    }

    const usersResult = await cademi.getUsers();
    if (!usersResult.success) {
      res.json({ data: { created: 0, updated: 0, errors: [usersResult.error || "Erro ao buscar utilizadores"] }, message: "Erro ao sincronizar" });
      return;
    }

    const users = usersResult.data?.usuario || [];
    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const user of users) {
      try {
        const email = user.email;
        if (!email) continue;

        const existing = await db.query.customersTable.findFirst({
          where: eq(customersTable.email, email),
        });

        if (existing) {
          await db.update(customersTable).set({
            name: user.nome,
            phone: user.celular || undefined,
            cademiId: String(user.id),
            updatedAt: new Date(),
          }).where(eq(customersTable.email, email));
          updated++;
        } else {
          const count = await db.$count(customersTable);
          const code = `CL-${String(842 + count + 1).padStart(5, "0")}`;
          await db.insert(customersTable).values({
            code,
            name: user.nome,
            email,
            phone: user.celular || undefined,
            cademiId: String(user.id),
            state: user.ultimo_acesso_em ? "activo" : "inactivo",
          });
          created++;
        }
      } catch (err) {
        errors.push(`${user.nome}: ${(err as Error).message}`);
      }
    }

    res.json({
      data: { created, updated, errors },
      message: `Sincronização Cademi: ${created} criados, ${updated} atualizados`,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/webhooks/cademi", async (req, res, next) => {
  try {
    const eventType = req.body.event_type;
    const event = req.body.event;

    logger.info({ eventType }, "Cademi webhook recebido");

    if (event?.usuario?.email) {
      const customer = await db.query.customersTable.findFirst({
        where: eq(customersTable.email, event.usuario.email),
      });

      if (customer) {
        switch (eventType) {
          case "usuario.criado":
            await db.update(customersTable).set({ cademiId: String(event.usuario.id), updatedAt: new Date() }).where(eq(customersTable.id, customer.id));
            break;
          case "usuario.progresso":
            logger.info({ email: event.usuario.email, progresso: event.progresso }, "Cademi: Progresso atualizado");
            break;
          case "aula.concluida":
            logger.info({ email: event.usuario.email, aula: event.aula?.nome }, "Cademi: Aula concluída");
            break;
          case "prova.aprovado":
            logger.info({ email: event.usuario.email, nota: event.resultado?.nota_final }, "Cademi: Prova aprovada");
            break;
          case "certificado.emitido":
            logger.info({ email: event.usuario.email, produto: event.produto?.nome }, "Cademi: Certificado emitido");
            break;
          case "entrega.adicionada":
            logger.info({ email: event.usuario.email, entrega: event.entrega?.nome }, "Cademi: Entrega adicionada");
            break;
          default:
            logger.warn({ eventType }, "Cademi: Evento não tratado");
        }
      }
    }

    res.json({ received: true });
  } catch (err) {
    next(err);
  }
});

export default router;

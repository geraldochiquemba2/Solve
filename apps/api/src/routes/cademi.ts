import { Router } from "express";
import { db } from "@workspace/db";
import { customersTable, settingsTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
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

function slugify(s: unknown): string {
  return String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// Catálogo SamoraFit Workout: só os planos de duração, por ordem crescente de meses
// (1, 3, 6, 12) — mesma regra e mesma ordem da Academia e do widget de pagamento
// (paridade com standalone-server de produção). A Cademi escreve o nome com acento
// ("SamoraFit Workout- 1 Mês") e o slug com hífen ("samorafit-workout-1-mes"), por isso
// a duração lê-se pelo número que antecede "mes". Ficam de fora o "Time Filmes" e o
// "SamoraFit Workout" genérico de 100 Kz.
const DURACAO_WORKOUT: Array<[RegExp, number]> = [
  [/(^|\D)1(\D*)mes(es)?\b/, 1],
  [/(^|\D)3(\D*)mes(es)?\b/, 3],
  [/(^|\D)6(\D*)mes(es)?\b/, 6],
  [/(^|\D)12(\D*)mes(es)?\b/, 12],
];
function catalogoWorkout<T extends { id: string; nome?: string }>(lista: T[]): T[] {
  const duracao = (o: T) => {
    const alvo = `${o?.id ?? ""} ${o?.nome ?? ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (!/samora?fit[-\s]?workout/.test(alvo)) return -1;
    return DURACAO_WORKOUT.find(([re]) => re.test(alvo))?.[1] ?? -1;
  };
  return lista.filter((o) => duracao(o) >= 0).sort((a, b) => duracao(a) - duracao(b));
}

// Lista de entregas Cademi (paridade com standalone-server de produção):
// 1) manual em settings@cademi_entregas (traz nome bonito + preço)
// 2) slugs derivados dos produtos reais da API (/produto)
// 3) fallback para settings@cademi_produto_id ou 'samorafit-workout'
// Só saem os planos de duração, na ordem do CRM (ver catalogoWorkout).
router.get("/cademi/entregas", authenticate, async (req, res, next) => {
  try {
    const byId = new Map<string, { id: string; nome: string; preco?: number }>();
    try {
      const row = await db.query.settingsTable.findFirst({ where: eq(settingsTable.key, "cademi_entregas") });
      let manual: any = (row as any)?.value ?? [];
      if (typeof manual === "string") { try { manual = JSON.parse(manual); } catch { manual = []; } }
      (Array.isArray(manual) ? manual : []).forEach((o: any) => {
        if (o?.id) byId.set(o.id, { id: o.id, nome: o.nome || o.id, ...(o.preco ? { preco: Number(o.preco) } : {}) });
      });
    } catch {}
    try {
      const pr = await cademi.getProducts();
      const produtos: any[] = (pr.data as any)?.produto || [];
      produtos.forEach((p: any) => {
        const slug = slugify(p?.nome);
        if (slug && !byId.has(slug)) byId.set(slug, { id: slug, nome: p.nome });
      });
    } catch {}
    let list = [...byId.values()];
    if (list.length === 0) {
      let def = "samorafit-workout";
      try {
        const row = await db.query.settingsTable.findFirst({ where: eq(settingsTable.key, "cademi_produto_id") });
        let v: any = (row as any)?.value;
        if (typeof v === "string") { try { v = JSON.parse(v); } catch {} }
        if (typeof v === "string" && v.trim()) def = v.trim();
      } catch {}
      list = [{ id: def, nome: "SamoraFit Workout" }];
    }
    res.json({ data: catalogoWorkout(list) });
  } catch (err) {
    next(err);
  }
});

// Controlo de pagamentos por aluno: cruza Cademi × pagamentos do CRM.
// Devolve por email: total pago, nº pagos/pendentes e último pagamento.
// (paridade com standalone-server de produção)
router.get("/cademi/alunos-cobranca", authenticate, async (req, res, next) => {
  try {
    const configured = await cademi.isConfigured();
    if (!configured) {
      res.json({ data: [], total: 0, message: "Cademi não configurado" });
      return;
    }
    const r = await cademi.getUsers();
    if (!r.success) {
      res.status(502).json({ error: r.error });
      return;
    }
    const users = r.data?.usuario || [];
    const agg = await db.execute(sql`
      SELECT LOWER(COALESCE(p.metadata->>'email','')) AS email,
        COUNT(*) FILTER (WHERE p.status = 'confirmado') AS pagos,
        COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'confirmado'), 0) AS total_pago,
        COUNT(*) FILTER (WHERE p.status = 'pendente') AS pendentes
      FROM payments p
      WHERE COALESCE(p.metadata->>'email','') <> ''
      GROUP BY 1`);
    const last = await db.execute(sql`
      SELECT DISTINCT ON (LOWER(COALESCE(p.metadata->>'email',''))) LOWER(COALESCE(p.metadata->>'email','')) AS email,
        p.status AS ultimo_status, p.amount AS ultimo_valor, p.created_at AS ultima_data, p.code AS ultimo_code
      FROM payments p
      WHERE COALESCE(p.metadata->>'email','') <> ''
      ORDER BY 1, p.created_at DESC`);
    const byEmail: Record<string, any> = {};
    for (const a of agg.rows as any[]) {
      byEmail[a.email] = { pagos: Number(a.pagos), total_pago: Number(a.total_pago), pendentes: Number(a.pendentes) };
    }
    for (const l of last.rows as any[]) {
      (byEmail[l.email] = byEmail[l.email] || { pagos: 0, total_pago: 0, pendentes: 0 }).ultimo =
        { status: l.ultimo_status, valor: Number(l.ultimo_valor), data: l.ultima_data, code: l.ultimo_code };
    }
    const data = users.map((u: any) => {
      const em = String(u.email || "").toLowerCase();
      const c = byEmail[em] || { pagos: 0, total_pago: 0, pendentes: 0 };
      const estado = c.pendentes > 0 ? "pendente" : (c.pagos > 0 ? "em_dia" : "sem_registo");
      return { cademi_id: u.id, nome: u.nome, email: u.email, celular: u.celular || null, ...c, estado };
    });
    res.json({ data, total: data.length });
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

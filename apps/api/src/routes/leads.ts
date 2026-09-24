import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { leadsTable, leadContactsTable, usersTable, customersTable } from "@workspace/db/schema";
import { eq, like, or, desc, and, sql } from "drizzle-orm";
import { authenticate, authorize } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import { AppError } from "../middlewares/error";

const router = Router();

const LEAD_STATUS = ["novo_lead", "contacto", "qualificado", "proposta", "negociacao", "convertido", "perdido"] as const;
// Selects fixos — funcionário seleciona, não digita (paridade standalone-server + App.tsx)
export const LEAD_CANAIS = ["WhatsApp", "Telefone", "SMS", "Presencial", "E-mail"] as const;
export const LEAD_RESULTADOS = ["Não respondeu", "Interessado", "Pediu mais informações", "Pediu para contactar depois", "Não tem interesse", "Converteu", "Número inválido"] as const;
export const LEAD_PASSOS = ["Contactar amanhã", "Contactar em 3 dias", "Contactar em 7 dias", "Sem próximo contacto", "Agendar visita"] as const;

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve ser YYYY-MM-DD");

const leadSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  source: z.string().optional(),
  status: z.enum(LEAD_STATUS).default("novo_lead"),
  ownerId: z.string().uuid().nullish(),
  estimatedValue: z.number().int().optional(),
  notes: z.string().optional(),
  ovgId: z.string().optional(),
  externalId: z.string().optional(),
  whatsapp: z.string().max(50).nullish(),
  produtoInteresse: z.string().max(255).nullish(),
  proximoContato: dateStr.nullish(),
  motivoPerda: z.string().max(255).nullish(),
});

const leadUpdateSchema = leadSchema.partial();

const contactSchema = z.object({
  canal: z.enum(LEAD_CANAIS),
  resultado: z.enum(LEAD_RESULTADOS),
  proximo_passo: z.enum(LEAD_PASSOS).nullish(),
  proximoPasso: z.enum(LEAD_PASSOS).nullish(),
  proximo_contato: dateStr.nullish(),
  proximoContato: dateStr.nullish(),
  observacao: z.string().nullish(),
});

function passoParaData(passo?: string | null): string | null {
  const d = new Date();
  if (passo === "Contactar amanhã") d.setDate(d.getDate() + 1);
  else if (passo === "Contactar em 3 dias") d.setDate(d.getDate() + 3);
  else if (passo === "Contactar em 7 dias") d.setDate(d.getDate() + 7);
  else return null;
  return d.toISOString().slice(0, 10);
}

async function withStats(lead: any) {
  try {
    const contactos: any[] = await db.select().from(leadContactsTable).where(eq(leadContactsTable.leadId, lead.id)).orderBy(desc(leadContactsTable.createdAt));
    const ultimo = contactos[0];
    let ultimoStaff: string | null = ultimo?.staffName ?? null;
    if (ultimo?.staffId) {
      try {
        const u = await db.query.usersTable.findFirst({ where: eq(usersTable.id, ultimo.staffId) });
        if (u) ultimoStaff = u.name;
      } catch { /* ignora em mocks */ }
    }
    return {
      ...lead,
      contactosTotal: contactos.length,
      ultimoContactoAt: ultimo?.createdAt ?? null,
      ultimoResultado: ultimo?.resultado ?? null,
      ultimoStaff,
    };
  } catch {
    return { ...lead, contactosTotal: 0, ultimoContactoAt: null, ultimoResultado: null, ultimoStaff: null };
  }
}

// List all leads with filters — enriquecida com contactosTotal + último contacto (quem/quando/resultado)
router.get("/leads", authenticate, async (req, res, next) => {
  try {
    const { search, status, source, owner } = req.query;

    const conditions = [];

    if (search && typeof search === "string") {
      const pattern = `%${search}%`;
      conditions.push(
        or(
          like(leadsTable.name, pattern),
          like(leadsTable.email, pattern),
          like(leadsTable.company, pattern),
          like(leadsTable.phone, pattern),
          like(leadsTable.whatsapp, pattern)
        )
      );
    }

    if (status && typeof status === "string" && status !== "Todos") {
      conditions.push(eq(leadsTable.status, status as any));
    }

    if (source && typeof source === "string" && source !== "Todas") {
      conditions.push(eq(leadsTable.source, source));
    }

    if (owner && typeof owner === "string") {
      conditions.push(eq(leadsTable.owner_id, owner));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const leads = await db
      .select()
      .from(leadsTable)
      .where(where)
      .orderBy(desc(leadsTable.createdAt))
      .limit(500);

    const enriched = await Promise.all(leads.map(withStats));
    res.json({ data: enriched, total: enriched.length });
  } catch (err) {
    next(err);
  }
});

// ─── KPIs organizados: total, contactadas (com %), pendentes, convertidas, perdidas ───
// IMPORTANTE: antes de /:id para não colidir
router.get("/leads/resumo", authenticate, async (req, res, next) => {
  try {
    const total = await db.$count(leadsTable);
    const countBy = async (cond: any) => {
      const rows = await db.select().from(leadsTable).where(cond);
      return rows.length;
    };
    const novas = await countBy(eq(leadsTable.status, "novo_lead"));
    const convertidas = await countBy(eq(leadsTable.status, "convertido"));
    const perdidas = await countBy(eq(leadsTable.status, "perdido"));
    const emAcompanhamento = await countBy(eq(leadsTable.status, "qualificado"));
    // contactadas = têm ≥1 registo em lead_contacts; pendentes = nunca contactadas
    const contactadasRows = await db.select({ leadId: leadContactsTable.leadId }).from(leadContactsTable).groupBy(leadContactsTable.leadId);
    const contactadas = contactadasRows.length;
    const pendentes = Math.max(total - contactadas, 0);
    res.json({ data: { total, novas, contactadas, pendentes, emAcompanhamento, convertidas, perdidas } });
  } catch (err) {
    next(err);
  }
});

// ─── Follow-ups de hoje: proximo_contato = hoje e status <> convertido ───
router.get("/leads/followups/hoje", authenticate, async (req, res, next) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const rows = await db.select().from(leadsTable).where(and(eq(leadsTable.proximoContato, today as any)));
    const filtered = rows.filter((l: any) => l.status !== "convertido");
    const enriched = await Promise.all(filtered.map(withStats));
    res.json({ data: enriched, total: enriched.length });
  } catch (err) {
    next(err);
  }
});

// ─── Histórico: quem contactou, quando, canal, resultado ───
router.get("/leads/:id/contacts", authenticate, async (req, res, next) => {
  try {
    const lead = await db.query.leadsTable.findFirst({ where: eq(leadsTable.id, req.params.id as string) });
    if (!lead) throw new AppError(404, "Lead não encontrado");
    const contactos = await db.select().from(leadContactsTable).where(eq(leadContactsTable.leadId, req.params.id as string)).orderBy(leadContactsTable.createdAt);
    const data: any[] = [];
    for (const c of contactos) {
      let staffNome: string | null = (c as any).staffName ?? null;
      if ((c as any).staffId) {
        const u = await db.query.usersTable.findFirst({ where: eq(usersTable.id, (c as any).staffId) });
        if (u) staffNome = u.name;
      }
      data.push({
        id: (c as any).id, canal: (c as any).canal, resultado: (c as any).resultado,
        proximo_passo: (c as any).proximoPasso, proximo_contato: (c as any).proximoContato,
        observacao: (c as any).observacao, created_at: (c as any).createdAt, staff_nome: staffNome,
      });
    }
    res.json({ data, total: data.length });
  } catch (err) {
    next(err);
  }
});

// Registar contacto — funcionário seleciona canal/resultado/passo (sem digitar); staff = JWT auto
router.post("/leads/:id/contacts", authenticate, authorize("administrador", "gestor", "comercial"), validate(contactSchema), async (req, res, next) => {
  try {
    const lead = await db.query.leadsTable.findFirst({ where: eq(leadsTable.id, req.params.id as string) });
    if (!lead) throw new AppError(404, "Lead não encontrado");
    const passo = req.body.proximo_passo ?? req.body.proximoPasso ?? null;
    let proxData: string | null = (req.body.proximo_contato ?? req.body.proximoContato ?? null) as any;
    if (!proxData && passo && passo !== "Sem próximo contacto" && passo !== "Agendar visita") proxData = passoParaData(passo);
    if (passo === "Agendar visita" && !proxData) throw new AppError(400, "Agendar visita precisa de data");
    if (passo === "Sem próximo contacto") proxData = null;

    let staffId: string | null = null;
    let staffName: string | null = null;
    const uid = (req.user as any)?.userId;
    if (uid && uid !== "api-key") {
      const u = await db.query.usersTable.findFirst({ where: eq(usersTable.id, uid) });
      if (u) { staffId = u.id; staffName = u.name; }
    }

    const [c] = await db.insert(leadContactsTable).values({
      leadId: req.params.id as string, staffId, staffName,
      canal: req.body.canal, resultado: req.body.resultado,
      proximoPasso: passo, proximoContato: proxData as any, observacao: req.body.observacao ?? null,
    } as any).returning();

    const update: any = { proximoContato: proxData, updatedAt: new Date() };
    if (req.body.resultado === "Converteu" && (lead as any).status !== "convertido") {
      update.status = "convertido";
      update.convertedAt = new Date();
    }
    const [leadUpd] = await db.update(leadsTable).set(update).where(eq(leadsTable.id, req.params.id as string)).returning();
    res.status(201).json({ data: c, lead: await withStats(leadUpd) });
  } catch (err) {
    next(err);
  }
});

// Get lead by ID (enriquecido)
router.get("/leads/:id", authenticate, async (req, res, next) => {
  try {
    const lead = await db.query.leadsTable.findFirst({
      where: eq(leadsTable.id, req.params.id as string),
    });

    if (!lead) {
      throw new AppError(404, "Lead não encontrado");
    }

    res.json({ data: await withStats(lead) });
  } catch (err) {
    next(err);
  }
});

// Create lead
router.post("/leads", authenticate, authorize("administrador", "gestor", "comercial"), validate(leadSchema), async (req, res, next) => {
  try {
    // Idempotência: integrações externas (ex.: Supabase/Fit 90) reenviam o mesmo external_id.
    const externalId = req.body.externalId ? String(req.body.externalId).trim() : undefined;
    if (externalId) {
      const existing = await db.query.leadsTable.findFirst({
        where: eq(leadsTable.externalId, externalId),
      });
      if (existing) {
        const updateData: Record<string, unknown> = { updatedAt: new Date() };
        for (const field of ["name", "email", "phone", "company", "source", "estimatedValue", "notes"] as const) {
          if (req.body[field] !== undefined) updateData[field] = req.body[field];
        }
        const [lead] = await db
          .update(leadsTable)
          .set(updateData)
          .where(eq(leadsTable.id, existing.id))
          .returning();
        res.json({ data: lead });
        return;
      }
    }

    const count = await db.$count(leadsTable);
    const code = `LED-${String(1000 + count + 1).padStart(4, "0")}`;

    const [lead] = await db
      .insert(leadsTable)
      .values({
        name: req.body.name,
        email: req.body.email ?? null,
        phone: req.body.phone ?? null,
        company: req.body.company ?? null,
        source: req.body.source ?? null,
        status: req.body.status ?? "novo_lead",
        owner_id: req.body.ownerId ?? null,
        estimatedValue: req.body.estimatedValue ?? 0,
        notes: req.body.notes ?? null,
        ovgId: req.body.ovgId ?? null,
        externalId,
        whatsapp: req.body.whatsapp ?? null,
        produtoInteresse: req.body.produtoInteresse ?? null,
        proximoContato: req.body.proximoContato ?? null,
        motivoPerda: req.body.motivoPerda ?? null,
        code,
      } as any)
      .returning();

    res.status(201).json({ data: await withStats(lead) });
  } catch (err) {
    next(err);
  }
});

// Update lead
router.patch("/leads/:id", authenticate, authorize("administrador", "gestor", "comercial"), validate(leadUpdateSchema), async (req, res, next) => {
  try {
    const existing = await db.query.leadsTable.findFirst({
      where: eq(leadsTable.id, req.params.id as string),
    });

    if (!existing) {
      throw new AppError(404, "Lead não encontrado");
    }

    // Motivo obrigatório ao marcar perdida — evita perder rasto sem explicação
    const nextStatus = req.body.status ?? (existing as any).status;
    if (nextStatus === "perdido" && !req.body.motivoPerda && !(existing as any).motivoPerda) {
      throw new AppError(400, "Motivo da perda é obrigatório (selecione o motivo)");
    }
    const patch: any = { updatedAt: new Date() };
    for (const [k, v] of Object.entries(req.body as any)) {
      if (v === undefined) continue;
      if (k === "ownerId") patch.owner_id = v;
      else patch[k] = v;
    }

    const [lead] = await db
      .update(leadsTable)
      .set(patch)
      .where(eq(leadsTable.id, req.params.id as string))
      .returning();

    res.json({ data: await withStats(lead) });
  } catch (err) {
    next(err);
  }
});

// Leads NUNCA desaparecem: DELETE físico removido.
// Para tirar do funil use PATCH status=perdido + motivoPerda (reutilizável noutra campanha/produto).
router.delete("/leads/:id", authenticate, authorize("administrador", "gestor"), async (_req, res) => {
  res.status(410).json({
    error: "Leads não podem ser apagadas — marque como Perdida com motivo para reutilizar noutra campanha/produto.",
  });
});

// Convert lead to customer
router.post("/leads/:id/convert", authenticate, authorize("administrador", "gestor", "comercial"), async (req, res, next) => {
  try {
    const lead = await db.query.leadsTable.findFirst({
      where: eq(leadsTable.id, req.params.id as string),
    });

    if (!lead) {
      throw new AppError(404, "Lead não encontrado");
    }

    if (lead.status === "convertido") {
      throw new AppError(400, "Lead já foi convertido");
    }

    // Generate customer code
    const customerCount = await db.$count(customersTable);
    const customerCode = `CLI-${String(2000 + customerCount + 1).padStart(4, "0")}`;

    // Create customer from lead data (preserva WhatsApp/telefone para nunca perder contacto)
    const [customer] = await db
      .insert(customersTable)
      .values({
        code: customerCode,
        name: (lead as any).name,
        email: (lead as any).email,
        phone: (lead as any).phone,
        company: (lead as any).company,
        nif: null,
        state: "activo",
        ovgId: (lead as any).ovgId,
        whatsappPhone: (lead as any).whatsapp ?? (lead as any).phone ?? null,
        leadId: (lead as any).id,
      })
      .returning();

    // Update lead status to "convertido"
    await db
      .update(leadsTable)
      .set({
        status: "convertido",
        convertedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(leadsTable.id, lead.id));

    res.json({
      message: "Lead convertido com sucesso",
      data: { lead: { ...lead, status: "convertido" }, customer },
    });
  } catch (err) {
    next(err);
  }
});

export default router;

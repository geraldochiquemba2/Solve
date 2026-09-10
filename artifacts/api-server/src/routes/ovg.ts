import { Router } from "express";
import { db } from "@workspace/db";
import { customersTable, integrationsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { authenticate, authorize } from "../middlewares/auth";
import { ovgClient, type OVGMember } from "../lib/ovg";
import { logger } from "../lib/logger";
import { syncOVGMembers, getSyncStatus } from "../lib/ovg-sync";

const router = Router();

interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

async function syncSingleMember(member: OVGMember): Promise<"created" | "updated" | "skipped" | "error"> {
  try {
    const ovgId = String(member.customer_number);
    const existing = await db.query.customersTable.findFirst({
      where: eq(customersTable.ovgId, ovgId),
    });

    if (existing) {
      await db
        .update(customersTable)
        .set({
          name: member.name,
          email: member.email,
          phone: member.mobile_number,
          nif: member.nif,
          birthDate: member.birth_date ? new Date(member.birth_date) : undefined,
          state: member.status?.toLowerCase().includes("ativo") ? "activo" : "inactivo",
          updatedAt: new Date(),
        })
        .where(eq(customersTable.ovgId, ovgId));
      return "updated";
    }

    const count = await db.$count(customersTable);
    const code = `CL-${String(842 + count + 1).padStart(5, "0")}`;

    await db.insert(customersTable).values({
      code,
      name: member.name,
      email: member.email,
      phone: member.mobile_number,
      nif: member.nif,
      birthDate: member.birth_date ? new Date(member.birth_date) : undefined,
      ovgId,
      state: member.status?.toLowerCase().includes("ativo") ? "activo" : "inactivo",
    });

    return "created";
  } catch (err) {
    logger.error({ err, member: member.name }, "OVG: Erro ao sincronizar membro");
    return "error";
  }
}

router.get("/ovg/health", authenticate, async (req, res) => {
  try {
    const configured = !!(process.env.OVG_API_URL && process.env.OVG_USERNAME && process.env.OVG_PASSWORD);
    if (!configured) {
      res.json({ data: { status: "not_configured", message: "OVG não configurado. Configure OVG_API_URL, OVG_USERNAME, OVG_PASSWORD no .env" } });
      return;
    }
    const health = await ovgClient.checkHealth();
    res.json({ data: health });
  } catch (err: any) {
    res.json({ data: { status: "unreachable", message: err.message || "API OVG inacessível" } });
  }
});

router.get("/ovg/members", authenticate, async (req, res) => {
  try {
    const configured = !!(process.env.OVG_API_URL && process.env.OVG_USERNAME && process.env.OVG_PASSWORD);
    if (!configured) {
      res.json({ data: [], total: 0, message: "OVG não configurado" });
      return;
    }
    const result = await ovgClient.getMembers();
    if (!result.success) {
      res.json({ data: [], total: 0, message: result.error || "Erro ao buscar membros OVG" });
      return;
    }
    const members = Array.isArray(result.data) ? result.data : [];
    res.json({ data: members, total: members.length });
  } catch (err: any) {
    res.json({ data: [], total: 0, message: err.message || "API OVG inacessível" });
  }
});

router.post("/ovg/sync", authenticate, authorize("administrador", "gestor", "operacional"), async (req, res, next) => {
  try {
    const configured = !!(process.env.OVG_API_URL && process.env.OVG_USERNAME && process.env.OVG_PASSWORD);
    if (!configured) {
      res.json({ data: { created: 0, updated: 0, skipped: 0, errors: ["OVG não configurado"] }, message: "Configure OVG_API_URL, OVG_USERNAME, OVG_PASSWORD no .env" });
      return;
    }

    const result: SyncResult = { created: 0, updated: 0, skipped: 0, errors: [] };

    const membersResponse = await ovgClient.getMembers();
    const members = membersResponse.success && Array.isArray(membersResponse.data) ? membersResponse.data : [];

    if (!membersResponse.success) {
      result.errors.push(membersResponse.error || "Erro ao buscar membros");
    }

    for (const member of members) {
      const status = await syncSingleMember(member);
      if (status === "created") result.created++;
      else if (status === "updated") result.updated++;
      else if (status === "skipped") result.skipped++;
      else result.errors.push(`Membro ${member.name}: Erro na sincronização`);
    }

    const integration = await db.query.integrationsTable.findFirst({
      where: eq(integrationsTable.name, "ovg"),
    });

    if (integration) {
      await db
        .update(integrationsTable)
        .set({
          lastSyncAt: new Date(),
          errorCount: result.errors.length,
          status: result.errors.length > 0 ? "atencao" : "operacional",
          updatedAt: new Date(),
        })
        .where(eq(integrationsTable.name, "ovg"));
    } else {
      await db.insert(integrationsTable).values({
        name: "ovg",
        status: result.errors.length > 0 ? "atencao" : "operacional",
        lastSyncAt: new Date(),
        errorCount: result.errors.length,
        config: { clubCode: process.env.OVG_CLUB_CODE || "LUA" },
      });
    }

    res.json({
      data: result,
      message: `Sincronização concluída: ${result.created} criados, ${result.updated} atualizados, ${result.skipped} ignorados`,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/ovg/sync/member/:id", authenticate, authorize("administrador", "gestor", "operacional"), async (req, res, next) => {
  try {
    const customerNumber = String(req.params.id);
    const response = await ovgClient.getMember(customerNumber);
    if (!response.success || !response.data) {
      res.status(404).json({ error: "Membro não encontrado no OVG" });
      return;
    }

    const status = await syncSingleMember(response.data);

    res.json({
      data: { status, member: response.data },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/ovg/sync/status", authenticate, async (req, res) => {
  try {
    const syncStatus = getSyncStatus();
    res.json({ data: syncStatus });
  } catch (err: any) {
    res.json({ data: { isSyncing: false, lastSync: null, nextSyncIn: 0, error: err.message } });
  }
});

router.post("/ovg/sync/now", authenticate, authorize("administrador", "gestor", "operacional"), async (req, res, next) => {
  try {
    const result = await syncOVGMembers();
    res.json({ data: result, message: `Sincronização concluída: ${result.created} criados, ${result.updated} actualizados` });
  } catch (err) {
    next(err);
  }
});

router.post("/customers/import-dates", authenticate, authorize("administrador", "gestor"), async (req, res) => {
  try {
    const { rows } = req.body as { rows: Array<{ code?: string; ovg_id?: string; name?: string; joined_at?: string }> };
    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ error: "Array 'rows' vazio ou inválido" });
      return;
    }

    let updated = 0;
    let notFound = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        const date = row.joined_at ? new Date(row.joined_at) : null;
        if (!date || isNaN(date.getTime())) {
          errors.push(`Data inválida para ${row.code || row.name || row.ovg_id}: "${row.joined_at}"`);
          continue;
        }

        let customer = null;
        if (row.code) {
          customer = await db.query.customersTable.findFirst({ where: eq(customersTable.code, row.code) });
        }
        if (!customer && row.ovg_id) {
          customer = await db.query.customersTable.findFirst({ where: eq(customersTable.ovgId, row.ovg_id) });
        }
        if (!customer && row.name) {
          const allCustomers = await db.query.customersTable.findMany();
          customer = allCustomers.find(c => c.name.toLowerCase() === row.name!.toLowerCase()) || null;
        }

        if (!customer) {
          notFound++;
          continue;
        }

        await db.update(customersTable).set({ joinedAt: date, updatedAt: new Date() }).where(eq(customersTable.id, customer.id));
        updated++;
      } catch (err: any) {
        errors.push(`${row.code || row.name}: ${err.message}`);
      }
    }

    res.json({
      data: { updated, notFound, errors: errors.slice(0, 20), total: rows.length },
      message: `${updated} clientes actualizados, ${notFound} não encontrados`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Erro na importação" });
  }
});

export default router;

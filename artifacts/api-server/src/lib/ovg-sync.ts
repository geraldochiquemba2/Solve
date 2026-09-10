import { db } from "@workspace/db";
import { customersTable, integrationsTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { ovgClient, type OVGMember } from "./ovg";
import { logger } from "./logger";

const SYNC_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
let syncTimer: ReturnType<typeof setInterval> | null = null;
let isSyncing = false;

interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  timestamp: Date;
}

let lastSyncResult: SyncResult | null = null;

async function syncSingleMember(member: OVGMember): Promise<"created" | "updated" | "skipped" | "error"> {
  try {
    const ovgId = String(member.customer_number);
    const existing = await db.query.customersTable.findFirst({
      where: eq(customersTable.ovgId, ovgId),
    });

    const entryDate = member.entry_date && member.entry_date !== "0000-00-00" ? new Date(member.entry_date) : undefined;
    const lastEntry = member.last_entry && member.last_entry !== "0000-00-00 00:00:00" ? new Date(member.last_entry) : undefined;
    const joinedDate = entryDate || lastEntry;

    if (existing) {
      await db
        .update(customersTable)
        .set({
          name: member.name,
          email: member.email,
          phone: member.mobile_number,
          nif: member.nif,
          gender: member.sex || existing.gender,
          birthDate: member.birth_date ? new Date(member.birth_date) : undefined,
          state: member.status?.toLowerCase().includes("ativo") ? "activo" : "inactivo",
          joinedAt: joinedDate || existing.joinedAt || existing.createdAt,
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
      gender: member.sex || null,
      birthDate: member.birth_date ? new Date(member.birth_date) : undefined,
      ovgId,
      state: member.status?.toLowerCase().includes("ativo") ? "activo" : "inactivo",
      joinedAt: joinedDate,
      createdAt: new Date(),
    }).onConflictDoUpdate({
      target: customersTable.code,
      set: {
        name: member.name,
        email: member.email,
        phone: member.mobile_number,
        nif: member.nif,
        gender: member.sex || sql`excluded.gender`,
        birthDate: member.birth_date ? new Date(member.birth_date) : undefined,
        ovgId,
        state: member.status?.toLowerCase().includes("ativo") ? "activo" : "inactivo",
        joinedAt: joinedDate || sql`excluded.joined_at`,
        updatedAt: new Date(),
      },
    });

    return "created";
  } catch (err) {
    logger.error({ err, member: member.name }, "OVG Sync: Erro ao sincronizar membro");
    return "error";
  }
}

export async function syncOVGMembers(): Promise<SyncResult> {
  if (isSyncing) {
    logger.warn("OVG Sync: Sincronização já em curso");
    return lastSyncResult || { created: 0, updated: 0, skipped: 0, errors: ["Sincronização já em curso"], timestamp: new Date() };
  }

  isSyncing = true;
  const result: SyncResult = { created: 0, updated: 0, skipped: 0, errors: [], timestamp: new Date() };

  try {
    logger.info("OVG Sync: Iniciando sincronização automática...");

    const membersResponse = await ovgClient.getMembers();
    const members = membersResponse.success && Array.isArray(membersResponse.data) ? membersResponse.data : [];

    if (!membersResponse.success) {
      result.errors.push(membersResponse.error || "Erro ao buscar membros");
      logger.error({ error: membersResponse.error }, "OVG Sync: Erro ao buscar membros");
      return result;
    }

    logger.info({ count: members.length }, "OVG Sync: Membros obtidos do OVG");

    for (const member of members) {
      const status = await syncSingleMember(member);
      if (status === "created") result.created++;
      else if (status === "updated") result.updated++;
      else if (status === "skipped") result.skipped++;
      else result.errors.push(`Membro ${member.name}: Erro na sincronização`);
    }

    // Update integration status
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

    lastSyncResult = result;
    logger.info({ created: result.created, updated: result.updated, errors: result.errors.length }, "OVG Sync: Sincronização concluída");
  } catch (err) {
    logger.error({ err }, "OVG Sync: Erro na sincronização");
    result.errors.push((err as Error).message);
  } finally {
    isSyncing = false;
  }

  return result;
}

export function startBackgroundSync(): void {
  if (syncTimer) {
    logger.warn("OVG Sync: Sincronização em segundo plano já está a correr");
    return;
  }

  logger.info({ intervalMs: SYNC_INTERVAL_MS }, "OVG Sync: Iniciando sincronização em segundo plano");

  // Run initial sync after 10 seconds
  setTimeout(() => {
    syncOVGMembers().catch((err) => {
      logger.error({ err }, "OVG Sync: Erro na sincronização inicial");
    });
  }, 10 * 1000);

  // Then run every 5 minutes
  syncTimer = setInterval(() => {
    syncOVGMembers().catch((err) => {
      logger.error({ err }, "OVG Sync: Erro na sincronização periódica");
    });
  }, SYNC_INTERVAL_MS);
}

export function stopBackgroundSync(): void {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
    logger.info("OVG Sync: Sincronização em segundo plano parada");
  }
}

export function getSyncStatus(): { isSyncing: boolean; lastSync: SyncResult | null; nextSyncIn: number } {
  return {
    isSyncing,
    lastSync: lastSyncResult,
    nextSyncIn: syncTimer ? SYNC_INTERVAL_MS : 0,
  };
}

import { Router } from "express";
import { db } from "@workspace/db";
import { auditLogsTable } from "@workspace/db/schema";
import { desc, eq, and, sql } from "drizzle-orm";
import { authenticate, authorize } from "../middlewares/auth";
import { AppError } from "../middlewares/error";

const router = Router();

// List audit logs with filters
router.get("/audit-logs", authenticate, authorize("administrador", "gestor"), async (req, res, next) => {
  try {
    const { entity, actor, limit: limitParam } = req.query;
    const limit = Math.min(Number(limitParam) || 50, 200);

    const conditions = [];

    if (entity && typeof entity === "string") {
      conditions.push(eq(auditLogsTable.entity, entity));
    }

    if (actor && typeof actor === "string") {
      conditions.push(eq(auditLogsTable.actor, actor));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const logs = await db
      .select()
      .from(auditLogsTable)
      .where(where)
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(limit);

    const total = await db.$count(auditLogsTable);

    res.json({ data: logs, total });
  } catch (err) {
    next(err);
  }
});

// Get audit log by ID
router.get("/audit-logs/:id", authenticate, authorize("administrador"), async (req, res, next) => {
  try {
    const log = await db.query.auditLogsTable.findFirst({
      where: eq(auditLogsTable.id, req.params.id as string),
    });

    if (!log) {
      throw new AppError(404, "Log de auditoria não encontrado");
    }

    res.json({ data: log });
  } catch (err) {
    next(err);
  }
});

// Create audit log (internal use)
router.post("/audit-logs", authenticate, authorize("administrador"), async (req, res, next) => {
  try {
    const { actor, action, entity, entityId, details, ipAddress } = req.body;

    const [log] = await db
      .insert(auditLogsTable)
      .values({
        actor,
        action,
        entity,
        entityId,
        details: details ? JSON.stringify(details) : undefined,
        ipAddress,
      })
      .returning();

    res.status(201).json({ data: log });
  } catch (err) {
    next(err);
  }
});

export default router;

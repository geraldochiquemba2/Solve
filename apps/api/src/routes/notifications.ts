import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db/schema";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { authenticate } from "../middlewares/auth";

const router = Router();

const mapNotif = (r: any) => ({
  id: r.id,
  type: r.type,
  title: r.title,
  body: r.body ?? null,
  leadId: r.leadId ?? null,
  read: !!r.readAt,
  createdAt: r.createdAt,
});

// Sino do CRM: avisos internos (lead nova, lead atribuída). Uma linha por
// destinatário — cada um marca a sua como lida sem afectar os restantes.
router.get("/notifications", authenticate, async (req, res, next) => {
  try {
    const uid = (req.user as any)?.userId;
    if (!uid || uid === "api-key") {
      res.json({ data: [], unread: 0 });
      return;
    }
    const limite = Math.min(Number(req.query.limit) || 30, 100);
    const rows = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.userId, uid))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(limite);
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(notificationsTable)
      .where(and(eq(notificationsTable.userId, uid), isNull(notificationsTable.readAt)));
    res.json({ data: rows.map(mapNotif), unread: n || 0 });
  } catch (err) {
    next(err);
  }
});

router.get("/notifications/unread-count", authenticate, async (req, res, next) => {
  try {
    const uid = (req.user as any)?.userId;
    if (!uid || uid === "api-key") {
      res.json({ data: { unread: 0 } });
      return;
    }
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(notificationsTable)
      .where(and(eq(notificationsTable.userId, uid), isNull(notificationsTable.readAt)));
    res.json({ data: { unread: n || 0 } });
  } catch (err) {
    next(err);
  }
});

router.post("/notifications/read-all", authenticate, async (req, res, next) => {
  try {
    const uid = (req.user as any)?.userId;
    if (!uid || uid === "api-key") {
      res.json({ data: { marked: 0, unread: 0 } });
      return;
    }
    const rows = await db
      .update(notificationsTable)
      .set({ readAt: new Date() })
      .where(and(eq(notificationsTable.userId, uid), isNull(notificationsTable.readAt)))
      .returning({ id: notificationsTable.id });
    res.json({ data: { marked: rows.length, unread: 0 } });
  } catch (err) {
    next(err);
  }
});

router.post("/notifications/:id/read", authenticate, async (req, res, next) => {
  try {
    const uid = (req.user as any)?.userId;
    if (!uid || uid === "api-key") {
      res.status(404).json({ error: "Notificação não encontrada" });
      return;
    }
    const [row] = await db
      .update(notificationsTable)
      .set({ readAt: new Date() })
      .where(and(eq(notificationsTable.id, req.params.id as string), eq(notificationsTable.userId, uid)))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Notificação não encontrada" });
      return;
    }
    res.json({ data: mapNotif(row) });
  } catch (err) {
    next(err);
  }
});

export default router;

import { Router } from "express";
import { db } from "@workspace/db";
import {
  customersTable,
  leadsTable,
  paymentsTable,
  subscriptionsTable,
  checkinsTable,
  integrationsTable,
  plansTable,
  auditLogsTable,
} from "@workspace/db/schema";
import { eq, and, gte, desc, sql } from "drizzle-orm";
import { authenticate } from "../middlewares/auth";

const router = Router();

// ─── GET /dashboard/stats ────────────────────────────────────────────────────
router.get("/dashboard/stats", authenticate, async (req, res, next) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalCustomers,
      activeCustomers,
      leadsByStatus,
      revenueResult,
      pendingPayments,
      latePayments,
      cancelledPayments,
      checkinsLast30,
      integrations,
    ] = await Promise.all([
      db.$count(customersTable),
      db.$count(customersTable, eq(customersTable.state, "activo")),
      db.select({ status: leadsTable.status, count: sql<number>`count(*)::int` })
        .from(leadsTable).groupBy(leadsTable.status),
      db.select({ total: sql<number>`coalesce(sum(${paymentsTable.amount}), 0)::int` })
        .from(paymentsTable).where(and(eq(paymentsTable.status, "confirmado"), gte(paymentsTable.paidAt, thirtyDaysAgo))),
      db.select({ total: sql<number>`coalesce(sum(${paymentsTable.amount}), 0)::int`, count: sql<number>`count(*)::int` })
        .from(paymentsTable).where(eq(paymentsTable.status, "pendente")),
      db.select({ total: sql<number>`coalesce(sum(${paymentsTable.amount}), 0)::int`, count: sql<number>`count(*)::int` })
        .from(paymentsTable).where(eq(paymentsTable.status, "em_atraso")),
      db.select({ total: sql<number>`coalesce(sum(${paymentsTable.amount}), 0)::int`, count: sql<number>`count(*)::int` })
        .from(paymentsTable).where(eq(paymentsTable.status, "rejeitado")),
      db.$count(checkinsTable, gte(checkinsTable.checkedInAt, thirtyDaysAgo)),
      db.query.integrationsTable.findMany(),
    ]);

    const inactiveCustomers = totalCustomers - activeCustomers;
    const totalLeads = leadsByStatus.reduce((sum, r) => sum + r.count, 0);
    const leadsByStatusMap: Record<string, number> = {
      novo_lead: 0, contacto: 0, qualificado: 0, proposta: 0,
      negociacao: 0, convertido: 0, perdido: 0,
    };
    for (const row of leadsByStatus) {
      leadsByStatusMap[row.status] = row.count;
    }

    res.json({
      data: {
        overview: {
          totalCustomers,
          activeCustomers,
          inactiveCustomers,
          totalLeads,
          revenueLast30Days: revenueResult[0]?.total || 0,
          pendingPaymentsCount: pendingPayments[0]?.count || 0,
          pendingPaymentsTotal: pendingPayments[0]?.total || 0,
          latePaymentsCount: latePayments[0]?.count || 0,
          latePaymentsTotal: latePayments[0]?.total || 0,
          cancelledPaymentsCount: cancelledPayments[0]?.count || 0,
          cancelledPaymentsTotal: cancelledPayments[0]?.total || 0,
          checkinsLast30Days: checkinsLast30,
        },
        leadsByStatus: leadsByStatusMap,
        integrations: integrations.map((i) => ({
          name: i.name,
          status: i.status,
          lastSyncAt: i.lastSyncAt,
          errorCount: i.errorCount,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /dashboard/charts ───────────────────────────────────────────────────
router.get("/dashboard/charts", authenticate, async (req, res, next) => {
  try {
    const now = new Date();
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    const [revenueByMonth, leadsBySource, totalLeads, convertedLeads, paymentMethods, newCustomersByMonth] = await Promise.all([
      db.select({
        month: sql<string>`to_char(${paymentsTable.paidAt}, 'YYYY-MM')`,
        total: sql<number>`coalesce(sum(${paymentsTable.amount}), 0)::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(paymentsTable)
      .where(and(eq(paymentsTable.status, "confirmado"), gte(paymentsTable.paidAt, oneYearAgo)))
      .groupBy(sql`to_char(${paymentsTable.paidAt}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${paymentsTable.paidAt}, 'YYYY-MM') ASC`),

      db.select({ source: leadsTable.source, count: sql<number>`count(*)::int` })
      .from(leadsTable).where(sql`${leadsTable.source} IS NOT NULL`)
      .groupBy(leadsTable.source).orderBy(sql`count(*) DESC`),

      db.$count(leadsTable),
      db.$count(leadsTable, eq(leadsTable.status, "convertido")),

      db.select({ method: paymentsTable.method, count: sql<number>`count(*)::int`, total: sql<number>`coalesce(sum(${paymentsTable.amount}), 0)::int` })
      .from(paymentsTable).where(sql`${paymentsTable.method} IS NOT NULL`)
      .groupBy(paymentsTable.method).orderBy(sql`count(*) DESC`),

      db.select({
        month: sql<string>`to_char(${customersTable.createdAt}, 'YYYY-MM')`,
        count: sql<number>`count(*)::int`,
      })
      .from(customersTable).where(gte(customersTable.createdAt, oneYearAgo))
      .groupBy(sql`to_char(${customersTable.createdAt}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${customersTable.createdAt}, 'YYYY-MM') ASC`),
    ]);

    const conversionRate = totalLeads > 0
      ? Math.round((convertedLeads / totalLeads) * 10000) / 100
      : 0;

    res.json({
      data: {
        revenueByMonth,
        leadsBySource,
        conversionRate,
        paymentMethods,
        newCustomersByMonth,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /dashboard/revenue ──────────────────────────────────────────────────
router.get("/dashboard/revenue", authenticate, async (req, res, next) => {
  try {
    const now = new Date();

    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Revenue by period
    const [today, thisWeek, thisMonth, thisYear] = await Promise.all([
      db
        .select({
          total: sql<number>`coalesce(sum(${paymentsTable.amount}), 0)::int`,
          count: sql<number>`count(*)::int`,
        })
        .from(paymentsTable)
        .where(
          and(
            eq(paymentsTable.status, "confirmado"),
            gte(paymentsTable.paidAt, startOfDay)
          )
        ),
      db
        .select({
          total: sql<number>`coalesce(sum(${paymentsTable.amount}), 0)::int`,
          count: sql<number>`count(*)::int`,
        })
        .from(paymentsTable)
        .where(
          and(
            eq(paymentsTable.status, "confirmado"),
            gte(paymentsTable.paidAt, startOfWeek)
          )
        ),
      db
        .select({
          total: sql<number>`coalesce(sum(${paymentsTable.amount}), 0)::int`,
          count: sql<number>`count(*)::int`,
        })
        .from(paymentsTable)
        .where(
          and(
            eq(paymentsTable.status, "confirmado"),
            gte(paymentsTable.paidAt, startOfMonth)
          )
        ),
      db
        .select({
          total: sql<number>`coalesce(sum(${paymentsTable.amount}), 0)::int`,
          count: sql<number>`count(*)::int`,
        })
        .from(paymentsTable)
        .where(
          and(
            eq(paymentsTable.status, "confirmado"),
            gte(paymentsTable.paidAt, startOfYear)
          )
        ),
    ]);

    // Revenue by plan
    const revenueByPlan = await db
      .select({
        planName: plansTable.name,
        planPrice: plansTable.price,
        total: sql<number>`coalesce(sum(${paymentsTable.amount}), 0)::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(paymentsTable)
      .innerJoin(
        subscriptionsTable,
        eq(paymentsTable.subscriptionId, subscriptionsTable.id)
      )
      .innerJoin(plansTable, eq(subscriptionsTable.planId, plansTable.id))
      .where(eq(paymentsTable.status, "confirmado"))
      .groupBy(plansTable.id, plansTable.name, plansTable.price)
      .orderBy(sql`sum(${paymentsTable.amount}) DESC`);

    // Revenue by payment method
    const revenueByMethod = await db
      .select({
        method: paymentsTable.method,
        total: sql<number>`coalesce(sum(${paymentsTable.amount}), 0)::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(paymentsTable)
      .where(
        and(
          eq(paymentsTable.status, "confirmado"),
          sql`${paymentsTable.method} IS NOT NULL`
        )
      )
      .groupBy(paymentsTable.method)
      .orderBy(sql`sum(${paymentsTable.amount}) DESC`);

    res.json({
      data: {
        byPeriod: {
          today: { total: today[0]?.total || 0, count: today[0]?.count || 0 },
          thisWeek: {
            total: thisWeek[0]?.total || 0,
            count: thisWeek[0]?.count || 0,
          },
          thisMonth: {
            total: thisMonth[0]?.total || 0,
            count: thisMonth[0]?.count || 0,
          },
          thisYear: {
            total: thisYear[0]?.total || 0,
            count: thisYear[0]?.count || 0,
          },
        },
        byPlan: revenueByPlan,
        byMethod: revenueByMethod,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /dashboard/activity ─────────────────────────────────────────────────
router.get("/dashboard/activity", authenticate, async (req, res, next) => {
  try {
    // Last 20 audit log entries
    const auditLogs = await db.query.auditLogsTable.findMany({
      orderBy: [desc(auditLogsTable.createdAt)],
      limit: 20,
    });

    // Last 10 leads created
    const recentLeads = await db.query.leadsTable.findMany({
      orderBy: [desc(leadsTable.createdAt)],
      limit: 10,
    });

    // Last 10 payments received
    const recentPayments = await db
      .select({
        id: paymentsTable.id,
        code: paymentsTable.code,
        amount: paymentsTable.amount,
        method: paymentsTable.method,
        status: paymentsTable.status,
        paidAt: paymentsTable.paidAt,
        customerId: paymentsTable.customerId,
        createdAt: paymentsTable.createdAt,
      })
      .from(paymentsTable)
      .orderBy(desc(paymentsTable.createdAt))
      .limit(10);

    res.json({
      data: {
        auditLogs,
        recentLeads,
        recentPayments,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;

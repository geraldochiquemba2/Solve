import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { authenticate } from "./middlewares/auth";
import { AppError, errorHandler, notFoundHandler } from "./middlewares/error";
import { globalRateLimit, authRateLimit, webhookRateLimit } from "./middlewares/rate-limit";
import { db } from "@workspace/db";
import { paymentsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { ekwanzaClient } from "./lib/ekwanza";

const app: Express = express();

// SSE clients for real-time payment updates
const paymentSSEClients = new Set<express.Response>();

export function broadcastPaymentUpdate(data: any) {
  for (const client of paymentSSEClients) {
    try { client.write(`data: ${JSON.stringify(data)}\n\n`); }
    catch { paymentSSEClients.delete(client); }
  }
}

// Trust proxy (Render, Cloudflare, etc.)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Security headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Logging
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// CORS
app.use(cors({
  origin: process.env.APP_URL || "http://localhost:5173",
  credentials: true,
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Global rate limiting
app.use(globalRateLimit);

// Health check (public)
app.get("/healthz", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Auth rate limiting
app.use("/api/v1/auth", authRateLimit);

// Webhook rate limiting
app.use("/api/v1/webhooks", webhookRateLimit);
app.use("/api/v1/webhooks/cademi", webhookRateLimit);
app.use("/api/v1/webhooks/pay4all", webhookRateLimit);

// API routes (versioned)
app.use("/api/v1", router);

// SSE: Real-time payment updates
app.get("/api/v1/payments/stream", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });
  res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);
  paymentSSEClients.add(res);
  req.on("close", () => paymentSSEClients.delete(res));
});

// É-kwanza webhook (public, no auth, outside /api/v1)
app.post("/webhooks/ekwanza", express.json(), async (req, res) => {
  try {
    const body = req.body;
    logger.info({ merchantTransactionId: body.merchantTransactionId }, "É-kwanza callback received");

    const { merchantTransactionId, ekwanzaTransactionId, operationStatus } = body;
    const statusMap: Record<number, string> = { 1: "confirmado", 3: "rejeitado", 4: "rejeitado", 5: "rejeitado" };
    const mappedStatus = statusMap[operationStatus] || "pendente";

    const payment = await db.query.paymentsTable.findFirst({
      where: eq(paymentsTable.code, merchantTransactionId),
    });

    if (payment) {
      const updateData: Record<string, any> = { status: mappedStatus, updatedAt: new Date() };
      if (ekwanzaTransactionId) updateData.ekwanzaOperationCode = ekwanzaTransactionId;
      if (mappedStatus === "confirmado") { updateData.paidAt = new Date(); updateData.reconciledAt = new Date(); }
      await db.update(paymentsTable).set(updateData).where(eq(paymentsTable.code, merchantTransactionId));
      logger.info({ paymentId: payment.id, newStatus: mappedStatus }, "Payment updated from callback");

      // Broadcast to SSE clients
      broadcastPaymentUpdate({ type: "payment_updated", code: merchantTransactionId, status: mappedStatus });
    }

    res.json({ received: true });
  } catch (err) {
    logger.error({ err }, "Error processing callback");
    res.status(500).json({ error: "Internal error" });
  }
});

// Backward compatibility: redirect old /api/* to /api/v1/*
app.use("/api", (req, res, next) => {
  if (req.path.startsWith("/v1/")) return next();
  const newPath = req.path === "/" ? "/api/v1/" : `/api/v1${req.path}`;
  res.redirect(301, newPath);
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Periodic expiration check for payments (every 5 minutes)
setInterval(async () => {
  try {
    const { db } = await import("@workspace/db");
    const { paymentsTable } = await import("@workspace/db/schema");
    const { and, eq, lt } = await import("drizzle-orm");
    const result = await db
      .update(paymentsTable)
      .set({ status: "expirado", updatedAt: new Date() })
      .where(and(eq(paymentsTable.status, "pendente"), lt(paymentsTable.expiresAt, new Date())))
      .returning({ code: paymentsTable.code });
    if (result.length > 0) {
      logger.info({ count: result.length, codes: result.map(r => r.code) }, "Expired payments marked");
    }
  } catch (err) {
    logger.error({ err }, "Error checking expired payments");
  }
}, 5 * 60 * 1000);

export default app;

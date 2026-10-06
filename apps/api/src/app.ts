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

// CORS: origens explícitas (lista separada por vírgula em APP_URL/CORS_ORIGIN).
const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || process.env.APP_URL || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors({
  origin: ALLOWED_ORIGINS.length === 1 ? ALLOWED_ORIGINS[0] : ALLOWED_ORIGINS,
  credentials: true,
}));

// Body parsing (limite anti-DoS)
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
app.use(cookieParser());

// Global rate limiting
app.use(globalRateLimit);

// Health check (public)
app.get("/healthz", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Auth rate limiting
app.use("/api/v1/auth", authRateLimit);
app.use("/api/v1/portal", authRateLimit);

// Webhook rate limiting
app.use("/api/v1/webhooks", webhookRateLimit);
app.use("/api/v1/webhooks/cademi", webhookRateLimit);
app.use("/api/v1/webhooks/pay4all", webhookRateLimit);

// API routes (versioned)
app.use("/api/v1", router);

// SSE: Real-time payment updates (só staff logado; o EventSource abre com
// withCredentials e leva o cookie httpOnly — nunca ?api_key= no URL)
app.get("/api/v1/payments/stream", authenticate, (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
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
// The target is derived from the request path, so it is validated before use:
// anything that could escape the origin (scheme, protocol-relative "//",
// backslashes, control chars) or leave the /api/v1 namespace is rejected.
const API_V1_PREFIX = "/api/v1";
const UNSAFE_REDIRECT_CHARS = /[\u0000-\u001f\u007f\\]/;
// Mesmos caracteres de controlo, mas escapados (%00-%1f, %7f) — o Node repassa
// o Location tal e qual, e %0d/%0a dariam injecção de cabeçalho.
const UNSAFE_REDIRECT_ESCAPES = /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i;
const EXTERNAL_URL_RE = /^[a-z][a-z0-9+.-]*:/i;
// RFC 3986 pchar reduzido ao que uma API usa: unreserved + escape %XX.
// ":" e "@" ficam de fora de propósito (separadores de autoridade).
const SAFE_SEGMENT_RE = /^(?:[A-Za-z0-9._~-]|%[0-9A-Fa-f]{2})+$/;

function buildV1RedirectTarget(reqPath: string): string {
  const fallback = `${API_V1_PREFIX}/`;
  if (typeof reqPath !== "string" || reqPath.length === 0) return fallback;
  if (reqPath.includes("//") || EXTERNAL_URL_RE.test(reqPath)) return fallback;
  if (UNSAFE_REDIRECT_CHARS.test(reqPath)) return fallback;
  if (UNSAFE_REDIRECT_ESCAPES.test(reqPath)) return fallback;

  const normalized = reqPath.startsWith("/") ? reqPath : `/${reqPath}`;
  // Resolve "." / ".." so the final URL cannot climb out of the /api/v1 namespace.
  // %2e também conta como ponto: o browser normaliza depois de descodificar.
  const segments: string[] = [];
  for (const raw of normalized.split("/")) {
    if (raw === "") continue;
    const segment = raw.replace(/%2e/gi, ".");
    if (segment === ".") continue;
    if (segment === "..") { segments.pop(); continue; }
    // Valida em vez de codificar: req.path vem percent-encoded do request,
    // então encodeURIComponent dobraria o escape ("%20" -> "%2520") e
    // quebraria clientes legítimos. Qualquer caractere inesperado cai no
    // destino seguro em vez de ser reescrito.
    if (!SAFE_SEGMENT_RE.test(raw)) return fallback;
    segments.push(raw);
  }
  if (segments.length === 0) return fallback;
  return `${API_V1_PREFIX}/${segments.join("/")}`;
}

app.use("/api", (req, res, next) => {
  if (req.path.startsWith("/v1/")) return next();
  res.redirect(301, buildV1RedirectTarget(req.path));
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Expiração de pendentes: 15min (cota Neon mensal). Override via EXPIRY_INTERVAL_MS.
const EXPIRY_INTERVAL_MS = Number(process.env.EXPIRY_INTERVAL_MS || 15 * 60 * 1000);
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
}, EXPIRY_INTERVAL_MS);

export default app;

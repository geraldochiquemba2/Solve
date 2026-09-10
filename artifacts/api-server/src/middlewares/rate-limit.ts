import { type Request, type Response, type NextFunction } from "express";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}

export function rateLimit(options: {
  windowMs?: number;
  max?: number;
  message?: string;
  keyFn?: (req: Request) => string;
} = {}) {
  const {
    windowMs = 60_000,
    max = 100,
    message = "Demasiados pedidos. Tente novamente mais tarde.",
    keyFn,
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    cleanup();

    const key = keyFn
      ? keyFn(req)
      : `${req.ip}:${req.path}`;

    const now = Date.now();
    const entry = store.get(key);

    if (!entry || entry.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count++;

    if (entry.count > max) {
      res.setHeader("Retry-After", Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader("X-RateLimit-Limit", max);
      res.setHeader("X-RateLimit-Remaining", 0);
      res.setHeader("X-RateLimit-Reset", Math.ceil(entry.resetAt / 1000));
      res.status(429).json({ error: message });
      return;
    }

    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", max - entry.count);
    res.setHeader("X-RateLimit-Reset", Math.ceil(entry.resetAt / 1000));

    next();
  };
}

export const globalRateLimit = rateLimit({
  windowMs: 60_000,
  max: 200,
  message: "Limite de pedidos atingido.",
});

export const authRateLimit = rateLimit({
  windowMs: 60_000,
  max: 10,
  message: "Demasiadas tentativas de autenticação.",
  keyFn: (req) => `auth:${req.ip}`,
});

export const webhookRateLimit = rateLimit({
  windowMs: 60_000,
  max: 50,
  message: "Demasiados webhooks.",
  keyFn: (req) => `webhook:${req.ip}:${req.path}`,
});

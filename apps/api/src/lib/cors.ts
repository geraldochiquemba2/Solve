import type { Request } from "express";

// Allowlist de origens: mesma fonte do middleware cors() em app.ts
// (lista separada por vírgula em CORS_ORIGIN/APP_URL).
const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || process.env.APP_URL || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * Valor de `Access-Control-Allow-Origin` para a requisição, ou null quando a
 * origem não está na allowlist.
 *
 * Nunca devolver "*" aqui: os streams SSE carregam dados autenticados e o
 * wildcard desliga a Same Origin Policy. Além disso, com `withCredentials: true`
 * (EventSource no front) o navegador rejeita "*" — a origem tem de ser refletida.
 */
export function resolveAllowedOrigin(req: Request): string | null {
  const origin = req.headers.origin;
  if (!origin || Array.isArray(origin)) return null;
  return ALLOWED_ORIGINS.includes(origin) ? origin : null;
}

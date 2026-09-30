import { type Request, type Response, type NextFunction } from "express";
import crypto from "node:crypto";
import jwt, { type SignOptions } from "jsonwebtoken";

// SEGURANÇA: sem fallbacks públicos. Em produção o servidor recusa arrancar
// sem JWT_SECRET/API_KEY (ver getJwtSecret/getApiKey). Em dev usa valores
// locais com aviso — nunca em produção.
function getJwtSecret(): string {
  const s = process.env.JWT_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET em falta — recusar arranque em produção");
  }
  console.warn("[segurança] JWT_SECRET em falta: a usar segredo local de dev");
  return "dev-only-insecure-secret";
}

function getApiKey(): string | undefined {
  const k = process.env.API_KEY;
  if (k) return k;
  if (process.env.NODE_ENV === "production") return undefined; // fail-closed
  console.warn("[segurança] API_KEY em falta: auth por chave desligada em dev");
  return undefined;
}

// Comparação timing-safe para não vazar a chave por tempo de resposta.
function apiKeyMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export interface AuthPayload {
  userId: string;
  role: string;
  email: string;
  name?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
      cookies?: Record<string, string>;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  // Try Authorization header first, then cookie
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) {
    const key = req.headers["x-api-key"] || req.query.api_key;
    const expected = getApiKey();
    if (expected && typeof key === "string" && apiKeyMatches(key, expected)) {
      req.user = { userId: "api-key", role: "administrador", email: "" };
      next();
      return;
    }
    res.status(401).json({ error: "Token de autenticação necessário" });
    return;
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as AuthPayload;
    // Isolamento portal-cliente: tokens com role=cliente só valem nas rotas
    // /portal/* (authenticatePortal). Todas as rotas staff usam este
    // middleware — sem isto um token portal lia GETs staff sem authorize.
    if ((decoded as unknown as Record<string, unknown>).role === "cliente") {
      res.status(403).json({ error: "Sem permissão para esta acção" });
      return;
    }
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido ou expirado" });
    return;
  }
}

export function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: "Não autenticado" });
      return;
    }

    if (roles.length > 0 && !roles.includes(req.user.role)) {
      res.status(403).json({ error: "Sem permissão para esta acção" });
      return;
    }

    next();
  };
}

export function generateToken(payload: AuthPayload): string {
  const options: SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN || "24h") as SignOptions["expiresIn"],
  };
  return jwt.sign(payload, getJwtSecret(), options);
}

import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";

// SEGURANÇA: mesmo segredo partilhado com staff, sem fallback público.
function getJwtSecret(): string {
  const s = process.env.JWT_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET em falta — recusar arranque em produção");
  }
  console.warn("[segurança] JWT_SECRET em falta: a usar segredo local de dev");
  return "dev-only-insecure-secret";
}

export interface PortalAuthPayload {
  role: "cliente";
  customerId: string;
  phone: string;
  iat?: number;
  exp?: number;
}

declare global {
  namespace Express {
    interface Request {
      customerId?: string;
      portalCustomer?: PortalAuthPayload;
    }
  }
}

export function generatePortalToken(customerId: string, phone: string): string {
  const payload: PortalAuthPayload = { role: "cliente", customerId, phone };
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "12h" });
}

export function authenticatePortal(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Token de cliente necessário" });
    return;
  }
  const token = authHeader.split(" ")[1];
  if (!token) {
    res.status(401).json({ error: "Token de cliente necessário" });
    return;
  }
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as PortalAuthPayload;
    if (decoded.role !== "cliente" || !decoded.customerId) {
      res.status(403).json({ error: "Token de staff não é válido no portal" });
      return;
    }
    req.customerId = decoded.customerId;
    req.portalCustomer = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido ou expirado" });
    return;
  }
}

import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "solve-corporate-crm-secret";

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
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "12h" });
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
    const decoded = jwt.verify(token, JWT_SECRET) as PortalAuthPayload;
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

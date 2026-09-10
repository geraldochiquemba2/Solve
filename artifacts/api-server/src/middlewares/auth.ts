import { type Request, type Response, type NextFunction } from "express";
import jwt, { type SignOptions } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "solve-corporate-crm-secret";

export interface AuthPayload {
  userId: string;
  role: string;
  email: string;
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
    res.status(401).json({ error: "Token de autenticação necessário" });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
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
  return jwt.sign(payload, JWT_SECRET, options);
}

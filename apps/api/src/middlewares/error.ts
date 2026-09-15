import { type Request, type Response, type NextFunction } from "express";
import { logger } from "../lib/logger";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    logger.warn({ err: err.message, code: err.code }, "Application error");
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    });
  }

  logger.error({ err }, "Unexpected error");
  return res.status(500).json({
    error: process.env.NODE_ENV === "development" ? err.message : "Erro interno do servidor",
  });
}

export function notFoundHandler(req: Request, res: Response) {
  return res.status(404).json({
    error: `Rota não encontrada: ${req.method} ${req.path}`,
  });
}

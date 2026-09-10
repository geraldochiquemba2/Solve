import { type Request, type Response, type NextFunction } from "express";
import { type ZodSchema } from "zod";

export function validate(schema: ZodSchema, source: "body" | "query" | "params" = "body") {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      res.status(400).json({
        error: "Dados inválidos",
        details: errors,
      });
      return;
    }

    req[source] = result.data;
    next();
  };
}

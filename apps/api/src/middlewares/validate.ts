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

    // Express 5: req.query (e req.params) é getter-only — reatribuição direta
    // lança TypeError. Para query/params faz merge in-place; body continua a
    // ser substituído pelos dados validados.
    if (source === "query" || source === "params") {
      const target = (req as unknown as Record<string, unknown>)[source] as Record<string, unknown>;
      if (target && typeof target === "object") {
        for (const k of Object.keys(target)) delete target[k];
        Object.assign(target, result.data as Record<string, unknown>);
      }
    } else {
      req[source] = result.data;
    }
    next();
  };
}

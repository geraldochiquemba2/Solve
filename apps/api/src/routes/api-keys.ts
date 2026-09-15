import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { apiKeysTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { authenticate, authorize } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import { AppError } from "../middlewares/error";
import { randomBytes } from "crypto";

const router = Router();

function generateApiKey(): string {
  return randomBytes(32).toString("hex").match(/.{1,8}/g)?.join("-") ?? "";
}

const apiKeySchema = z.object({
  name: z.string().min(1).max(255),
  expiresAt: z.string().datetime().optional(),
});

const apiKeyUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  active: z.boolean().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

router.get("/api-keys", authenticate, authorize("administrador"), async (req, res, next) => {
  try {
    const keys = await db.query.apiKeysTable.findMany({
      orderBy: [desc(apiKeysTable.createdAt)],
    });

    const safeKeys = keys.map((k) => ({
      id: k.id,
      name: k.name,
      keyPreview: k.key.slice(0, 8) + "..." + k.key.slice(-4),
      active: k.active,
      lastUsedAt: k.lastUsedAt,
      expiresAt: k.expiresAt,
      createdAt: k.createdAt,
      updatedAt: k.updatedAt,
    }));

    res.json({ data: safeKeys, total: safeKeys.length });
  } catch (err) {
    next(err);
  }
});

router.get("/api-keys/:id", authenticate, authorize("administrador"), async (req, res, next) => {
  try {
    const key = await db.query.apiKeysTable.findFirst({
      where: eq(apiKeysTable.id, req.params.id as string),
    });

    if (!key) {
      throw new AppError(404, "Chave de API não encontrada");
    }

    res.json({
      data: {
        id: key.id,
        name: key.name,
        keyPreview: key.key.slice(0, 8) + "..." + key.key.slice(-4),
        active: key.active,
        lastUsedAt: key.lastUsedAt,
        expiresAt: key.expiresAt,
        createdAt: key.createdAt,
        updatedAt: key.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/api-keys",
  authenticate,
  authorize("administrador"),
  validate(apiKeySchema),
  async (req, res, next) => {
    try {
      const newKey = generateApiKey();

      const [apiKey] = await db
        .insert(apiKeysTable)
        .values({
          name: req.body.name,
          key: newKey,
          userId: req.user?.userId,
          expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined,
        })
        .returning();

      res.status(201).json({
        data: {
          id: apiKey.id,
          name: apiKey.name,
          key: newKey,
          createdAt: apiKey.createdAt,
        },
        message: "Guarde esta chave. Não será possível visualizá-la novamente.",
      });
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  "/api-keys/:id",
  authenticate,
  authorize("administrador"),
  validate(apiKeyUpdateSchema),
  async (req, res, next) => {
    try {
      const existing = await db.query.apiKeysTable.findFirst({
        where: eq(apiKeysTable.id, req.params.id as string),
      });

      if (!existing) {
        throw new AppError(404, "Chave de API não encontrada");
      }

      const updateData: Record<string, unknown> = { ...req.body, updatedAt: new Date() };
      if (req.body.expiresAt !== undefined) {
        updateData.expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;
      }

      const [updated] = await db
        .update(apiKeysTable)
        .set(updateData)
        .where(eq(apiKeysTable.id, req.params.id as string))
        .returning();

      res.json({
        data: {
          id: updated.id,
          name: updated.name,
          keyPreview: updated.key.slice(0, 8) + "..." + updated.key.slice(-4),
          active: updated.active,
          lastUsedAt: updated.lastUsedAt,
          expiresAt: updated.expiresAt,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  "/api-keys/:id",
  authenticate,
  authorize("administrador"),
  async (req, res, next) => {
    try {
      const existing = await db.query.apiKeysTable.findFirst({
        where: eq(apiKeysTable.id, req.params.id as string),
      });

      if (!existing) {
        throw new AppError(404, "Chave de API não encontrada");
      }

      await db.delete(apiKeysTable).where(eq(apiKeysTable.id, req.params.id as string));

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  "/api-keys/:id/toggle",
  authenticate,
  authorize("administrador"),
  async (req, res, next) => {
    try {
      const existing = await db.query.apiKeysTable.findFirst({
        where: eq(apiKeysTable.id, req.params.id as string),
      });

      if (!existing) {
        throw new AppError(404, "Chave de API não encontrada");
      }

      const [updated] = await db
        .update(apiKeysTable)
        .set({ active: !existing.active, updatedAt: new Date() })
        .where(eq(apiKeysTable.id, req.params.id as string))
        .returning();

      res.json({
        data: {
          id: updated.id,
          name: updated.name,
          keyPreview: updated.key.slice(0, 8) + "..." + updated.key.slice(-4),
          active: updated.active,
          lastUsedAt: updated.lastUsedAt,
          expiresAt: updated.expiresAt,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;

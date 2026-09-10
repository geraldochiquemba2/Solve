import { Router } from "express";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { authenticate, authorize } from "../middlewares/auth";
import { AppError } from "../middlewares/error";

const router = Router();

// List all settings
router.get("/settings", authenticate, authorize("administrador", "gestor"), async (req, res, next) => {
  try {
    const settings = await db.query.settingsTable.findMany();

    // Convert to key-value object (exclude internal keys like password_reset_*)
    const filtered = settings.filter((s) => !s.key.startsWith("password_reset_"));
    const data = filtered.reduce((acc, s) => {
      try {
        acc[s.key] = JSON.parse(String(s.value));
      } catch {
        acc[s.key] = s.value;
      }
      return acc;
    }, {} as Record<string, any>);

    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// Get setting by key
router.get("/settings/:key", authenticate, authorize("administrador", "gestor"), async (req, res, next) => {
  try {
    const setting = await db.query.settingsTable.findFirst({
      where: eq(settingsTable.key, req.params.key as string),
    });

    if (!setting) {
      throw new AppError(404, "Configuração não encontrada");
    }

    let value;
    try {
      value = JSON.parse(String(setting.value));
    } catch {
      value = setting.value;
    }

    res.json({ data: { key: setting.key, value } });
  } catch (err) {
    next(err);
  }
});

// Update or create setting
router.put("/settings/:key", authenticate, authorize("administrador"), async (req, res, next) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    const existing = await db.query.settingsTable.findFirst({
      where: eq(settingsTable.key, key as string),
    });

    const jsonValue = JSON.stringify(value);

    if (existing) {
      await db
        .update(settingsTable)
        .set({ value: jsonValue, updatedAt: new Date() })
        .where(eq(settingsTable.key, key as string));
    } else {
      await db.insert(settingsTable).values({
        key: key as string,
        value: jsonValue,
      });
    }

    res.json({ data: { key, value } });
  } catch (err) {
    next(err);
  }
});

// Bulk update settings
router.put("/settings", authenticate, authorize("administrador"), async (req, res, next) => {
  try {
    const { settings } = req.body;

    if (!settings || typeof settings !== "object") {
      throw new AppError(400, "settings deve ser um objeto");
    }

    for (const [key, value] of Object.entries(settings)) {
      // Skip internal keys
      if (key.startsWith("password_reset_")) continue;

      const existing = await db.query.settingsTable.findFirst({
        where: eq(settingsTable.key, key),
      });

      const jsonValue = JSON.stringify(value);

      if (existing) {
        await db
          .update(settingsTable)
          .set({ value: jsonValue, updatedAt: new Date() })
          .where(eq(settingsTable.key, key));
      } else {
        await db.insert(settingsTable).values({ key, value: jsonValue });
      }
    }

    res.json({ message: "Configurações atualizadas com sucesso" });
  } catch (err) {
    next(err);
  }
});

// Delete setting
router.delete("/settings/:key", authenticate, authorize("administrador"), async (req, res, next) => {
  try {
    const existing = await db.query.settingsTable.findFirst({
      where: eq(settingsTable.key, req.params.key as string),
    });

    if (!existing) {
      throw new AppError(404, "Configuração não encontrada");
    }

    await db.delete(settingsTable).where(eq(settingsTable.key, req.params.key as string));

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;

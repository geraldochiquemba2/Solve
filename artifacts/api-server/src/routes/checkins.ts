import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { checkinsTable, customersTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { authenticate, authorize } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import { AppError } from "../middlewares/error";

const router = Router();

const checkinSchema = z.object({
  customerId: z.string().uuid(),
  location: z.string().max(255).optional(),
  ovgCheckinId: z.string().max(100).optional(),
  checkedInAt: z.string().datetime().optional(),
});

router.get("/checkins", authenticate, async (req, res, next) => {
  try {
    const { customerId } = req.query;

    let checkins;
    if (customerId) {
      checkins = await db.query.checkinsTable.findMany({
        where: eq(checkinsTable.customerId, customerId as string),
        orderBy: [desc(checkinsTable.checkedInAt)],
      });
    } else {
      checkins = await db.query.checkinsTable.findMany({
        orderBy: [desc(checkinsTable.checkedInAt)],
      });
    }

    res.json({ data: checkins, total: checkins.length });
  } catch (err) {
    next(err);
  }
});

router.get("/checkins/:id", authenticate, async (req, res, next) => {
  try {
    const checkin = await db.query.checkinsTable.findFirst({
      where: eq(checkinsTable.id, req.params.id as string),
    });

    if (!checkin) {
      throw new AppError(404, "Check-in não encontrado");
    }

    res.json({ data: checkin });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/checkins",
  authenticate,
  authorize("administrador", "gestor", "operacional"),
  validate(checkinSchema),
  async (req, res, next) => {
    try {
      const customer = await db.query.customersTable.findFirst({
        where: eq(customersTable.id, req.body.customerId),
      });

      if (!customer) {
        throw new AppError(404, "Cliente não encontrado");
      }

      const [checkin] = await db
        .insert(checkinsTable)
        .values({
          customerId: req.body.customerId,
          location: req.body.location,
          ovgCheckinId: req.body.ovgCheckinId,
          checkedInAt: req.body.checkedInAt ? new Date(req.body.checkedInAt) : new Date(),
        })
        .returning();

      res.status(201).json({ data: checkin });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  "/checkins/:id",
  authenticate,
  authorize("administrador"),
  async (req, res, next) => {
    try {
      const existing = await db.query.checkinsTable.findFirst({
        where: eq(checkinsTable.id, req.params.id as string),
      });

      if (!existing) {
        throw new AppError(404, "Check-in não encontrado");
      }

      await db.delete(checkinsTable).where(eq(checkinsTable.id, req.params.id as string));

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

export default router;

import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { authenticate, authorize } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import { AppError } from "../middlewares/error";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const router = Router();

const userUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  role: z.enum(["administrador", "gestor", "comercial", "financeiro", "operacional"]).optional(),
  phone: z.string().optional(),
  active: z.boolean().optional(),
});

// List all users
router.get("/users", authenticate, authorize("administrador", "gestor"), async (req, res, next) => {
  try {
    const users = await db.query.usersTable.findMany({
      orderBy: [desc(usersTable.createdAt)],
    });

    // Don't return password hashes
    const safeUsers = users.map(({ passwordHash, ...user }) => user);

    res.json({ data: safeUsers, total: safeUsers.length });
  } catch (err) {
    next(err);
  }
});

// Get user by ID (próprio perfil ou admin/gestor — VULN-07)
router.get("/users/:id", authenticate, async (req, res, next) => {
  try {
    const me = req.user!;
    const isStaff = ["administrador", "gestor"].includes(me.role);
    if (!isStaff && me.userId !== req.params.id) {
      throw new AppError(403, "Sem permissão para esta acção");
    }
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, req.params.id as string),
    });

    if (!user) {
      throw new AppError(404, "Utilizador não encontrado");
    }

    const { passwordHash, ...safeUser } = user;
    res.json({ data: safeUser });
  } catch (err) {
    next(err);
  }
});

// Update user
router.patch("/users/:id", authenticate, authorize("administrador"), validate(userUpdateSchema), async (req, res, next) => {
  try {
    const existing = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, req.params.id as string),
    });

    if (!existing) {
      throw new AppError(404, "Utilizador não encontrado");
    }

    const [user] = await db
      .update(usersTable)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(usersTable.id, req.params.id as string))
      .returning();

    const { passwordHash, ...safeUser } = user;
    res.json({ data: safeUser });
  } catch (err) {
    next(err);
  }
});

// Toggle user active status
router.patch("/users/:id/toggle", authenticate, authorize("administrador"), async (req, res, next) => {
  try {
    const existing = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, req.params.id as string),
    });

    if (!existing) {
      throw new AppError(404, "Utilizador não encontrado");
    }

    const [user] = await db
      .update(usersTable)
      .set({ active: !existing.active, updatedAt: new Date() })
      .where(eq(usersTable.id, req.params.id as string))
      .returning();

    const { passwordHash, ...safeUser } = user;
    res.json({ data: safeUser });
  } catch (err) {
    next(err);
  }
});

// Invite user — cria acesso com password temporária (paridade com standalone-server).
// Aceita email e/ou telefone; sem email gera-se um interno único a partir do número.
router.post("/users/invite", authenticate, authorize("administrador"), validate(z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido").nullish(),
  phone: z.string().min(9, "Número inválido").nullish(),
  role: z.preprocess(
    (v) => (typeof v === "string" ? v.toLowerCase() : v),
    z.enum(["administrador", "gestor", "comercial", "financeiro", "operacional"]).default("comercial")
  ),
  password: z.string().min(8, "Password deve ter pelo menos 8 caracteres").nullish(),
}).refine((d) => d.email || d.phone, { message: "Email ou número é obrigatório" })), async (req, res, next) => {
  try {
    const phone = req.body.phone ? String(req.body.phone).trim() : null;
    let email = req.body.email ? String(req.body.email).trim() : null;
    if (!email && phone) {
      email = `${phone.replace(/\D/g, "")}@equipa.crm`;
    }
    const existingEmail = await db.query.usersTable.findFirst({
      where: eq(usersTable.email, email as string),
    });
    if (existingEmail) {
      throw new AppError(409, "Email já registado");
    }
    if (phone) {
      const existingPhone = await db.query.usersTable.findFirst({
        where: eq(usersTable.phone, phone),
      });
      if (existingPhone) {
        throw new AppError(409, "Número já registado");
      }
    }
    const tempPassword = req.body.password ? String(req.body.password) : crypto.randomBytes(6).toString("hex");
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const [user] = await db
      .insert(usersTable)
      .values({
        name: req.body.name,
        email: email as string,
        passwordHash,
        role: req.body.role ?? "comercial",
        phone,
      } as any)
      .returning();
    const { passwordHash: _ph, ...safeUser } = user;
    res.status(201).json({ data: { ...safeUser, tempPassword } });
  } catch (err) {
    next(err);
  }
});

// Delete user (soft delete - deactivate)
router.delete("/users/:id", authenticate, authorize("administrador"), async (req, res, next) => {
  try {
    const existing = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, req.params.id as string),
    });

    if (!existing) {
      throw new AppError(404, "Utilizador não encontrado");
    }

    // Soft delete - just deactivate
    await db
      .update(usersTable)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(usersTable.id, req.params.id as string));

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;

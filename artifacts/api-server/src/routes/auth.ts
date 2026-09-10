import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { usersTable, settingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { validate } from "../middlewares/validate";
import { generateToken, type AuthPayload } from "../middlewares/auth";
import { AppError } from "../middlewares/error";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const router = Router();

const SALT_ROUNDS = 10;

const loginSchema = z.object({
  email: z.string().optional(),
  phone: z.string().optional(),
  password: z.string().min(1, "Password é obrigatória"),
}).refine((data) => data.email || data.phone, {
  message: "Email ou telefone é obrigatório",
});

const registerSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Password deve ter pelo menos 8 caracteres"),
  role: z.enum(["administrador", "gestor", "comercial", "financeiro", "operacional"]).default("comercial"),
  phone: z.string().optional(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Email inválido"),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token é obrigatório"),
  password: z.string().min(8, "Password deve ter pelo menos 8 caracteres"),
});

router.post("/auth/login", validate(loginSchema), async (req, res, next) => {
  try {
    const { email, phone, password } = req.body;
    const identifier = email || phone;

    let user;
    try {
      if (email) {
        user = await db.query.usersTable.findFirst({
          where: eq(usersTable.email, email),
        });
      } else if (phone) {
        user = await db.query.usersTable.findFirst({
          where: eq(usersTable.phone, phone),
        });
      }
    } catch (dbErr) {
      if (process.env.NODE_ENV === "development") {
        const payload: AuthPayload = {
          userId: "dev-user-id",
          role: "administrador",
          email: identifier || "dev@solvecorporate.ao",
        };
        const token = generateToken(payload);
        res.cookie('token', token, {
          httpOnly: true,
          secure: false,
          sameSite: 'strict',
          maxAge: 24 * 60 * 60 * 1000,
          path: '/',
        });
        return res.json({
          token,
          user: { id: "dev-user-id", name: "Administrador (dev)", email: identifier || "", role: "administrador" },
        });
      }
      throw dbErr;
    }

    if (!user && process.env.NODE_ENV === "development") {
      const payload: AuthPayload = {
        userId: "dev-user-id",
        role: "administrador",
        email: identifier || "dev@solvecorporate.ao",
      };
      const token = generateToken(payload);
      res.cookie('token', token, {
        httpOnly: true,
        secure: false,
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000,
        path: '/',
      });
      return res.json({
        token,
        user: { id: "dev-user-id", name: "Administrador (dev)", email: identifier || "", role: "administrador" },
      });
    }

    if (!user) {
      throw new AppError(401, "Credenciais inválidas");
    }

    if (!user.active) {
      throw new AppError(403, "Conta desactivada");
    }

    // Compare password with bcrypt
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new AppError(401, "Credenciais inválidas");
    }

    const payload: AuthPayload = {
      userId: user.id,
      role: user.role,
      email: user.email,
    };

    const token = generateToken(payload);

    // Set httpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/',
    });

    await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
  return;
});

router.post("/auth/logout", (_req, res) => {
  res.clearCookie('token', { path: '/' });
  res.json({ message: "Sessão terminada" });
});

router.post("/auth/register", validate(registerSchema), async (req, res, next) => {
  try {
    const { name, email, password, role, phone } = req.body;

    const existing = await db.query.usersTable.findFirst({
      where: eq(usersTable.email, email),
    });

    if (existing) {
      throw new AppError(409, "Email já registado");
    }

    // Hash password with bcrypt
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const [user] = await db
      .insert(usersTable)
      .values({
        name,
        email,
        passwordHash,
        role,
        phone,
      })
      .returning();

    const payload: AuthPayload = {
      userId: user.id,
      role: user.role,
      email: user.email,
    };

    const token = generateToken(payload);

    res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Forgot password - generate token and store in settings
router.post("/auth/forgot-password", validate(forgotPasswordSchema), async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.email, email),
    });

    // Always return success to prevent email enumeration
    if (user) {
      const resetToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Store reset token in settings table
      const existing = await db.query.settingsTable.findFirst({
        where: eq(settingsTable.key, `password_reset_${user.id}`),
      });

      if (existing) {
        await db.update(settingsTable)
          .set({ value: JSON.stringify({ token: resetToken, expiresAt: expiresAt.toISOString() }), updatedAt: new Date() })
          .where(eq(settingsTable.key, `password_reset_${user.id}`));
      } else {
        await db.insert(settingsTable).values({
          key: `password_reset_${user.id}`,
          value: JSON.stringify({ token: resetToken, expiresAt: expiresAt.toISOString() }),
        });
      }

      // In production, send email with resetToken link
      // For now, log it for development
      console.log(`[PASSWORD RESET] Token for ${email}: ${resetToken}`);
    }

    res.json({ message: "Se o email existir, receberá um link de recuperação" });
  } catch (err) {
    next(err);
  }
});

// Reset password with token
router.post("/auth/reset-password", validate(resetPasswordSchema), async (req, res, next) => {
  try {
    const { token, password } = req.body;

    // Find user by reset token in settings
    const settings = await db.query.settingsTable.findMany();
    const resetEntry = settings.find((s) => {
      if (!s.key.startsWith("password_reset_")) return false;
      try {
        const data = JSON.parse(JSON.stringify(s.value));
        return data.token === token;
      } catch {
        return false;
      }
    });

    if (!resetEntry) {
      throw new AppError(400, "Token inválido ou expirado");
    }

    const data = JSON.parse(JSON.stringify(resetEntry.value));
    if (new Date(data.expiresAt) < new Date()) {
      throw new AppError(400, "Token inválido ou expirado");
    }

    const userId = resetEntry.key.replace("password_reset_", "");
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    await db.update(usersTable)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(usersTable.id, userId));

    // Remove used token
    await db.delete(settingsTable).where(eq(settingsTable.key, resetEntry.key));

    res.json({ message: "Password atualizada com sucesso" });
  } catch (err) {
    next(err);
  }
});

export default router;

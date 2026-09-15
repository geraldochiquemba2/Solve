import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import app from "../app";
import { db } from "@workspace/db";

const mockDb = vi.mocked(db);

const validPasswordHash = bcrypt.hashSync("password123", 10);

describe("Auth API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("POST /api/v1/auth/register", () => {
    it("should create a user and return token", async () => {
      mockDb.query.usersTable.findFirst.mockResolvedValue(undefined as any);

      const mockUser = {
        id: "user-uuid-1",
        name: "Test User",
        email: "test@example.com",
        passwordHash: "password123",
        role: "comercial" as const,
        phone: null,
        active: true,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockUser]),
        }),
      } as any);

      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "Test User",
          email: "test@example.com",
          password: "password123",
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("token");
      expect(typeof res.body.token).toBe("string");
      expect(res.body.user).toEqual(
        expect.objectContaining({
          id: "user-uuid-1",
          name: "Test User",
          email: "test@example.com",
          role: "comercial",
        }),
      );
    });

    it("should return 409 if email already exists", async () => {
      const existingUser = {
        id: "existing-uuid",
        name: "Existing User",
        email: "test@example.com",
        passwordHash: "password123",
        role: "comercial" as const,
      };

      mockDb.query.usersTable.findFirst.mockResolvedValue(existingUser as any);

      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "Test User",
          email: "test@example.com",
          password: "password123",
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe("Email já registado");
    });

    it("should return 400 with invalid data", async () => {
      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "T",
          email: "invalid-email",
          password: "short",
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error", "Dados inválidos");
    });
  });

  describe("POST /api/v1/auth/login", () => {
    it("should return token with valid credentials", async () => {
      const mockUser = {
        id: "user-uuid-1",
        name: "Test User",
        email: "test@example.com",
        passwordHash: validPasswordHash,
        role: "comercial" as const,
        active: true,
      };

      mockDb.query.usersTable.findFirst.mockResolvedValue(mockUser as any);
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as any);

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "test@example.com",
          password: "password123",
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("token");
      expect(typeof res.body.token).toBe("string");
      expect(res.body.user).toEqual(
        expect.objectContaining({
          id: "user-uuid-1",
          name: "Test User",
          email: "test@example.com",
        }),
      );
    });

    it("should return 401 with invalid credentials", async () => {
      mockDb.query.usersTable.findFirst.mockResolvedValue(undefined as any);

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "wrong@example.com",
          password: "wrongpassword",
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Credenciais inválidas");
    });

    it("should return 401 with wrong password", async () => {
      const mockUser = {
        id: "user-uuid-1",
        name: "Test User",
        email: "test@example.com",
        passwordHash: validPasswordHash,
        role: "comercial" as const,
        active: true,
      };

      mockDb.query.usersTable.findFirst.mockResolvedValue(mockUser as any);

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "test@example.com",
          password: "wrongpassword",
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Credenciais inválidas");
    });

    it("should return 403 for deactivated account", async () => {
      const mockUser = {
        id: "user-uuid-1",
        name: "Test User",
        email: "test@example.com",
        passwordHash: "password123",
        role: "comercial" as const,
        active: false,
      };

      mockDb.query.usersTable.findFirst.mockResolvedValue(mockUser as any);

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "test@example.com",
          password: "password123",
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Conta desactivada");
    });
  });

  describe("POST /api/v1/auth/forgot-password", () => {
    it("should always return success message", async () => {
      mockDb.query.usersTable.findFirst.mockResolvedValue(undefined as any);

      const res = await request(app)
        .post("/api/v1/auth/forgot-password")
        .send({ email: "test@example.com" });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe(
        "Se o email existir, receberá um link de recuperação",
      );
    });

    it("should return same success even if user exists", async () => {
      const mockUser = { id: "user-uuid-1", email: "test@example.com" };
      mockDb.query.usersTable.findFirst.mockResolvedValue(mockUser as any);

      const res = await request(app)
        .post("/api/v1/auth/forgot-password")
        .send({ email: "test@example.com" });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe(
        "Se o email existir, receberá um link de recuperação",
      );
    });
  });
});

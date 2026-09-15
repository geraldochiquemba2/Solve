import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../app";
import { db } from "@workspace/db";
import { generateToken } from "../middlewares/auth";

const mockDb = vi.mocked(db);

const adminToken = generateToken({
  userId: "admin-uuid",
  role: "administrador",
  email: "admin@example.com",
});

const financeiroToken = generateToken({
  userId: "financeiro-uuid",
  role: "financeiro",
  email: "financeiro@example.com",
});

describe("Payments API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("GET /api/v1/payments", () => {
    it("should return payments list when authenticated", async () => {
      const mockPayments = [
        {
          id: "pay-1",
          code: "TRX-81001",
          customerId: "cust-1",
          subscriptionId: null,
          amount: 5000,
          method: "transferencia",
          status: "confirmado",
          referenceCode: "REF001",
          paidAt: new Date(),
          reconciledAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "pay-2",
          code: "TRX-81002",
          customerId: "cust-2",
          subscriptionId: null,
          amount: 15000,
          method: "ekwanza",
          status: "pendente",
          referenceCode: null,
          paidAt: null,
          reconciledAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockDb.query.paymentsTable.findMany.mockResolvedValue(mockPayments as any);

      const res = await request(app)
        .get("/api/v1/payments")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.total).toBe(2);
      expect(res.body.data[0].code).toBe("TRX-81001");
      expect(res.body.data[0].status).toBe("confirmado");
    });

    it("should return 401 without authentication", async () => {
      const res = await request(app).get("/api/v1/payments");

      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/v1/payments", () => {
    it("should create a payment when authenticated", async () => {
      mockDb.$count.mockResolvedValue(0);

      const mockPayment = {
        id: "pay-new",
        code: "TRX-81001",
        customerId: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
        subscriptionId: null,
        amount: 5000,
        method: "transferencia",
        status: "pendente",
        referenceCode: "REF001",
        paidAt: null,
        reconciledAt: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockPayment]),
        }),
      } as any);

      const res = await request(app)
        .post("/api/v1/payments")
        .set("Authorization", `Bearer ${financeiroToken}`)
        .send({
          customerId: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
          amount: 5000,
          method: "transferencia",
          referenceCode: "REF001",
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toEqual(
        expect.objectContaining({
          id: "pay-new",
          code: "TRX-81001",
          amount: 5000,
          status: "pendente",
        }),
      );
    });

    it("should return 400 with invalid data", async () => {
      const res = await request(app)
        .post("/api/v1/payments")
        .set("Authorization", `Bearer ${financeiroToken}`)
        .send({ amount: -100 });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error", "Dados inválidos");
    });

    it("should return 400 without customerId", async () => {
      const res = await request(app)
        .post("/api/v1/payments")
        .set("Authorization", `Bearer ${financeiroToken}`)
        .send({ amount: 5000 });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error", "Dados inválidos");
    });
  });

  describe("PATCH /api/v1/payments/:id/reconcile", () => {
    it("should reconcile a payment when authenticated", async () => {
      const existingPayment = {
        id: "pay-1",
        code: "TRX-81001",
        customerId: "cust-1",
        amount: 5000,
        status: "pendente",
      };

      const reconciledPayment = {
        ...existingPayment,
        status: "confirmado",
        reconciledAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.query.paymentsTable.findFirst.mockResolvedValue(existingPayment as any);

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([reconciledPayment]),
          }),
        }),
      } as any);

      const res = await request(app)
        .patch("/api/v1/payments/pay-1/reconcile")
        .set("Authorization", `Bearer ${financeiroToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("confirmado");
      expect(res.body.data).toHaveProperty("reconciledAt");
    });

    it("should return 404 if payment not found", async () => {
      mockDb.query.paymentsTable.findFirst.mockResolvedValue(undefined as any);

      const res = await request(app)
        .patch("/api/v1/payments/nonexistent/reconcile")
        .set("Authorization", `Bearer ${financeiroToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Pagamento não encontrado");
    });
  });

  describe("GET /api/v1/payments/:id", () => {
    it("should return a payment by ID", async () => {
      const mockPayment = {
        id: "pay-1",
        code: "TRX-81001",
        customerId: "cust-1",
        amount: 5000,
        status: "confirmado",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.query.paymentsTable.findFirst.mockResolvedValue(mockPayment as any);

      const res = await request(app)
        .get("/api/v1/payments/pay-1")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.code).toBe("TRX-81001");
      expect(res.body.data.amount).toBe(5000);
    });

    it("should return 404 if payment not found", async () => {
      mockDb.query.paymentsTable.findFirst.mockResolvedValue(undefined as any);

      const res = await request(app)
        .get("/api/v1/payments/nonexistent")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Pagamento não encontrado");
    });
  });
});

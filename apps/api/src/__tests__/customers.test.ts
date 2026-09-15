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

describe("Customers API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("GET /api/v1/customers", () => {
    it("should return customers list when authenticated", async () => {
      const mockCustomers = [
        {
          id: "cust-1",
          code: "CL-00843",
          name: "Customer One",
          email: "cust1@example.com",
          nif: "5412345678",
          state: "activo",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "cust-2",
          code: "CL-00844",
          name: "Customer Two",
          email: "cust2@example.com",
          nif: "5412345679",
          state: "activo",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockDb.query.customersTable.findMany.mockResolvedValue(mockCustomers as any);

      const res = await request(app)
        .get("/api/v1/customers")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.total).toBe(2);
      expect(res.body.data[0].name).toBe("Customer One");
    });

    it("should return 401 without authentication", async () => {
      const res = await request(app).get("/api/v1/customers");

      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/v1/customers", () => {
    it("should create a customer when authenticated", async () => {
      mockDb.$count.mockResolvedValue(0);
      mockDb.query.customersTable.findFirst.mockResolvedValue(undefined as any);

      const mockCustomer = {
        id: "cust-new",
        code: "CL-00843",
        name: "New Customer",
        email: "new@example.com",
        phone: "+244911111111",
        company: "New Corp",
        nif: "5499999999",
        birthDate: null,
        state: "activo",
        ovgId: null,
        cademiId: null,
        whatsappPhone: null,
        leadId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockCustomer]),
        }),
      } as any);

      const res = await request(app)
        .post("/api/v1/customers")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "New Customer",
          email: "new@example.com",
          phone: "+244911111111",
          company: "New Corp",
          nif: "5499999999",
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toEqual(
        expect.objectContaining({
          id: "cust-new",
          name: "New Customer",
          code: "CL-00843",
        }),
      );
    });

    it("should return 409 for duplicate NIF", async () => {
      mockDb.$count.mockResolvedValue(0);

      const existingCustomer = {
        id: "cust-existing",
        code: "CL-00843",
        name: "Existing Customer",
        nif: "5412345678",
      };

      mockDb.query.customersTable.findFirst.mockResolvedValue(existingCustomer as any);

      const res = await request(app)
        .post("/api/v1/customers")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Duplicate NIF Customer",
          nif: "5412345678",
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe("Cliente com este NIF já existe");
    });

    it("should return 409 for duplicate email", async () => {
      mockDb.$count.mockResolvedValue(0);

      const existingCustomer = {
        id: "cust-existing",
        code: "CL-00843",
        name: "Existing Customer",
        email: "dup@example.com",
      };

      mockDb.query.customersTable.findFirst.mockResolvedValue(existingCustomer as any);

      const res = await request(app)
        .post("/api/v1/customers")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Duplicate Email Customer",
          email: "dup@example.com",
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe("Cliente com este email já existe");
    });

    it("should return 400 with invalid data", async () => {
      const res = await request(app)
        .post("/api/v1/customers")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "" });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error", "Dados inválidos");
    });
  });

  describe("GET /api/v1/customers/:id", () => {
    it("should return customer with subscriptions and payments", async () => {
      const mockCustomer = {
        id: "cust-1",
        code: "CL-00843",
        name: "Customer One",
        email: "cust1@example.com",
        nif: "5412345678",
        state: "activo",
      };

      const mockSubscriptions = [
        {
          id: "sub-1",
          customerId: "cust-1",
          planId: "plan-1",
          startDate: new Date(),
          active: true,
        },
      ];

      const mockPayments = [
        {
          id: "pay-1",
          code: "TRX-81001",
          customerId: "cust-1",
          amount: 5000,
          status: "confirmado",
        },
      ];

      mockDb.query.customersTable.findFirst.mockResolvedValue(mockCustomer as any);
      mockDb.query.subscriptionsTable.findMany.mockResolvedValue(mockSubscriptions as any);
      mockDb.query.paymentsTable.findMany.mockResolvedValue(mockPayments as any);

      const res = await request(app)
        .get("/api/v1/customers/cust-1")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe("Customer One");
      expect(res.body.data.subscriptions).toHaveLength(1);
      expect(res.body.data.payments).toHaveLength(1);
    });

    it("should return 404 if customer not found", async () => {
      mockDb.query.customersTable.findFirst.mockResolvedValue(undefined as any);

      const res = await request(app)
        .get("/api/v1/customers/nonexistent")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Cliente não encontrado");
    });
  });
});

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

describe("Plans API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("GET /api/v1/plans", () => {
    it("should return plans list when authenticated", async () => {
      const mockPlans = [
        {
          id: "plan-1",
          name: "Basic Plan",
          description: "Basic access",
          price: 5000,
          periodicity: "mensal",
          duration: 30,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "plan-2",
          name: "Premium Plan",
          description: "Full access",
          price: 15000,
          periodicity: "mensal",
          duration: 30,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockDb.query.plansTable.findMany.mockResolvedValue(mockPlans as any);

      const res = await request(app)
        .get("/api/v1/plans")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.total).toBe(2);
      expect(res.body.data[0].name).toBe("Basic Plan");
      expect(res.body.data[0].price).toBe(5000);
    });

    it("should return 401 without authentication", async () => {
      const res = await request(app).get("/api/v1/plans");

      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/v1/plans", () => {
    it("should create a plan when authenticated", async () => {
      const mockPlan = {
        id: "plan-new",
        name: "New Plan",
        description: "New plan description",
        price: 10000,
        periodicity: "mensal",
        duration: null,
        active: true,
        ovgPlanId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockPlan]),
        }),
      } as any);

      const res = await request(app)
        .post("/api/v1/plans")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "New Plan",
          description: "New plan description",
          price: 10000,
          periodicity: "mensal",
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toEqual(
        expect.objectContaining({
          id: "plan-new",
          name: "New Plan",
          price: 10000,
        }),
      );
    });

    it("should return 400 with invalid data", async () => {
      const res = await request(app)
        .post("/api/v1/plans")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "", price: -1 });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error", "Dados inválidos");
    });
  });

  describe("PATCH /api/v1/plans/:id", () => {
    it("should update a plan when authenticated", async () => {
      const existingPlan = {
        id: "plan-1",
        name: "Old Plan",
        price: 5000,
        active: true,
      };

      const updatedPlan = {
        ...existingPlan,
        name: "Updated Plan",
        price: 8000,
        updatedAt: new Date(),
      };

      mockDb.query.plansTable.findFirst.mockResolvedValue(existingPlan as any);

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedPlan]),
          }),
        }),
      } as any);

      const res = await request(app)
        .patch("/api/v1/plans/plan-1")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "Updated Plan", price: 8000 });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe("Updated Plan");
      expect(res.body.data.price).toBe(8000);
    });

    it("should return 404 if plan not found", async () => {
      mockDb.query.plansTable.findFirst.mockResolvedValue(undefined as any);

      const res = await request(app)
        .patch("/api/v1/plans/nonexistent")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "Updated" });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Plano não encontrado");
    });
  });

  describe("PATCH /api/v1/plans/:id/toggle", () => {
    it("should toggle plan active status", async () => {
      const existingPlan = {
        id: "plan-1",
        name: "Test Plan",
        active: true,
      };

      const toggledPlan = {
        ...existingPlan,
        active: false,
        updatedAt: new Date(),
      };

      mockDb.query.plansTable.findFirst.mockResolvedValue(existingPlan as any);

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([toggledPlan]),
          }),
        }),
      } as any);

      const res = await request(app)
        .patch("/api/v1/plans/plan-1/toggle")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.active).toBe(false);
    });

    it("should toggle from inactive to active", async () => {
      const existingPlan = {
        id: "plan-1",
        name: "Test Plan",
        active: false,
      };

      const toggledPlan = {
        ...existingPlan,
        active: true,
        updatedAt: new Date(),
      };

      mockDb.query.plansTable.findFirst.mockResolvedValue(existingPlan as any);

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([toggledPlan]),
          }),
        }),
      } as any);

      const res = await request(app)
        .patch("/api/v1/plans/plan-1/toggle")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.active).toBe(true);
    });

    it("should return 404 if plan not found", async () => {
      mockDb.query.plansTable.findFirst.mockResolvedValue(undefined as any);

      const res = await request(app)
        .patch("/api/v1/plans/nonexistent/toggle")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Plano não encontrado");
    });
  });
});

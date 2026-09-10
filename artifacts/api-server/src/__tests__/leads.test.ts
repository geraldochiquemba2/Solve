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

const comercialToken = generateToken({
  userId: "comercial-uuid",
  role: "comercial",
  email: "comercial@example.com",
});

describe("Leads API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("GET /api/v1/leads", () => {
    it("should return leads list when authenticated", async () => {
      const mockLeads = [
        {
          id: "lead-1",
          code: "LD-24001",
          name: "Lead One",
          email: "lead1@example.com",
          status: "novo_lead",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "lead-2",
          code: "LD-24002",
          name: "Lead Two",
          email: "lead2@example.com",
          status: "contacto",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const chainable = {
        from: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockLeads),
        where: vi.fn().mockReturnThis(),
      };
      mockDb.select.mockReturnValue(chainable as any);

      const res = await request(app)
        .get("/api/v1/leads")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.total).toBe(2);
      expect(res.body.data[0].name).toBe("Lead One");
    });

    it("should return 401 without authentication", async () => {
      const res = await request(app).get("/api/v1/leads");

      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/v1/leads", () => {
    it("should create a lead when authenticated", async () => {
      mockDb.$count.mockResolvedValue(0);

      const mockLead = {
        id: "lead-new",
        code: "LD-24001",
        name: "New Lead",
        email: "newlead@example.com",
        phone: "+244900000000",
        company: "Test Corp",
        source: "website",
        status: "novo_lead",
        ownerId: null,
        estimatedValue: null,
        notes: null,
        ovgId: null,
        convertedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockLead]),
        }),
      } as any);

      const res = await request(app)
        .post("/api/v1/leads")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "New Lead",
          email: "newlead@example.com",
          phone: "+244900000000",
          company: "Test Corp",
          source: "website",
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toEqual(
        expect.objectContaining({
          id: "lead-new",
          name: "New Lead",
          code: "LD-24001",
        }),
      );
    });

    it("should return 401 without authentication", async () => {
      const res = await request(app)
        .post("/api/v1/leads")
        .send({ name: "New Lead" });

      expect(res.status).toBe(401);
    });

    it("should return 400 with invalid data", async () => {
      const res = await request(app)
        .post("/api/v1/leads")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "" });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error", "Dados inválidos");
    });
  });

  describe("PATCH /api/v1/leads/:id", () => {
    it("should update a lead when authenticated", async () => {
      const existingLead = {
        id: "lead-1",
        code: "LD-24001",
        name: "Old Name",
        status: "novo_lead",
      };

      const updatedLead = {
        ...existingLead,
        name: "Updated Name",
        status: "contacto",
        updatedAt: new Date(),
      };

      mockDb.query.leadsTable.findFirst.mockResolvedValue(existingLead as any);

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedLead]),
          }),
        }),
      } as any);

      const res = await request(app)
        .patch("/api/v1/leads/lead-1")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "Updated Name", status: "contacto" });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe("Updated Name");
      expect(res.body.data.status).toBe("contacto");
    });

    it("should return 404 if lead not found", async () => {
      mockDb.query.leadsTable.findFirst.mockResolvedValue(undefined as any);

      const res = await request(app)
        .patch("/api/v1/leads/nonexistent")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "Updated" });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Lead não encontrado");
    });
  });

  describe("DELETE /api/v1/leads/:id", () => {
    it("should delete a lead when authenticated as admin", async () => {
      const existingLead = {
        id: "lead-1",
        code: "LD-24001",
        name: "Lead to Delete",
      };

      mockDb.query.leadsTable.findFirst.mockResolvedValue(existingLead as any);
      mockDb.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      } as any);

      const res = await request(app)
        .delete("/api/v1/leads/lead-1")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(204);
    });

    it("should return 404 if lead not found", async () => {
      mockDb.query.leadsTable.findFirst.mockResolvedValue(undefined as any);

      const res = await request(app)
        .delete("/api/v1/leads/nonexistent")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Lead não encontrado");
    });

    it("should return 403 for unauthorized role", async () => {
      const existingLead = {
        id: "lead-1",
        code: "LD-24001",
        name: "Lead",
      };

      mockDb.query.leadsTable.findFirst.mockResolvedValue(existingLead as any);

      const res = await request(app)
        .delete("/api/v1/leads/lead-1")
        .set("Authorization", `Bearer ${comercialToken}`);

      expect(res.status).toBe(403);
    });
  });
});

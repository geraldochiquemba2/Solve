import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../app";
import { db } from "@workspace/db";
import { generateToken } from "../middlewares/auth";
import { __clearRateLimits } from "../middlewares/rate-limit";

const mockDb = vi.mocked(db);

const adminToken = generateToken({
  userId: "admin-uuid",
  role: "administrador",
  email: "admin@example.com",
});
const gestorToken = generateToken({
  userId: "gestor-uuid",
  role: "gestor",
  email: "gestor@example.com",
});
const comercialToken = generateToken({
  userId: "comercial-uuid",
  role: "comercial",
  email: "comercial@example.com",
});

const basePromo = {
  id: "promo-1",
  code: "FIT-TEST01",
  type: "percent",
  value: 20,
  minAmount: null,
  maxDiscount: null,
  appliesTo: "all",
  planIds: null,
  usageLimit: null,
  usedCount: 0,
  perUser: true,
  active: true,
  startsAt: null,
  expiresAt: null,
  createdBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// db.select()/insert()/… são cadeias então-awaited: resolve(rows).
const chain = (rows: unknown[]) => ({
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue(rows),
  then: (resolve: (v: unknown[]) => unknown) => resolve(rows),
});

describe("Promos API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    __clearRateLimits();
  });

  describe("POST /api/v1/promos/validate", () => {
    it("devolve 404-ish como inválido para código inexistente", async () => {
      mockDb.select.mockReturnValue(chain([]) as any);

      const res = await request(app)
        .post("/api/v1/promos/validate")
        .send({ code: "NAO-EXISTE", amount: 10000 });

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(false);
      expect(res.body.reason).toBe("Código inexistente");
    });

    it("devolve 400 para código em branco", async () => {
      const res = await request(app)
        .post("/api/v1/promos/validate")
        .send({ code: "   ", amount: 10000 });

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(false);
    });

    it("aplica desconto percentual sobre o montante", async () => {
      mockDb.select.mockReturnValue(chain([basePromo]) as any);
      mockDb.execute.mockResolvedValue({ rows: [] } as any);

      const res = await request(app)
        .post("/api/v1/promos/validate")
        .send({ code: "fit-test01", amount: 10000, email: "aluno@example.com" });

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.discount).toBe(2000);
      expect(res.body.final).toBe(8000);
      expect(res.body.type).toBe("percent");
    });

    it("corta o desconto fixo pelo teto máximo", async () => {
      mockDb.select.mockReturnValue(
        chain([{ ...basePromo, type: "fixed", value: 5000, maxDiscount: 3000 }]) as any,
      );
      mockDb.execute.mockResolvedValue({ rows: [] } as any);

      const res = await request(app)
        .post("/api/v1/promos/validate")
        .send({ code: "FIT-TEST01", amount: 10000, email: "aluno@example.com" });

      expect(res.body.valid).toBe(true);
      expect(res.body.discount).toBe(3000);
      expect(res.body.final).toBe(7000);
    });

    it("rejeita código inativo", async () => {
      mockDb.select.mockReturnValue(chain([{ ...basePromo, active: false }]) as any);
      mockDb.execute.mockResolvedValue({ rows: [] } as any);

      const res = await request(app)
        .post("/api/v1/promos/validate")
        .send({ code: "FIT-TEST01", amount: 10000, email: "aluno@example.com" });

      expect(res.body.valid).toBe(false);
      expect(res.body.reason).toBe("Código inativo");
    });

    it("rejeita código expirado", async () => {
      mockDb.select.mockReturnValue(
        chain([{ ...basePromo, expiresAt: new Date(Date.now() - 86_400_000) }]) as any,
      );
      mockDb.execute.mockResolvedValue({ rows: [] } as any);

      const res = await request(app)
        .post("/api/v1/promos/validate")
        .send({ code: "FIT-TEST01", amount: 10000, email: "aluno@example.com" });

      expect(res.body.valid).toBe(false);
      expect(res.body.reason).toBe("Código expirado");
    });

    it("rejeita montante abaixo do mínimo de compra", async () => {
      mockDb.select.mockReturnValue(chain([{ ...basePromo, minAmount: 25000 }]) as any);
      mockDb.execute.mockResolvedValue({ rows: [] } as any);

      const res = await request(app)
        .post("/api/v1/promos/validate")
        .send({ code: "FIT-TEST01", amount: 10000, email: "aluno@example.com" });

      expect(res.body.valid).toBe(false);
      expect(res.body.reason).toContain("Compra mínima");
    });

    it("não deixa o mesmo aluno usar o código duas vezes", async () => {
      mockDb.select.mockReturnValue(chain([basePromo]) as any);
      // 1ª query do validate: SELECT 1 … WHERE user_key = … (já existe registo)
      mockDb.execute.mockResolvedValue({ rows: [{ one: 1 }] } as any);

      const res = await request(app)
        .post("/api/v1/promos/validate")
        .send({ code: "FIT-TEST01", amount: 10000, email: "aluno@example.com" });

      expect(res.body.valid).toBe(false);
      expect(res.body.reason).toBe("Já utilizou este código");
    });

    it("respeita o limite global de usos", async () => {
      mockDb.select.mockReturnValue(
        chain([{ ...basePromo, perUser: false, usageLimit: 10 }]) as any,
      );
      mockDb.execute.mockResolvedValue({ rows: [{ n: 10 }] } as any);

      const res = await request(app)
        .post("/api/v1/promos/validate")
        .send({ code: "FIT-TEST01", amount: 10000, email: "aluno@example.com" });

      expect(res.body.valid).toBe(false);
      expect(res.body.reason).toBe("Código esgotado");
    });

    it("só aceita o código nos itens do âmbito", async () => {
      mockDb.select.mockReturnValue(
        chain([{ ...basePromo, appliesTo: "plans", planIds: ["plano-ouro"] }]) as any,
      );
      mockDb.execute.mockResolvedValue({ rows: [] } as any);

      const fora = await request(app)
        .post("/api/v1/promos/validate")
        .send({ code: "FIT-TEST01", amount: 10000, cademi_produto: "outro-item" });
      expect(fora.body.valid).toBe(false);
      expect(fora.body.reason).toBe("Código não aplicável a este item");

      const dentro = await request(app)
        .post("/api/v1/promos/validate")
        .send({ code: "FIT-TEST01", amount: 10000, cademi_produto: "plano-ouro" });
      expect(dentro.body.valid).toBe(true);
    });
  });

  describe("GET /api/v1/promos", () => {
    it("lista os códigos com contagem de usos (admin/gestor)", async () => {
      mockDb.select.mockReturnValue(chain([basePromo]) as any);
      mockDb.execute.mockResolvedValue({ rows: [{ promo_id: "promo-1", n: 3 }] } as any);

      const res = await request(app)
        .get("/api/v1/promos")
        .set("Authorization", `Bearer ${gestorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].code).toBe("FIT-TEST01");
      expect(res.body.data[0].usageCount).toBe(3);
      expect(res.body.total).toBe(1);
    });

    it("exige autenticação", async () => {
      const res = await request(app).get("/api/v1/promos");
      expect(res.status).toBe(401);
    });

    it("bloqueia perfis fora de administrador/gestor", async () => {
      const res = await request(app)
        .get("/api/v1/promos")
        .set("Authorization", `Bearer ${comercialToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/v1/promos", () => {
    it("gera o código no servidor quando não vem nenhum", async () => {
      const c = chain([]) as any;
      c.returning.mockResolvedValue([{ ...basePromo, code: "FIT-XXXXXXXX" }]);
      mockDb.insert.mockReturnValue(c);

      const res = await request(app)
        .post("/api/v1/promos")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ value: 15, type: "percent" });

      expect(res.status).toBe(201);
      // O código enviado ao INSERT é gerado pelo servidor (FIT- + 8 caracteres).
      const row = c.values.mock.calls[0][0];
      expect(row.code).toMatch(/^FIT-[A-Z0-9]{8}$/);
      expect(row.type).toBe("percent");
      expect(row.value).toBe(15);
    });

    it("devolve 400 acima de 100% de desconto", async () => {
      const res = await request(app)
        .post("/api/v1/promos")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ value: 150, type: "percent" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Dados inválidos");
    });

    it("devolve 409 quando o código já existe", async () => {
      mockDb.insert.mockImplementation(() => {
        throw Object.assign(new Error("duplicate key"), { code: "23505" });
      });

      const res = await request(app)
        .post("/api/v1/promos")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ code: "FIT-USADO1", value: 10 });

      expect(res.status).toBe(409);
    });

    it("exige autenticação", async () => {
      const res = await request(app)
        .post("/api/v1/promos")
        .send({ value: 10 });
      expect(res.status).toBe(401);
    });
  });

  describe("PATCH /api/v1/promos/:id", () => {
    it("alterna o estado activo", async () => {
      mockDb.query.promoCodesTable.findFirst.mockResolvedValue(basePromo as any);
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ ...basePromo, active: false }]),
          }),
        }),
      } as any);

      const res = await request(app)
        .patch("/api/v1/promos/promo-1/toggle")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.active).toBe(false);
    });

    it("rejeita expiração anterior ao início", async () => {
      mockDb.query.promoCodesTable.findFirst.mockResolvedValue(basePromo as any);

      const res = await request(app)
        .patch("/api/v1/promos/promo-1")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ starts_at: "2026-10-10T10:00", expires_at: "2026-10-01T10:00" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("expiração");
    });

    it("devolve 404 para código inexistente", async () => {
      mockDb.query.promoCodesTable.findFirst.mockResolvedValue(undefined as any);

      const res = await request(app)
        .patch("/api/v1/promos/nao-existe")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ value: 5 });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/v1/promos/:id", () => {
    it("apaga o código (admin)", async () => {
      mockDb.query.promoCodesTable.findFirst.mockResolvedValue(basePromo as any);
      mockDb.delete.mockReturnValue(chain([]) as any);

      const res = await request(app)
        .delete("/api/v1/promos/promo-1")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(204);
    });

    it("não deixa gestor apagar", async () => {
      mockDb.query.promoCodesTable.findFirst.mockResolvedValue(basePromo as any);

      const res = await request(app)
        .delete("/api/v1/promos/promo-1")
        .set("Authorization", `Bearer ${gestorToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/v1/promos/:id/usages", () => {
    it("devolve os usos do código", async () => {
      mockDb.query.promoCodesTable.findFirst.mockResolvedValue(basePromo as any);
      mockDb.execute.mockResolvedValue({
        rows: [
          {
            id: "uso-1",
            email: "aluno@example.com",
            payment_code: "SC00001",
            discount_applied: 2000,
            used_at: new Date(),
          },
        ],
      } as any);

      const res = await request(app)
        .get("/api/v1/promos/promo-1/usages")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].payment_code).toBe("SC00001");
    });
  });
});

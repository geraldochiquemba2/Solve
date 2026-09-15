import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import app from "../app";
import { db } from "@workspace/db";
import { generateToken } from "../middlewares/auth";
import { generatePortalToken } from "../middlewares/portal-auth";
import { __clearRateLimits } from "../middlewares/rate-limit";
import { __clearPortalRateLimit } from "../routes/portal-auth";

// ─── VIGILANTE QA · Portal do Cliente ─────────────────────────────────────────
// Contrato coberto (mesmo padrão supertest+mock de auth.test.ts / payments.test.ts):
//   POST /api/v1/portal/otp/request  (ok / número inexistente / inactiva / rate-limit)
//   POST /api/v1/portal/otp/verify   (ok / errado / expirado / consumido / tentativas)
//   GET  /api/v1/portal/minha-conta  (401 sem token / 403 token staff / 200 cliente)
//   GET  /api/v1/portal/pagamentos   + POST /api/v1/portal/pagar (cria pendente)
//   GET  /api/v1/portal/recibos/:id  (ok / 404 de outro cliente)
//   Cruzado: token cliente em rota staff deve ser 403; staff no portal deve ser 403.
//
// Budgets de rate-limit (memória, por processo de teste) são limpos em
// beforeEach via __clearRateLimits + __clearPortalRateLimit.

const mockDb = vi.mocked(db);

const JWT_SECRET = process.env.JWT_SECRET || "solve-corporate-crm-secret";

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

const staffToken = generateToken({
  userId: "staff-uuid",
  role: "administrador",
  email: "admin@example.com",
});

const clienteToken = generatePortalToken("cust-1", "+244934000001");

const activeCustomer = {
  id: "cust-1",
  code: "CL-001",
  name: "Maria dos Santos",
  email: "maria@example.com",
  phone: "+244934000001",
  whatsappPhone: null,
  state: "activo",
  ovgId: null,
};

const activeSub = {
  id: "sub-1",
  customerId: "cust-1",
  planId: "plan-1",
  startDate: new Date("2026-08-01"),
  endDate: new Date("2026-09-01"),
  active: true,
};

const monthlyPlan = {
  id: "plan-1",
  name: "Mensal",
  price: 15000,
  periodicity: "mensal",
  duration: 12,
};

function mockUpdate() {
  (mockDb.update as any).mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  __clearRateLimits();
  __clearPortalRateLimit();
  // Força modo DEV no OTP (sem tentativa de rede WhatsApp).
  process.env.WHATSAPP_TOKEN = "";
});

describe("Portal OTP · POST /api/v1/portal/otp/request", () => {
  it("request ok: 200, sem OTP em claro na DB (só hash sha256)", async () => {
    (mockDb.query.customersTable.findFirst as any).mockResolvedValue(activeCustomer);

    let stored: any = null;
    (mockDb.insert as any).mockReturnValue({
      values: (v: any) => {
        stored = v;
        return {};
      },
    });

    const res = await request(app)
      .post("/api/v1/portal/otp/request")
      .send({ phone: "934000001" });

    expect(res.status).toBe(200);
    expect(stored).not.toBeNull();
    expect(stored.codeHash).toMatch(/^[a-f0-9]{64}$/);
    // O hash guardado tem de corresponder ao devCode devolvido (prova de
    // comparação por hash) e nunca igualar o código em claro.
    if (res.body.devCode) {
      expect(res.body.devCode).toMatch(/^\d{6}$/);
      expect(stored.codeHash).toBe(sha256(res.body.devCode));
      expect(stored.codeHash).not.toBe(res.body.devCode);
    }
  });

  it("número inexistente: 404 sem enumerar dados", async () => {
    (mockDb.query.customersTable.findFirst as any).mockResolvedValue(undefined);

    const res = await request(app)
      .post("/api/v1/portal/otp/request")
      .send({ phone: "934000099" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Número não registado como cliente");
  });

  it("conta inactiva: 403", async () => {
    (mockDb.query.customersTable.findFirst as any).mockResolvedValue({
      ...activeCustomer,
      state: "inactivo",
    });

    const res = await request(app)
      .post("/api/v1/portal/otp/request")
      .send({ phone: "934000001" });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Conta de cliente inactiva");
  });

  it("6º pedido na mesma hora para o mesmo número: 429", async () => {
    (mockDb.query.customersTable.findFirst as any).mockResolvedValue(activeCustomer);
    (mockDb.insert as any).mockReturnValue({ values: () => ({}) });

    const phone = "935000001";
    let lastStatus = 0;
    for (let i = 0; i < 6; i++) {
      const res = await request(app)
        .post("/api/v1/portal/otp/request")
        .send({ phone });
      lastStatus = res.status;
      if (i < 5) expect(res.status).toBe(200);
    }
    expect(lastStatus).toBe(429);
  });
});

describe("Portal OTP · POST /api/v1/portal/otp/verify", () => {
  const validOtp = (overrides: any = {}) => ({
    id: "otp-1",
    phone: "+244934000001",
    codeHash: sha256("123456"),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    attempts: 0,
    consumed: false,
    createdAt: new Date(),
    ...overrides,
  });

  it("verify ok: 200 + JWT role=cliente + one-time (consumed)", async () => {
    (mockDb.query.portalOtpsTable.findFirst as any).mockResolvedValue(validOtp());
    (mockDb.query.customersTable.findFirst as any).mockResolvedValue(activeCustomer);
    mockUpdate();

    const res = await request(app)
      .post("/api/v1/portal/otp/verify")
      .send({ phone: "934000001", code: "123456" });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
    // Token tem de ser JWT válido com role=cliente (nunca role staff).
    const decoded: any = jwt.verify(res.body.token, JWT_SECRET);
    expect(decoded.role).toBe("cliente");
    expect(decoded.customerId).toBe("cust-1");
    expect(res.body.customer).toEqual(
      expect.objectContaining({ id: "cust-1", name: "Maria dos Santos" }),
    );
  });

  it("código errado: 400 e conta tentativa", async () => {
    (mockDb.query.portalOtpsTable.findFirst as any).mockResolvedValue(validOtp());
    mockUpdate();

    const res = await request(app)
      .post("/api/v1/portal/otp/verify")
      .send({ phone: "934000001", code: "000000" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Código inválido");
  });

  it("código expirado: 400", async () => {
    (mockDb.query.portalOtpsTable.findFirst as any).mockResolvedValue(
      validOtp({ expiresAt: new Date(Date.now() - 1000) }),
    );
    mockUpdate();

    const res = await request(app)
      .post("/api/v1/portal/otp/verify")
      .send({ phone: "934000001", code: "123456" });

    expect(res.status).toBe(400);
  });

  it("código já consumido: 400 (reutilização bloqueada)", async () => {
    // A query filtra consumed=false: OTP usado já não é devolvido.
    (mockDb.query.portalOtpsTable.findFirst as any).mockResolvedValue(undefined);
    mockUpdate();

    const res = await request(app)
      .post("/api/v1/portal/otp/verify")
      .send({ phone: "934000001", code: "123456" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Código inválido ou expirado");
  });

  it("3 tentativas erradas: 429 pede novo código (anti brute-force)", async () => {
    (mockDb.query.portalOtpsTable.findFirst as any).mockResolvedValue(
      validOtp({ attempts: 3 }),
    );
    mockUpdate();

    const res = await request(app)
      .post("/api/v1/portal/otp/verify")
      .send({ phone: "934000001", code: "123456" });

    expect(res.status).toBe(429);
  });
});

describe("Portal Conta · GET /api/v1/portal/minha-conta", () => {
  it("sem token: 401", async () => {
    const res = await request(app).get("/api/v1/portal/minha-conta");
    expect(res.status).toBe(401);
  });

  it("token staff: 403 (nunca acede ao portal)", async () => {
    const res = await request(app)
      .get("/api/v1/portal/minha-conta")
      .set("Authorization", `Bearer ${staffToken}`);
    expect(res.status).toBe(403);
  });

  it("token cliente: 200 com conta + subscrição + aulas", async () => {
    (mockDb.query.customersTable.findFirst as any).mockResolvedValue(activeCustomer);
    (mockDb.query.subscriptionsTable.findMany as any).mockResolvedValue([activeSub]);
    (mockDb.query.plansTable.findFirst as any).mockResolvedValue(monthlyPlan);

    const res = await request(app)
      .get("/api/v1/portal/minha-conta")
      .set("Authorization", `Bearer ${clienteToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.customer).toEqual(
      expect.objectContaining({ id: "cust-1", name: "Maria dos Santos" }),
    );
    expect(res.body.data.subscription).toEqual(
      expect.objectContaining({ planName: "Mensal", price: 15000 }),
    );
    expect(res.body.data.aulas).toEqual(expect.objectContaining({ limite: 12 }));
  });
});

describe("Isolamento cruzado staff ↔ portal", () => {
  it("token cliente em rota staff de leitura (GET /payments/:id): 403", async () => {
    (mockDb.query.paymentsTable.findFirst as any).mockResolvedValue({
      id: "pay-1",
      code: "TRX-81001",
      customerId: "outro-cliente",
      amount: 5000,
      status: "confirmado",
    });
    // Contrato: role=cliente nunca acede a rotas staff, nem às de leitura.
    // (Usa /payments/:id porque /payments lista via join não mockável;
    // o ponto é o mesmo: sem authorize, o token cliente passa.)
    const res = await request(app)
      .get("/api/v1/payments/pay-1")
      .set("Authorization", `Bearer ${clienteToken}`);
    expect(res.status).toBe(403);
  });

  it("token cliente em rota staff de escrita (POST /payments): 403", async () => {
    const res = await request(app)
      .post("/api/v1/payments")
      .set("Authorization", `Bearer ${clienteToken}`)
      .send({
        customerId: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
        amount: 5000,
        method: "transferencia",
      });
    expect(res.status).toBe(403);
  });
});

describe("Portal Pagamentos · /api/v1/portal/pagamentos + /pagar + /recibos/:id", () => {
  it("sem token: 401", async () => {
    const res = await request(app).get("/api/v1/portal/pagamentos");
    expect(res.status).toBe(401);
  });

  it("cliente lista só os seus pagamentos: 200", async () => {
    (mockDb.query.paymentsTable.findMany as any).mockResolvedValue([
      { id: "pay-1", code: "SC81001", customerId: "cust-1", amount: 15000, status: "confirmado" },
      { id: "pay-2", code: "SC81002", customerId: "cust-1", amount: 15000, status: "pendente" },
    ]);

    const res = await request(app)
      .get("/api/v1/portal/pagamentos")
      .set("Authorization", `Bearer ${clienteToken}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data[0]).toEqual(expect.objectContaining({ customerId: "cust-1" }));
  });

  it("pagar por referência: 201 cria pagamento pendente", async () => {
    (mockDb.query.customersTable.findFirst as any).mockResolvedValue(activeCustomer);
    (mockDb.query.subscriptionsTable.findMany as any).mockResolvedValue([activeSub]);
    (mockDb.query.plansTable.findFirst as any).mockResolvedValue(monthlyPlan);
    (mockDb.$count as any).mockResolvedValue(5);
    const mockPayment = {
      id: "pay-new",
      code: "SC81006",
      customerId: "cust-1",
      subscriptionId: "sub-1",
      amount: 15000,
      method: "referencia",
      status: "pendente",
      referenceCode: "SC81006",
    };
    (mockDb.insert as any).mockReturnValue({
      values: () => ({ returning: () => Promise.resolve([mockPayment]) }),
    });

    const res = await request(app)
      .post("/api/v1/portal/pagar")
      .set("Authorization", `Bearer ${clienteToken}`)
      .send({ method: "referencia" });

    expect(res.status).toBe(201);
    expect(res.body.data.payment).toEqual(
      expect.objectContaining({ status: "pendente", amount: 15000 }),
    );
    expect(res.body.data.referencia).toEqual(
      expect.objectContaining({ reference: "SC81006" }),
    );
  });

  it("pagar com método inválido: 400 (zod)", async () => {
    const res = await request(app)
      .post("/api/v1/portal/pagar")
      .set("Authorization", `Bearer ${clienteToken}`)
      .send({ method: "sms" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Dados inválidos");
  });

  it("recibo próprio: 200; recibo de outro cliente: 404", async () => {
    const paymentId = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
    const payment = {
      id: paymentId,
      code: "SC81001",
      customerId: "cust-1",
      subscriptionId: "sub-1",
      amount: 15000,
      status: "confirmado",
    };
    const q: any = mockDb.query.paymentsTable.findFirst;
    q.mockResolvedValueOnce(payment); // recibo próprio: encontra
    q.mockResolvedValueOnce(undefined); // recibo alheio: filtro customerId não bate
    (mockDb.query.customersTable.findFirst as any).mockResolvedValue(activeCustomer);
    (mockDb.query.subscriptionsTable.findFirst as any).mockResolvedValue(activeSub);
    (mockDb.query.plansTable.findFirst as any).mockResolvedValue(monthlyPlan);

    const ok = await request(app)
      .get(`/api/v1/portal/recibos/${paymentId}`)
      .set("Authorization", `Bearer ${clienteToken}`);
    expect(ok.status).toBe(200);
    expect(ok.body.data.payment).toEqual(expect.objectContaining({ code: "SC81001" }));

    const other = await request(app)
      .get("/api/v1/portal/recibos/b1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d")
      .set("Authorization", `Bearer ${clienteToken}`);
    expect(other.status).toBe(404);
  });
});

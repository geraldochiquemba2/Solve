import crypto from "node:crypto";

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 3;
const OTP_RESEND_MS = 30 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function digits(value) {
  return String(value || "").replace(/\D/g, "");
}

function localPhone(value) {
  let d = digits(value);
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("244")) d = d.slice(3);
  return d;
}

function phoneCandidates(value) {
  const d = digits(value);
  const local = localPhone(value);
  return [...new Set([d, local, local ? `244${local}` : ""].filter(Boolean))];
}

function hashOtp(phone, code) {
  return crypto.createHash("sha256").update(`${localPhone(phone)}:${String(code)}`).digest("hex");
}

function safeCode(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 6);
}

function mapPayment(row) {
  return {
    id: row.id,
    code: row.code,
    amount: row.amount,
    method: row.method,
    status: row.status,
    reference_code: row.reference_code,
    referencia: row.reference_code,
    entity: row.entity,
    entidade: row.entity,
    created_at: row.created_at,
    paid_at: row.paid_at,
    expires_at: row.expires_at,
  };
}

export function createPortalRoutes({
  app,
  pool,
  jwt,
  jwtSecret,
  whatsapp,
  automation,
  rateLimit,
  rateLimitBy,
  ensurePromoSchema,
  validatePromo,
  promoUserKey,
  fireEkwanzaCharge,
  kickCademiDelivery,
  cfg,
  audit,
}) {
  async function ensureSchema() {
    await pool.query(`CREATE TABLE IF NOT EXISTS portal_otps (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      phone VARCHAR(50) NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      consumed BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query("CREATE INDEX IF NOT EXISTS portal_otps_phone_created_idx ON portal_otps (phone, created_at DESC)");
  }

  function portalAuth(req, res, next) {
    const header = req.headers.authorization || "";
    if (!header.startsWith("Bearer ")) return res.status(401).json({ error: "Sessão do portal necessária" });
    if (!jwtSecret) return res.status(503).json({ error: "Servidor sem segredo configurado" });
    try {
      const decoded = jwt.verify(header.slice(7), jwtSecret, { audience: "portal" });
      if (!decoded || decoded.role !== "cliente" || !decoded.customerId) {
        return res.status(401).json({ error: "Sessão inválida" });
      }
      req.portal = decoded;
      next();
    } catch {
      return res.status(401).json({ error: "Sessão expirada. Faz login de novo." });
    }
  }

  async function findCustomerByPhone(phone) {
    const candidates = phoneCandidates(phone);
    if (!candidates.length) return null;
    const r = await pool.query(
      `SELECT * FROM customers
        WHERE regexp_replace(COALESCE(phone,''), '\\D', '', 'g') = ANY($1::text[])
           OR regexp_replace(COALESCE(whatsapp_phone,''), '\\D', '', 'g') = ANY($1::text[])
        ORDER BY CASE WHEN state = 'activo' THEN 0 ELSE 1 END, created_at DESC
        LIMIT 1`,
      [candidates]
    );
    return r.rows[0] || null;
  }

  const otpPhoneKey = (req) => {
    const p = localPhone(req.body?.phone);
    return p ? `portal_otp:${p}` : null;
  };

  app.use("/api/v1/portal", (_req, res, next) => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.set("Pragma", "no-cache");
    next();
  });

  app.post(
    "/api/v1/portal/otp/request",
    rateLimit(20),
    rateLimitBy(5, 60 * 60 * 1000, otpPhoneKey, "Demasiados códigos pedidos. Tenta novamente mais tarde."),
    async (req, res) => {
      const phone = localPhone(req.body?.phone);
      if (!/^9\d{8}$/.test(phone)) {
        return res.status(400).json({ error: "Número de telemóvel inválido (usa 9XXXXXXXX)" });
      }
      try {
        const last = await pool.query(
          "SELECT created_at FROM portal_otps WHERE phone = $1 AND consumed = FALSE ORDER BY created_at DESC LIMIT 1",
          [phone]
        );
        if (last.rows[0] && Date.now() - new Date(last.rows[0].created_at).getTime() < OTP_RESEND_MS) {
          return res.status(429).json({ error: "Aguarda 30 segundos antes de pedir outro código." });
        }
        const customer = await findCustomerByPhone(phone);
        const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
        await pool.query("UPDATE portal_otps SET consumed = TRUE WHERE phone = $1 AND consumed = FALSE", [phone]);
        await pool.query(
          `INSERT INTO portal_otps (phone, code_hash, expires_at)
           VALUES ($1, $2, NOW() + ($3::int * INTERVAL '1 millisecond'))`,
          [phone, hashOtp(phone, code), OTP_TTL_MS]
        );
        await pool.query("DELETE FROM portal_otps WHERE created_at < NOW() - INTERVAL '2 days'").catch(() => {});
        if (customer && !["inactivo", "suspenso"].includes(customer.state)) {
          const sent = await whatsapp.sendOtp(phone, code);
          audit(req, "portal.otp_requested", {
            entity: "customer",
            entityId: customer.id,
            details: { phone: phone.slice(0, 3) + "***" + phone.slice(-2), sent: sent.ok },
          });
          if (!sent.ok) {
            console.error("[PORTAL] OTP não enviado:", sent.error);
          }
          if (process.env.NODE_ENV !== "production" && (!sent.ok || process.env.PORTAL_OTP_DEV_CODE === "true")) {
            return res.json({ data: { ok: true, expiresIn: 300, devCode: code } });
          }
        }
        return res.json({ data: { ok: true, expiresIn: 300 } });
      } catch (err) {
        console.error("[PORTAL] otp request:", err.message);
        return res.status(500).json({ error: "Não foi possível pedir o código. Tenta novamente." });
      }
    }
  );

  app.post(
    "/api/v1/portal/otp/verify",
    rateLimit(30),
    rateLimitBy(10, 15 * 60 * 1000, otpPhoneKey, "Demasiadas tentativas. Aguarda alguns minutos."),
    async (req, res) => {
      const phone = localPhone(req.body?.phone);
      const code = safeCode(req.body?.code);
      if (!/^9\d{8}$/.test(phone) || code.length !== 6) {
        return res.status(400).json({ error: "Número ou código inválido" });
      }
      if (!jwtSecret) return res.status(503).json({ error: "Servidor sem segredo configurado" });
      try {
        const r = await pool.query(
          `SELECT * FROM portal_otps
            WHERE phone = $1 AND consumed = FALSE
            ORDER BY created_at DESC LIMIT 1`,
          [phone]
        );
        const otp = r.rows[0];
        if (!otp) return res.status(400).json({ error: "Código inválido ou expirado" });
        if (new Date(otp.expires_at).getTime() < Date.now()) {
          await pool.query("UPDATE portal_otps SET consumed = TRUE WHERE id = $1", [otp.id]);
          return res.status(400).json({ error: "Código expirado. Pede um novo." });
        }
        if (Number(otp.attempts) >= OTP_MAX_ATTEMPTS) {
          await pool.query("UPDATE portal_otps SET consumed = TRUE WHERE id = $1", [otp.id]);
          return res.status(429).json({ error: "Código bloqueado por demasiadas tentativas. Pede um novo." });
        }
        const expected = Buffer.from(String(otp.code_hash));
        const received = Buffer.from(hashOtp(phone, code));
        if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
          await pool.query("UPDATE portal_otps SET attempts = attempts + 1 WHERE id = $1", [otp.id]);
          audit(req, "portal.otp_failed", { details: { phone: phone.slice(0, 3) + "***" + phone.slice(-2) } });
          return res.status(400).json({ error: "Código inválido" });
        }
        const customer = await findCustomerByPhone(phone);
        if (!customer || ["inactivo", "suspenso"].includes(customer.state)) {
          await pool.query("UPDATE portal_otps SET consumed = TRUE WHERE id = $1", [otp.id]);
          return res.status(403).json({ error: "Conta indisponível. Contacta o suporte." });
        }
        await pool.query("UPDATE portal_otps SET consumed = TRUE WHERE id = $1", [otp.id]);
        const token = jwt.sign(
          { role: "cliente", customerId: customer.id, phone, aud: "portal" },
          jwtSecret,
          { expiresIn: "12h" }
        );
        audit(req, "portal.login", { entity: "customer", entityId: customer.id });
        return res.json({
          data: {
            token,
            customer: {
              id: customer.id,
              code: customer.code,
              name: customer.name,
              phone: customer.phone || `+244${phone}`,
              email: customer.email,
              state: customer.state,
            },
          },
        });
      } catch (err) {
        console.error("[PORTAL] otp verify:", err.message);
        return res.status(500).json({ error: "Não foi possível validar o código. Tenta novamente." });
      }
    }
  );

  app.post("/api/v1/portal/logout", portalAuth, (_req, res) => {
    res.json({ data: { ok: true } });
  });

  app.get("/api/v1/portal/minha-conta", portalAuth, async (req, res) => {
    try {
      const cr = await pool.query("SELECT * FROM customers WHERE id = $1", [req.portal.customerId]);
      const customer = cr.rows[0];
      if (!customer) return res.status(404).json({ error: "Conta não encontrada" });
      const sr = await pool.query(
        `SELECT s.*, p.name AS plan_name, p.price, p.periodicity
           FROM subscriptions s
           JOIN plans p ON p.id = s.plan_id
          WHERE s.customer_id = $1
          ORDER BY s.active DESC, s.end_date DESC NULLS LAST, s.created_at DESC
          LIMIT 1`,
        [customer.id]
      );
      const sub = sr.rows[0] || null;
      const usadas = Number(sub?.lessons_done || 0);
      const limite = sub?.lessons_total == null ? null : Number(sub.lessons_total);
      const restantes = limite == null ? null : Math.max(limite - usadas, 0);
      const proxima = sub && sub.price != null && sub.end_date
        ? { amount: Number(sub.price), dueDate: sub.end_date }
        : null;
      res.json({
        data: {
          customer: {
            id: customer.id,
            code: customer.code,
            name: customer.name,
            phone: customer.phone,
            email: customer.email,
            state: customer.state,
          },
          subscription: sub ? {
            id: sub.id,
            planId: sub.plan_id,
            planName: sub.plan_name,
            price: sub.price == null ? null : Number(sub.price),
            periodicity: sub.periodicity,
            startDate: sub.start_date,
            endDate: sub.end_date,
            active: sub.active,
          } : null,
          aulas: { usadas, limite, restantes, fonte: sub ? "subscription" : "sem_plano" },
          proximaMensalidade: proxima,
        },
      });
    } catch (err) {
      console.error("[PORTAL] minha-conta:", err.message);
      res.status(500).json({ error: "Erro ao carregar a conta" });
    }
  });

  app.get("/api/v1/portal/pagamentos", portalAuth, async (req, res) => {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
    try {
      const r = await pool.query(
        `SELECT * FROM payments WHERE customer_id = $1 ORDER BY created_at DESC LIMIT $2`,
        [req.portal.customerId, limit]
      );
      res.json({ data: r.rows.map(mapPayment) });
    } catch (err) {
      console.error("[PORTAL] pagamentos:", err.message);
      res.status(500).json({ error: "Erro ao carregar pagamentos" });
    }
  });

  app.post("/api/v1/portal/pagar", rateLimit(20), portalAuth, async (req, res) => {
    try {
      const method = String(req.body?.method || "");
      if (!["express", "referencia"].includes(method)) {
        return res.status(400).json({ error: "Método inválido" });
      }
      const customerId = req.portal.customerId;
      const cr = await pool.query("SELECT * FROM customers WHERE id = $1", [customerId]);
      const customer = cr.rows[0];
      if (!customer) return res.status(404).json({ error: "Conta não encontrada" });
      const pending = await pool.query(
        `SELECT code FROM payments
          WHERE customer_id = $1 AND status = 'pendente'
            AND (expires_at IS NULL OR expires_at > NOW())
          ORDER BY created_at DESC LIMIT 1`,
        [customerId]
      );
      if (pending.rows[0]) {
        return res.status(409).json({
          error: `Já tens um pagamento pendente (${pending.rows[0].code}). Paga ou cancela antes de gerar outro.`,
          code: pending.rows[0].code,
        });
      }
      let sub = null;
      if (req.body?.subscriptionId) {
        if (!UUID_RE.test(String(req.body.subscriptionId))) {
          return res.status(400).json({ error: "Subscrição inválida" });
        }
        const sr = await pool.query(
          "SELECT * FROM subscriptions WHERE id = $1 AND customer_id = $2",
          [req.body.subscriptionId, customerId]
        );
        sub = sr.rows[0] || null;
        if (!sub) return res.status(404).json({ error: "Subscrição não encontrada" });
      } else {
        const sr = await pool.query(
          `SELECT * FROM subscriptions WHERE customer_id = $1
            ORDER BY active DESC, end_date DESC NULLS LAST, created_at DESC LIMIT 1`,
          [customerId]
        );
        sub = sr.rows[0] || null;
      }
      if (!sub) return res.status(404).json({ error: "Sem subscrição ativa para pagar" });
      const pr = await pool.query("SELECT * FROM plans WHERE id = $1", [sub.plan_id]);
      const plan = pr.rows[0];
      if (!plan) return res.status(404).json({ error: "Plano não encontrado" });
      let amount = Number(plan.price);
      if (!Number.isFinite(amount) || amount < 0) return res.status(400).json({ error: "Preço do plano inválido" });
      let promoApplied = null;
      let autoConfirm = false;
      if (req.body?.promoCode) {
        await ensurePromoSchema();
        const v = await validatePromo({
          code: req.body.promoCode,
          base: amount,
          email: customer.email,
          phone: customer.phone || req.portal.phone,
          planIds: [plan.id],
        });
        if (!v.valid) return res.status(400).json({ error: v.reason || "Código promocional inválido", promo_invalid: true });
        promoApplied = {
          code: String(req.body.promoCode).trim().toUpperCase(),
          code_id: v.promo.id,
          original: v.original,
          discount: v.discount,
          final: v.final,
          type: v.promo.type,
          value: Number(v.promo.value),
        };
        amount = Number(v.final);
        if (amount <= 0) {
          amount = 0;
          autoConfirm = true;
        }
      }
      const phone = localPhone(req.portal.phone || customer.whatsapp_phone || customer.phone);
      if (method === "express" && !/^9\d{8}$/.test(localPhone(req.body?.phoneNumber || phone))) {
        return res.status(400).json({ error: "Número de telemóvel inválido para Multicaixa Express (usa 9XXXXXXXX)" });
      }
      const code = `SC${Date.now().toString(36).toUpperCase()}`;
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const meta = {
        phone: phone || null,
        email: customer.email || null,
        name: customer.name || null,
        source: "portal",
        description: `Mensalidade ${plan.name}`,
        portal_subscription_id: sub.id,
      };
      if (promoApplied) meta.promo = promoApplied;
      const initialStatus = autoConfirm ? "confirmado" : "pendente";
      const ins = await pool.query(
        `INSERT INTO payments (code, customer_id, subscription_id, amount, method, status, reference_code, metadata, expires_at, paid_at)
         VALUES ($1,$2,$3,$4,$5,$6,$1,$7::jsonb,$8,$9)
         RETURNING *`,
        [
          code,
          customerId,
          sub.id,
          amount,
          method === "express" ? "mcx_express" : "referencia",
          initialStatus,
          JSON.stringify(meta),
          expiresAt,
          autoConfirm ? new Date() : null,
        ]
      );
      let payment = ins.rows[0];
      if (promoApplied) {
        try {
          const userKey = promoUserKey({ email: customer.email, phone });
          await pool.query(
            `INSERT INTO promo_usages (promo_id, user_key, customer_id, email, phone, payment_code, amount_before, amount_after, discount_applied)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [promoApplied.code_id, userKey, customerId, customer.email || null, phone || null, code, promoApplied.original, promoApplied.final, promoApplied.discount]
          );
          await pool.query("UPDATE promo_codes SET used_count = COALESCE(used_count,0) + 1, updated_at = NOW() WHERE id = $1", [promoApplied.code_id]);
        } catch (err) {
          console.error("[PORTAL] promo usage:", err.message);
        }
      }
      if (!autoConfirm) {
        await automation.enqueue(
          "payment_pending",
          { paymentId: payment.id, code, customerId, customerName: customer.name, phone: customer.phone, whatsapp: customer.whatsapp_phone, amount, planName: plan.name, subscriptionId: sub.id },
          { dedupeKey: `payment_pending:${code}` }
        ).catch(() => {});
      }
      let express = null;
      let referencia = null;
      if (autoConfirm) {
        kickCademiDelivery(code);
      } else if (method === "express") {
        const chargePhone = localPhone(req.body?.phoneNumber || phone);
        setImmediate(() => {
          fireEkwanzaCharge({
            code,
            paymentId: payment.id,
            amt: amount,
            m: "mcx_express",
            customer_phone: chargePhone,
            description: `Mensalidade ${plan.name}`,
          }).catch((err) => console.error("[PORTAL] express:", err.message));
        });
        express = { initiated: true };
      } else {
        const result = await fireEkwanzaCharge({
          code,
          paymentId: payment.id,
          amt: amount,
          m: "referencia",
          customer_phone: phone || null,
          description: `Mensalidade ${plan.name}`,
        });
        const fresh = await pool.query("SELECT * FROM payments WHERE code = $1", [code]);
        payment = fresh.rows[0] || payment;
        if (!result.ok || !payment.reference_code) {
          await pool.query("UPDATE payments SET status='rejeitado', updated_at=NOW() WHERE code=$1 AND status='pendente'", [code]).catch(() => {});
          return res.status(502).json({ error: result.error || "Não foi possível gerar a referência de pagamento" });
        }
        referencia = {
          entity: payment.entity || null,
          reference: payment.reference_code,
          expiresAt: payment.metadata?.dueDate || payment.expires_at || expiresAt,
        };
      }
      res.status(201).json({
        data: {
          payment: { id: payment.id, code: payment.code, status: payment.status, amount: payment.amount },
          express,
          referencia,
          promo: promoApplied ? { code: promoApplied.code, original: promoApplied.original, discount: promoApplied.discount, final: promoApplied.final } : null,
        },
      });
    } catch (err) {
      console.error("[PORTAL] pagar:", err.message);
      res.status(500).json({ error: "Erro ao criar pagamento" });
    }
  });

  app.get("/api/v1/portal/recibos/:id", portalAuth, async (req, res) => {
    if (!UUID_RE.test(String(req.params.id))) return res.status(400).json({ error: "Recibo inválido" });
    try {
      const r = await pool.query(
        `SELECT p.*, c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email,
                s.plan_id, s.start_date, s.end_date, s.active AS subscription_active,
                pl.name AS plan_name, pl.price AS plan_price, pl.periodicity AS plan_periodicity
           FROM payments p
           JOIN customers c ON c.id = p.customer_id
           LEFT JOIN subscriptions s ON s.id = p.subscription_id
           LEFT JOIN plans pl ON pl.id = s.plan_id
          WHERE p.id = $1 AND p.customer_id = $2 AND p.status = 'confirmado'`,
        [req.params.id, req.portal.customerId]
      );
      const row = r.rows[0];
      if (!row) return res.status(404).json({ error: "Recibo não encontrado" });
      res.json({
        data: {
          payment: mapPayment(row),
          customer: { id: row.customer_id, name: row.customer_name, phone: row.customer_phone, email: row.customer_email },
          subscription: row.subscription_id ? {
            id: row.subscription_id,
            planName: row.plan_name,
            price: row.plan_price == null ? null : Number(row.plan_price),
            periodicity: row.plan_periodicity,
            startDate: row.start_date,
            endDate: row.end_date,
            active: row.subscription_active,
          } : null,
        },
      });
    } catch (err) {
      console.error("[PORTAL] recibo:", err.message);
      res.status(500).json({ error: "Erro ao carregar o recibo" });
    }
  });

  return { ensureSchema, portalAuth };
}

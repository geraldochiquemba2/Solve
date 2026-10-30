import crypto from "node:crypto";

const DEFAULT_VERSION = "v23.0";
const API_VERSION_RE = /^v\d{1,3}\.\d{1,2}$/;
const SEND_TIMEOUT_MS = Number(process.env.WHATSAPP_TIMEOUT_MS || 15000);
const CHECK_TIMEOUT_MS = Number(process.env.WHATSAPP_CHECK_TIMEOUT_MS || 8000);
const HEALTH_CACHE_MS = 60 * 1000;

export function normalizeWhatsAppNumber(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 9 && digits.startsWith("9")) digits = `244${digits}`;
  if (digits.startsWith("0") && digits.length === 10) digits = `244${digits.slice(1)}`;
  return digits;
}

function maskPhone(value) {
  const digits = normalizeWhatsAppNumber(value);
  if (digits.length < 5) return "***";
  return `${digits.slice(0, 3)}***${digits.slice(-2)}`;
}

function safeMessage(value, max = 500) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function providerError(payload) {
  const err = payload?.error || {};
  return {
    message: safeMessage(err.message || payload?.message || "", 500),
    code: err.code != null ? String(err.code).slice(0, 50) : null,
    subcode: err.error_subcode != null ? String(err.error_subcode).slice(0, 50) : null,
    type: err.type ? String(err.type).slice(0, 80) : null,
    traceId: err.fbtrace_id ? String(err.fbtrace_id).slice(0, 80) : null,
  };
}

function classifyGraphFailure(status, error, aborted) {
  if (aborted) return { status: "erro_conectividade", message: "Tempo limite ao contactar a Graph API" };
  const code = Number(error?.code);
  if (status === 401 || status === 403 || [190, 200, 10, 100].includes(code)) {
    return { status: "erro_autenticacao", message: "A Meta rejeitou as credenciais do WhatsApp" };
  }
  if (status === 429 || (status >= 500 && status <= 599) || [2, 4, 17, 32, 613, 131000].includes(code)) {
    return { status: "indisponivel_temporario", message: "A Graph API está temporariamente indisponível" };
  }
  return { status: "erro_meta", message: error?.message || `A Graph API respondeu com HTTP ${status}` };
}

export function createWhatsAppService({ pool, cfg, env = process.env, fetchImpl = globalThis.fetch }) {
  let healthCache = { at: 0, value: null };
  let healthInFlight = null;

  async function config() {
    const [token, phoneNumberId, verifyToken, appSecret, apiVersion, displayName, otpTemplate, otpLanguage] = await Promise.all([
      cfg("whatsapp_token", env.WHATSAPP_TOKEN || ""),
      cfg("whatsapp_phone_number_id", env.WHATSAPP_PHONE_NUMBER_ID || ""),
      cfg("whatsapp_verify_token", env.WHATSAPP_VERIFY_TOKEN || ""),
      cfg("whatsapp_app_secret", env.WHATSAPP_APP_SECRET || ""),
      cfg("whatsapp_api_version", env.WHATSAPP_API_VERSION || DEFAULT_VERSION),
      cfg("whatsapp_display_name", env.WHATSAPP_DISPLAY_NAME || "SAMORAFIT"),
      cfg("whatsapp_otp_template", env.WHATSAPP_OTP_TEMPLATE || ""),
      cfg("whatsapp_otp_language", env.WHATSAPP_OTP_LANGUAGE || "pt_PT"),
    ]);
    const version = String(apiVersion || DEFAULT_VERSION).trim();
    return {
      token: String(token || "").trim(),
      phoneNumberId: String(phoneNumberId || "").trim(),
      verifyToken: String(verifyToken || "").trim(),
      appSecret: String(appSecret || "").trim(),
      apiVersion: API_VERSION_RE.test(version) ? version : DEFAULT_VERSION,
      displayName: String(displayName || "SAMORAFIT").trim(),
      otpTemplate: String(otpTemplate || "").trim(),
      otpLanguage: String(otpLanguage || "pt_PT").trim(),
    };
  }

  async function ensureSchema() {
    await pool.query(`CREATE TABLE IF NOT EXISTS whatsapp_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      direction VARCHAR(10) NOT NULL,
      phone VARCHAR(50) NOT NULL,
      type VARCHAR(30) NOT NULL,
      template_name VARCHAR(100),
      body TEXT,
      status VARCHAR(30) NOT NULL DEFAULT 'pending',
      provider_message_id VARCHAR(200),
      error TEXT,
      error_code VARCHAR(50),
      customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
      lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
      payment_code VARCHAR(50),
      idempotency_key VARCHAR(200),
      source_event VARCHAR(80),
      automation_event_id UUID,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      sent_at TIMESTAMPTZ,
      delivered_at TIMESTAMPTZ,
      read_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    const alterations = [
      "ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS error_code VARCHAR(50)",
      "ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(200)",
      "ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS source_event VARCHAR(80)",
      "ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS automation_event_id UUID",
      "ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ",
      "ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ",
      "ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ",
    ];
    for (const sql of alterations) await pool.query(sql).catch(() => {});
    await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_provider_id_idx ON whatsapp_messages (provider_message_id) WHERE provider_message_id IS NOT NULL");
    await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_idempotency_idx ON whatsapp_messages (idempotency_key) WHERE idempotency_key IS NOT NULL");
    await pool.query("CREATE INDEX IF NOT EXISTS whatsapp_messages_phone_created_idx ON whatsapp_messages (phone, created_at DESC)");
    await pool.query("CREATE INDEX IF NOT EXISTS whatsapp_messages_direction_created_idx ON whatsapp_messages (direction, created_at DESC)");
  }

  async function insertMessage({
    direction,
    phone,
    type,
    templateName,
    body,
    status,
    providerMessageId,
    error,
    errorCode,
    customerId,
    leadId,
    paymentCode,
    idempotencyKey,
    sourceEvent,
    automationEventId,
    metadata,
    sentAt,
  }) {
    const r = await pool.query(
      `INSERT INTO whatsapp_messages
        (direction, phone, type, template_name, body, status, provider_message_id, error, error_code,
         customer_id, lead_id, payment_code, idempotency_key, source_event, automation_event_id, metadata, sent_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [
        direction,
        String(phone || "").slice(0, 50),
        String(type || "text").slice(0, 30),
        templateName ? String(templateName).slice(0, 100) : null,
        body ? String(body).slice(0, 4000) : null,
        String(status || "pending").slice(0, 30),
        providerMessageId ? String(providerMessageId).slice(0, 200) : null,
        error ? safeMessage(error) : null,
        errorCode ? String(errorCode).slice(0, 50) : null,
        customerId || null,
        leadId || null,
        paymentCode ? String(paymentCode).slice(0, 50) : null,
        idempotencyKey ? String(idempotencyKey).slice(0, 200) : null,
        sourceEvent ? String(sourceEvent).slice(0, 80) : null,
        automationEventId || null,
        JSON.stringify(metadata || {}),
        sentAt || null,
      ]
    );
    return r.rows[0]?.id || null;
  }

  async function saveMessage(options) {
    try {
      return await insertMessage(options);
    } catch (err) {
      console.error("[WHATSAPP] falha a guardar mensagem:", err.message);
      return null;
    }
  }

  async function claimOutbound(options) {
    try {
      const inserted = await insertMessage({ ...options, status: options.status || "sending" });
      if (inserted) return { id: inserted, claimed: true };
      if (!options.idempotencyKey) return { id: null, claimed: false };
      const existing = await pool.query(
        "SELECT id, status, provider_message_id, updated_at FROM whatsapp_messages WHERE idempotency_key = $1 LIMIT 1",
        [String(options.idempotencyKey).slice(0, 200)]
      );
      const row = existing.rows[0];
      if (!row) return { id: null, claimed: true };
      const staleSending = row.status === "sending"
        && row.updated_at
        && Date.now() - new Date(row.updated_at).getTime() > 5 * 60 * 1000;
      if (row.status === "failed" || staleSending) {
        await pool.query(
          "UPDATE whatsapp_messages SET status='sending', error=NULL, error_code=NULL, updated_at=NOW() WHERE id=$1",
          [row.id]
        );
        return { id: row.id, claimed: true };
      }
      return { id: row.id, claimed: false, existing: row };
    } catch (err) {
      console.error("[WHATSAPP] falha a reservar envio:", err.message);
      return { id: null, claimed: false, error: err.message };
    }
  }

  async function markFailed(id, reason, code) {
    if (!id) return;
    await pool.query(
      "UPDATE whatsapp_messages SET status='failed', error=$2, error_code=$3, updated_at=NOW() WHERE id=$1",
      [id, safeMessage(reason), code ? String(code).slice(0, 50) : null]
    ).catch(() => {});
  }

  async function postToGraph(c, payload, localId) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), SEND_TIMEOUT_MS);
    try {
      const response = await fetchImpl(`https://graph.facebook.com/${c.apiVersion}/${c.phoneNumberId}/messages`, {
        method: "POST",
        headers: { authorization: `Bearer ${c.token}`, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const failure = providerError(data);
        const reason = failure.message || `HTTP ${response.status}`;
        await markFailed(localId, reason, failure.code);
        return { ok: false, error: reason, errorCode: failure.code, httpStatus: response.status };
      }
      const providerId = data?.messages?.[0]?.id || null;
      if (localId) {
        await pool.query(
          "UPDATE whatsapp_messages SET status='sent', provider_message_id=$2, sent_at=NOW(), updated_at=NOW() WHERE id=$1",
          [localId, providerId]
        ).catch(() => {});
      }
      return { ok: true, id: providerId };
    } catch (err) {
      const aborted = err?.name === "AbortError";
      const reason = aborted ? "Tempo limite da Graph API" : safeMessage(err?.message);
      await markFailed(localId, reason, aborted ? "timeout" : "network");
      return { ok: false, error: reason, errorCode: aborted ? "timeout" : "network" };
    } finally {
      clearTimeout(timer);
    }
  }

  async function sendText(to, body, meta = {}) {
    const phone = normalizeWhatsAppNumber(to);
    const text = String(body || "").trim();
    if (!phone || !text) return { ok: false, error: "Telefone ou mensagem inválidos" };
    const c = await config();
    if (!c.token || !c.phoneNumberId) {
      await saveMessage({ direction: "outbound", phone, type: "text", body: text, status: "failed", error: "WhatsApp não configurado", ...meta });
      return { ok: false, error: "WhatsApp não configurado", code: "not_configured" };
    }
    const claimed = await claimOutbound({
      direction: "outbound",
      phone,
      type: "text",
      body: text,
      ...meta,
    });
    if (!claimed.claimed) {
      if (claimed.error) return { ok: false, error: "Falha ao reservar envio", code: "storage_error" };
      return { ok: true, id: claimed.existing?.provider_message_id || null, duplicate: true };
    }
    return postToGraph(
      c,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: phone,
        type: "text",
        text: { preview_url: false, body: text.slice(0, 4096) },
      },
      claimed.id
    );
  }

  async function sendTemplate(to, templateName, languageCode, components, meta = {}) {
    const phone = normalizeWhatsAppNumber(to);
    const name = String(templateName || "").trim();
    if (!phone || !name) return { ok: false, error: "Telefone ou template inválidos" };
    const c = await config();
    if (!c.token || !c.phoneNumberId) {
      await saveMessage({ direction: "outbound", phone, type: "template", templateName: name, status: "failed", error: "WhatsApp não configurado", ...meta });
      return { ok: false, error: "WhatsApp não configurado", code: "not_configured" };
    }
    const claimed = await claimOutbound({
      direction: "outbound",
      phone,
      type: "template",
      templateName: name,
      ...meta,
    });
    if (!claimed.claimed) {
      if (claimed.error) return { ok: false, error: "Falha ao reservar envio", code: "storage_error" };
      return { ok: true, id: claimed.existing?.provider_message_id || null, duplicate: true };
    }
    const template = {
      name,
      language: { code: String(languageCode || c.otpLanguage || "pt_PT") },
    };
    if (Array.isArray(components) && components.length) template.components = components;
    return postToGraph(
      c,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: phone,
        type: "template",
        template,
      },
      claimed.id
    );
  }

  async function sendOtp(to, code) {
    const c = await config();
    if (c.otpTemplate) {
      return sendTemplate(
        to,
        c.otpTemplate,
        c.otpLanguage,
        [{ type: "body", parameters: [{ type: "text", text: String(code) }] }],
        { metadata: { purpose: "otp" } }
      );
    }
    return sendText(to, `O teu código de acesso SamoraFit é ${code}. Válido durante 5 minutos. Não partilhes este código.`, { metadata: { purpose: "otp" } });
  }

  async function verifySignature(rawBody, signature) {
    try {
      const c = await config();
      if (!c.appSecret) return false;
      const value = String(signature || "");
      if (!/^sha256=[a-f0-9]{64}$/i.test(value)) return false;
      const expected = crypto.createHmac("sha256", c.appSecret).update(rawBody || Buffer.alloc(0)).digest("hex");
      const received = value.slice(7).toLowerCase();
      if (received.length !== expected.length) return false;
      return crypto.timingSafeEqual(Buffer.from(received, "utf8"), Buffer.from(expected, "utf8"));
    } catch {
      return false;
    }
  }

  async function verifyChallenge(mode, token) {
    try {
      const c = await config();
      if (mode !== "subscribe" || !c.verifyToken) return false;
      const a = Buffer.from(String(token || ""));
      const b = Buffer.from(c.verifyToken);
      if (a.length !== b.length) return false;
      return crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  async function processWebhook(payload) {
    let inbound = 0;
    let duplicates = 0;
    let statuses = 0;
    const entries = Array.isArray(payload?.entry) ? payload.entry : [];
    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        const value = change?.value || {};
        const contactsByWaId = new Map((value.contacts || []).map((c) => [String(c.wa_id || ""), c]));
        for (const msg of Array.isArray(value.messages) ? value.messages : []) {
          const phone = normalizeWhatsAppNumber(msg.from);
          if (!phone || !msg.id) continue;
          const body = msg?.text?.body
            || msg?.button?.text
            || msg?.interactive?.button_reply?.title
            || msg?.interactive?.list_reply?.title
            || msg?.caption
            || "";
          const type = String(msg.type || "unknown");
          const contact = contactsByWaId.get(String(msg.from || ""));
          const name = contact?.profile?.name || null;
          let customerId = null;
          let leadId = null;
          try {
            const found = await pool.query(
              `SELECT id FROM customers
                WHERE regexp_replace(COALESCE(whatsapp_phone,''), '\\D', '', 'g') IN ($1,$2)
                   OR regexp_replace(COALESCE(phone,''), '\\D', '', 'g') IN ($1,$2)
                LIMIT 1`,
              [phone, phone.replace(/^244/, "")]
            );
            customerId = found.rows[0]?.id || null;
          } catch {}
          if (!customerId) {
            try {
              const foundLead = await pool.query(
                `SELECT id FROM leads
                  WHERE regexp_replace(COALESCE(whatsapp,''), '\\D', '', 'g') IN ($1,$2)
                     OR regexp_replace(COALESCE(phone,''), '\\D', '', 'g') IN ($1,$2)
                  ORDER BY created_at DESC LIMIT 1`,
                [phone, phone.replace(/^244/, "")]
              );
              leadId = foundLead.rows[0]?.id || null;
            } catch {}
          }
          const saved = await saveMessage({
            direction: "inbound",
            phone,
            type,
            body: body || null,
            status: "received",
            providerMessageId: msg.id || null,
            customerId,
            leadId,
            sourceEvent: "whatsapp.inbound",
            metadata: { waId: msg.from || null, name, timestamp: msg.timestamp || null, messageType: type },
          });
          if (saved) inbound += 1;
          else duplicates += 1;
        }
        for (const st of Array.isArray(value.statuses) ? value.statuses : []) {
          if (!st.id) continue;
          statuses += 1;
          const mapped = ["sent", "delivered", "read", "failed"].includes(String(st.status)) ? String(st.status) : "sent";
          const error = st?.errors?.[0]?.message ? safeMessage(st.errors[0].message) : null;
          const errorCode = st?.errors?.[0]?.code != null ? String(st.errors[0].code).slice(0, 50) : null;
          await pool.query(
            `UPDATE whatsapp_messages
                SET status = CASE
                      WHEN $2 = 'failed' THEN 'failed'
                      WHEN $2 = 'read' THEN 'read'
                      WHEN $2 = 'delivered' AND status <> 'read' THEN 'delivered'
                      WHEN $2 = 'sent' AND status NOT IN ('delivered','read','failed') THEN 'sent'
                      ELSE status END,
                    error = COALESCE($3, error),
                    error_code = COALESCE($4, error_code),
                    sent_at = CASE WHEN $2 = 'sent' AND sent_at IS NULL THEN NOW() ELSE sent_at END,
                    delivered_at = CASE WHEN $2 = 'delivered' AND delivered_at IS NULL THEN NOW() ELSE delivered_at END,
                    read_at = CASE WHEN $2 = 'read' AND read_at IS NULL THEN NOW() ELSE read_at END,
                    updated_at = NOW()
              WHERE provider_message_id = $1`,
            [String(st.id), mapped, error, errorCode]
          ).catch(() => {});
        }
      }
    }
    return { inbound, duplicates, statuses };
  }

  async function verifyConnection({ force = false } = {}) {
    const c = await config();
    if (!c.token || !c.phoneNumberId) {
      return {
        configured: false,
        connected: false,
        status: "nao_configurado",
        message: "Falta WHATSAPP_TOKEN ou WHATSAPP_PHONE_NUMBER_ID",
        checkedAt: new Date().toISOString(),
      };
    }
    if (!force && healthCache.value && Date.now() - healthCache.at < HEALTH_CACHE_MS) return healthCache.value;
    if (healthInFlight) return healthInFlight;
    healthInFlight = (async () => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), CHECK_TIMEOUT_MS);
      try {
        const response = await fetchImpl(
          `https://graph.facebook.com/${c.apiVersion}/${encodeURIComponent(c.phoneNumberId)}?fields=verified_name,display_phone_number,quality_rating,status`,
          { headers: { authorization: `Bearer ${c.token}`, accept: "application/json" }, signal: ctrl.signal }
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          const failure = providerError(data);
          const classified = classifyGraphFailure(response.status, failure, false);
          const result = {
            configured: true,
            connected: false,
            status: classified.status,
            message: classified.message,
            errorCode: failure.code,
            httpStatus: response.status,
            checkedAt: new Date().toISOString(),
          };
          healthCache = { at: Date.now(), value: result };
          return result;
        }
        const webhookReady = Boolean(c.verifyToken && c.appSecret);
        const result = {
          configured: true,
          connected: true,
          status: webhookReady ? "operacional" : "configurado_nao_verificado",
          message: webhookReady
            ? `Ligado à Meta como ${data?.verified_name || c.displayName}`
            : `Graph API OK (${data?.verified_name || c.displayName}), mas o webhook está incompleto (verify token/app secret)`,
          verifiedName: data?.verified_name || null,
          displayPhoneNumber: data?.display_phone_number || null,
          qualityRating: data?.quality_rating || null,
          accountStatus: data?.status || null,
          checkedAt: new Date().toISOString(),
        };
        healthCache = { at: Date.now(), value: result };
        return result;
      } catch (err) {
        const aborted = err?.name === "AbortError";
        const result = {
          configured: true,
          connected: false,
          status: aborted ? "erro_conectividade" : "erro_conectividade",
          message: aborted ? "Tempo limite ao contactar a Graph API" : "Não foi possível contactar a Graph API",
          checkedAt: new Date().toISOString(),
        };
        healthCache = { at: Date.now(), value: result };
        return result;
      } finally {
        clearTimeout(timer);
      }
    })();
    try {
      return await healthInFlight;
    } finally {
      healthInFlight = null;
    }
  }

  async function health({ force = false } = {}) {
    const c = await config();
    const [stats, verification] = await Promise.all([
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE direction='inbound')::int AS inbound,
           COUNT(*) FILTER (WHERE direction='outbound')::int AS outbound,
           COUNT(*) FILTER (WHERE direction='outbound' AND status='failed')::int AS failed,
           MAX(created_at) AS last_message_at,
           (SELECT created_at FROM whatsapp_messages WHERE direction='outbound' ORDER BY created_at DESC LIMIT 1) AS last_outbound_at,
           (SELECT error FROM whatsapp_messages WHERE error IS NOT NULL ORDER BY created_at DESC LIMIT 1) AS last_error,
           (SELECT error_code FROM whatsapp_messages WHERE error_code IS NOT NULL ORDER BY created_at DESC LIMIT 1) AS last_error_code
         FROM whatsapp_messages`
      ).catch(() => ({ rows: [{}] })),
      verifyConnection({ force }),
    ]);
    const row = stats.rows[0] || {};
    return {
      ...verification,
      displayName: c.displayName,
      phoneNumberId: c.phoneNumberId ? maskPhone(c.phoneNumberId) : null,
      apiVersion: c.apiVersion,
      webhookConfigured: Boolean(c.verifyToken && c.appSecret),
      otpTemplateConfigured: Boolean(c.otpTemplate),
      inbound: Number(row.inbound || 0),
      outbound: Number(row.outbound || 0),
      failed: Number(row.failed || 0),
      lastMessageAt: row.last_message_at || null,
      lastOutboundAt: row.last_outbound_at || null,
      lastSyncAt: row.last_outbound_at || null,
      lastError: row.last_error || null,
      lastErrorCode: row.last_error_code || null,
    };
  }

  return {
    ensureSchema,
    config,
    health,
    normalize: normalizeWhatsAppNumber,
    processWebhook,
    saveMessage,
    sendOtp,
    sendTemplate,
    sendText,
    verifyChallenge,
    verifyConnection,
    verifySignature,
  };
}

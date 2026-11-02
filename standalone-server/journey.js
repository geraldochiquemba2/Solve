// Jornada do membro: sequência de mensagens WhatsApp agendadas quando uma lead
// entra no CRM. Os passos são configuráveis (nome, atraso, mensagem/template) e
// cada lead recebe uma única execução por passo. Sem credenciais WhatsApp os
// envios ficam marcados como "skipped" para não despejar mensagens antigas
// quando a API for configurada mais tarde.

const DEFAULT_STEPS = [
  {
    step_key: "boas_vindas",
    name: "Boas-vindas",
    delay_hours: 0,
    position: 10,
    message:
      "Olá {{nome}}! 👋 Recebemos o teu contacto. Em breve a nossa equipa fala contigo para te apresentar a melhor solução para ti.",
  },
  {
    step_key: "conhecer_objetivo",
    name: "Conhecer o objetivo",
    delay_hours: 24,
    position: 20,
    message:
      "Olá {{nome}}! Para te ajudarmos melhor: qual é o teu objetivo principal connosco? Responde a esta mensagem e a equipa continua o acompanhamento.",
  },
  {
    step_key: "beneficios",
    name: "Apresentar benefícios",
    delay_hours: 72,
    position: 30,
    message:
      "{{nome}}, sabias que podes acompanhar planos, pagamentos e treinos num só lugar? Se quiseres, marcamos uma visita para te mostrar tudo.",
  },
  {
    step_key: "oferta",
    name: "Condição especial",
    delay_hours: 120,
    position: 40,
    message:
      "{{nome}}, preparámos uma condição especial para começares esta semana. Queres que te envie os detalhes?",
  },
  {
    step_key: "ultima_chamada",
    name: "Última chamada",
    delay_hours: 168,
    position: 50,
    message:
      "{{nome}}, não queremos que fiques sem resposta. Se ainda tiveres interesse, responde a esta mensagem e falamos hoje.",
  },
];

function render(template, vars) {
  return String(template || "").replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, key) => {
    const value = vars[String(key).toLowerCase()];
    return value == null ? "" : String(value);
  });
}

export function createJourneyEngine({ pool, whatsapp, env = process.env }) {
  const tickMs = Number(env.MEMBER_JOURNEY_TICK_MS || 60 * 1000);

  async function ensureSchema() {
    await pool.query(`CREATE TABLE IF NOT EXISTS member_journey_steps (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      step_key VARCHAR(60) NOT NULL UNIQUE,
      name VARCHAR(120) NOT NULL,
      delay_hours INTEGER NOT NULL DEFAULT 0,
      message TEXT NOT NULL,
      template_name VARCHAR(120),
      language VARCHAR(20) NOT NULL DEFAULT 'pt_PT',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS member_journey_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      step_id UUID NOT NULL REFERENCES member_journey_steps(id) ON DELETE CASCADE,
      due_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      whatsapp_message_id VARCHAR(200),
      sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (lead_id, step_id)
    )`);
    await pool.query("CREATE INDEX IF NOT EXISTS member_journey_runs_pending_idx ON member_journey_runs (status, due_at)");
    await pool.query("CREATE INDEX IF NOT EXISTS member_journey_runs_lead_idx ON member_journey_runs (lead_id)");
    for (const step of DEFAULT_STEPS) {
      await pool.query(
        `INSERT INTO member_journey_steps (step_key, name, delay_hours, position, message)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (step_key) DO NOTHING`,
        [step.step_key, step.name, step.delay_hours, step.position, step.message]
      );
    }
  }

  async function listSteps() {
    const r = await pool.query("SELECT * FROM member_journey_steps ORDER BY position ASC, delay_hours ASC");
    return r.rows;
  }

  async function updateStep(id, patch = {}) {
    const allowed = {
      name: "name",
      message: "message",
      templateName: "template_name",
      template_name: "template_name",
      language: "language",
      delayHours: "delay_hours",
      delay_hours: "delay_hours",
      active: "active",
      position: "position",
    };
    const fields = [];
    const params = [];
    for (const [key, column] of Object.entries(allowed)) {
      if (patch[key] === undefined) continue;
      let value = patch[key];
      if (column === "delay_hours") {
        value = Number.parseInt(value, 10);
        if (!Number.isFinite(value) || value < 0) continue;
      }
      if (column === "position") {
        value = Number.parseInt(value, 10);
        if (!Number.isFinite(value)) continue;
      }
      if (column === "active") value = value === true || value === "true" || value === 1;
      if (column === "template_name") value = value ? String(value).trim() : null;
      if (column === "language") value = String(value || "pt_PT").trim() || "pt_PT";
      fields.push(`${column} = $${params.length + 1}`);
      params.push(value);
    }
    if (!fields.length) return null;
    fields.push("updated_at = NOW()");
    params.push(id);
    const r = await pool.query(
      `UPDATE member_journey_steps SET ${fields.join(", ")} WHERE id = $${params.length} RETURNING *`,
      params
    );
    // Desativar um passo cancela o que ainda estava por enviar nesse passo.
    if (r.rows[0] && r.rows[0].active === false) {
      await pool.query(
        `UPDATE member_journey_runs
            SET status = 'cancelled', last_error = 'passo desativado', updated_at = NOW()
          WHERE step_id = $1 AND status = 'pending'`,
        [r.rows[0].id]
      ).catch(() => {});
    }
    return r.rows[0] || null;
  }

  // Agenda os passos ativos para uma lead. Idempotente por (lead, passo): voltar
  // a receber a mesma lead não reinicia a jornada.
  async function scheduleLead(lead, { reason = "lead_created" } = {}) {
    if (!lead?.id) return { scheduled: 0, skipped: "sem lead" };
    const phone = lead.whatsapp || lead.phone;
    if (!phone) return { scheduled: 0, skipped: "sem telefone" };
    const steps = await listSteps();
    let scheduled = 0;
    for (const step of steps.filter((s) => s.active)) {
      const due = new Date(Date.now() + Number(step.delay_hours || 0) * 60 * 60 * 1000);
      const r = await pool.query(
        `INSERT INTO member_journey_runs (lead_id, step_id, due_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (lead_id, step_id) DO NOTHING`,
        [lead.id, step.id, due]
      );
      scheduled += r.rowCount || 0;
    }
    if (scheduled) {
      await pool.query(
        `INSERT INTO audit_logs (actor, action, entity, details)
         VALUES ('journey', 'journey.scheduled', 'leads', $1::jsonb)`,
        [JSON.stringify({ leadId: lead.id, reason, scheduled })]
      ).catch(() => {});
    }
    return { scheduled };
  }

  // A lead converteu-se ou perdeu-se: não faz sentido continuar a insistência.
  async function cancelLead(leadId, motivo = "convertido") {
    if (!leadId) return { cancelled: 0 };
    const r = await pool.query(
      `UPDATE member_journey_runs
          SET status = 'cancelled', last_error = $2, updated_at = NOW()
        WHERE lead_id = $1 AND status = 'pending'`,
      [leadId, `jornada cancelada (${motivo})`]
    );
    return { cancelled: r.rowCount || 0 };
  }

  // Ativa a jornada para todas as leads em aberto que ainda não foram
  // agendadas. Idempotente: correr de novo não duplica envios.
  async function activateAllLeads(limit = 500) {
    const r = await pool.query(
      `SELECT id, name, whatsapp, phone, produto_interesse
         FROM leads
        WHERE status NOT IN ('convertido','perdido')
          AND COALESCE(NULLIF(whatsapp, ''), NULLIF(phone, '')) IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM member_journey_runs r WHERE r.lead_id = leads.id
          )
        ORDER BY created_at DESC
        LIMIT $1`,
      [Math.min(Math.max(Number.parseInt(limit, 10) || 500, 1), 2000)]
    );
    let leads = 0;
    let scheduled = 0;
    for (const lead of r.rows) {
      const out = await scheduleLead(lead, { reason: "ativacao_manual" });
      if (out.scheduled) leads += 1;
      scheduled += out.scheduled || 0;
    }
    return { leads, scheduled, total: r.rows.length };
  }

  async function whatsappReady() {
    try {
      const c = await whatsapp.config();
      return Boolean(c?.token && c?.phoneNumberId);
    } catch {
      return false;
    }
  }

  async function processDue(limit = 20) {
    // Sem credenciais os envios ficam em espera (pending) em vez de serem
    // marcados como falhados; assim, quando a API for configurada, seguem.
    if (!(await whatsappReady())) return { processed: 0, waiting: true };
    // Recupera execuções interrompidas a meio (crash/redeploy) para não ficarem
    // presas em "sending" para sempre.
    await pool.query(
      `UPDATE member_journey_runs
          SET status = 'pending', updated_at = NOW()
        WHERE status = 'sending' AND updated_at < NOW() - INTERVAL '15 minutes'`
    ).catch(() => {});
    const r = await pool.query(
      `SELECT r.*, s.step_key, s.name AS step_name, s.message, s.template_name, s.language,
              l.name AS lead_name, l.whatsapp AS lead_whatsapp, l.phone AS lead_phone,
              l.produto_interesse
         FROM member_journey_runs r
         JOIN member_journey_steps s ON s.id = r.step_id
         JOIN leads l ON l.id = r.lead_id
        WHERE r.status = 'pending' AND r.due_at <= NOW()
        ORDER BY r.due_at ASC
        LIMIT $1`,
      [limit]
    );
    let processed = 0;
    for (const run of r.rows) {
      const claim = await pool.query(
        `UPDATE member_journey_runs
            SET status = 'sending', attempts = attempts + 1, updated_at = NOW()
          WHERE id = $1 AND status = 'pending'
          RETURNING id`,
        [run.id]
      );
      if (!claim.rowCount) continue;
      processed += 1;
      const to = run.lead_whatsapp || run.lead_phone;
      const body = render(run.message, {
        nome: run.lead_name,
        name: run.lead_name,
        primeiro_nome: String(run.lead_name || "").split(" ")[0],
        produto: run.produto_interesse || "",
      });
      let result;
      try {
        const meta = {
          leadId: run.lead_id,
          idempotencyKey: `journey:${run.id}`,
          sourceEvent: "member_journey",
          metadata: { stepKey: run.step_key },
        };
        result = run.template_name
          ? await whatsapp.sendTemplate(to, run.template_name, run.language || "pt_PT", undefined, meta)
          : await whatsapp.sendText(to, body, meta);
      } catch (err) {
        result = { ok: false, error: err?.message || String(err) };
      }
      if (result?.ok) {
        await pool.query(
          `UPDATE member_journey_runs
              SET status = 'sent', sent_at = NOW(), whatsapp_message_id = $2,
                  last_error = NULL, updated_at = NOW()
            WHERE id = $1`,
          [run.id, result.id || null]
        );
      } else if (result?.code === "not_configured") {
        await pool.query(
          `UPDATE member_journey_runs
              SET status = 'pending', attempts = GREATEST(attempts - 1, 0),
                  last_error = $2, due_at = NOW() + INTERVAL '1 hour', updated_at = NOW()
            WHERE id = $1`,
          [run.id, "WhatsApp não configurado"]
        );
      } else {
        const retry = Number(run.attempts || 0) < 3;
        await pool.query(
          `UPDATE member_journey_runs
              SET status = $2,
                  last_error = $3,
                  due_at = CASE WHEN $2 = 'pending' THEN NOW() + INTERVAL '30 minutes' ELSE due_at END,
                  updated_at = NOW()
            WHERE id = $1`,
          [run.id, retry ? "pending" : "failed", String(result?.error || "falha").slice(0, 500)]
        );
      }
    }
    return { processed };
  }

  async function listRuns(limit = 20) {
    const n = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 100);
    const r = await pool.query(
      `SELECT r.id, r.status, r.due_at, r.sent_at, r.attempts, r.last_error,
              s.name AS step_name, s.step_key, l.name AS lead_name, l.id AS lead_id
         FROM member_journey_runs r
         JOIN member_journey_steps s ON s.id = r.step_id
         JOIN leads l ON l.id = r.lead_id
        ORDER BY r.created_at DESC
        LIMIT $1`,
      [n]
    );
    return r.rows;
  }

  async function stats() {
    const r = await pool.query(
      `SELECT status, COUNT(*)::int AS total FROM member_journey_runs GROUP BY status`
    );
    return Object.fromEntries(r.rows.map((row) => [row.status, row.total]));
  }

  return {
    tickMs,
    ensureSchema,
    listSteps,
    updateStep,
    scheduleLead,
    cancelLead,
    activateAllLeads,
    whatsappReady,
    processDue,
    listRuns,
    stats,
    render,
  };
}

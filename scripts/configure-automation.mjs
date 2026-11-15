#!/usr/bin/env node
// Configura o motor de automacao numa base Postgres: cria as tabelas, semeia
// as regras/passos base, liga o interruptor e (opcionalmente) agenda as leads
// existentes. Idempotente: correr de novo nao duplica regras nem envios.
//
// Uso:
//   node scripts/configure-automation.mjs
//   node scripts/configure-automation.mjs --activate-leads
//   CRM_DATABASE_URL="postgresql://..." node scripts/configure-automation.mjs
//
// Só agenda leads quando o WhatsApp estiver realmente ligado. Para forcar:
//   node scripts/configure-automation.mjs --activate-leads --force
//
// Depois de os templates estarem aprovados na Meta, pode associa-los aos passos:
//   node scripts/configure-automation.mjs --templates '{"boas_vindas":"jornada_boas_vindas",...}'
import pg from "pg";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createAutomationEngine } from "../standalone-server/automation.js";
import { createJourneyEngine } from "../standalone-server/journey.js";
import { createWhatsAppService } from "../standalone-server/whatsapp.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const path = resolve(__dirname, "../.env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, raw] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = raw.replace(/^["']|["']$/g, "");
  }
}

function parseArgs(argv) {
  const args = { activateLeads: false, force: false, templates: null, limit: 500, resetPending: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--activate-leads") args.activateLeads = true;
    else if (arg === "--force") args.force = true;
    else if (arg === "--reset-pending") args.resetPending = true;
    else if (arg === "--templates") args.templates = JSON.parse(argv[++i] || "{}");
    else if (arg === "--limit") args.limit = Number.parseInt(argv[++i], 10) || 500;
  }
  return args;
}

loadEnv();

const args = parseArgs(process.argv.slice(2));
const rawConnection = process.env.CRM_DATABASE_URL || process.env.DATABASE_URL;
if (!rawConnection) {
  console.error("FATAL: define CRM_DATABASE_URL ou DATABASE_URL.");
  process.exit(1);
}
const connectionString = rawConnection
  .replace("&channel_binding=require", "")
  .replace("channel_binding=require&", "")
  .replace("?channel_binding=require", "");

const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === "true" },
});

const envMap = {
  whatsapp_token: "WHATSAPP_TOKEN",
  whatsapp_phone_number_id: "WHATSAPP_PHONE_NUMBER_ID",
  whatsapp_verify_token: "WHATSAPP_VERIFY_TOKEN",
  whatsapp_app_secret: "WHATSAPP_APP_SECRET",
  whatsapp_api_version: "WHATSAPP_API_VERSION",
  whatsapp_display_name: "WHATSAPP_DISPLAY_NAME",
  whatsapp_otp_template: "WHATSAPP_OTP_TEMPLATE",
  whatsapp_otp_language: "WHATSAPP_OTP_LANGUAGE",
};
const cfg = async (key, fallback = "") => process.env[envMap[key]] || fallback;

const whatsapp = createWhatsAppService({ pool, cfg, env: process.env });
const automation = createAutomationEngine({ pool, whatsapp });
const journey = createJourneyEngine({ pool, whatsapp, env: process.env });

function maskHost(url) {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`;
  } catch {
    return "base de dados";
  }
}

async function main() {
  console.log(`Base: ${maskHost(connectionString)}`);

  await whatsapp.ensureSchema();
  await automation.ensureSchema();
  await journey.ensureSchema();
  const seeded = await automation.ensureDefaults();

  await pool.query(
    `INSERT INTO settings (key, value, updated_at) VALUES ('automation_enabled', 'true'::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE SET value = 'true'::jsonb, updated_at = NOW()`
  );

  if (args.resetPending) {
    const reset = await pool.query(
      "DELETE FROM member_journey_runs WHERE status = 'pending' AND sent_at IS NULL"
    );
    console.log(`Execucoes pendentes removidas: ${reset.rowCount || 0}`);
  }

  if (args.templates && Object.keys(args.templates).length) {
    for (const [stepKey, templateName] of Object.entries(args.templates)) {
      const r = await pool.query(
        `UPDATE member_journey_steps SET template_name = $2, updated_at = NOW()
          WHERE step_key = $1 RETURNING step_key, template_name`,
        [stepKey, templateName || null]
      );
      console.log(r.rowCount ? `template ${stepKey} -> ${templateName}` : `passo ${stepKey} inexistente`);
    }
  }

  const [rules, steps, runs] = await Promise.all([
    pool.query("SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE active)::int AS active FROM automations"),
    pool.query("SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE active)::int AS active FROM member_journey_steps"),
    pool.query("SELECT status, COUNT(*)::int AS total FROM member_journey_runs GROUP BY status"),
  ]);
  console.log(`Regras: ${rules.rows[0].active}/${rules.rows[0].total} ativas (semeadas agora: ${seeded.seeded})`);
  console.log(`Jornada: ${steps.rows[0].active}/${steps.rows[0].total} passos ativos`);
  console.log(`Execucoes: ${runs.rows.length ? runs.rows.map((r) => `${r.status}=${r.total}`).join(", ") : "nenhuma"}`);

  if (args.activateLeads) {
    const health = await whatsapp.health({ force: true }).catch((err) => ({ connected: false, status: "erro", message: err.message }));
    const ready = await journey.whatsappReady();
    if (!args.force && !(ready && health.connected)) {
      console.log(
        `\nLeads NAO agendadas: WhatsApp ${health.connected ? "ligado" : `nao ligado (${health.status || "desconhecido"})`}` +
          `${health.message ? ` - ${health.message}` : ""}.`
      );
      console.log("Resolve o numero/templates na Meta e corre de novo com --activate-leads.");
    } else {
      const result = await journey.activateAllLeads(args.limit);
      console.log(`\nLeads agendadas: ${result.leads} (${result.scheduled} envios; ${result.total} analisadas).`);
    }
  } else {
    console.log("\nLeads existentes NAO agendadas. Usa --activate-leads quando o WhatsApp estiver ligado.");
  }

  console.log("\nConcluido. O servidor passa a processar a fila automaticamente.");
}

main()
  .catch((err) => {
    console.error("Erro:", err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

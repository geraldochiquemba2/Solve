#!/usr/bin/env node
// Diagnostico da prontidao do WhatsApp para a automacao.
// Nao imprime segredos. Sai com codigo 1 se houver bloqueios.
//
// Uso:
//   node scripts/check-whatsapp-readiness.mjs
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env");

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    if (process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

const token = process.env.WHATSAPP_TOKEN;
const wabaId = process.env.WHATSAPP_WABA_ID;
const version = process.env.WHATSAPP_API_VERSION || "v23.0";
const expectedTemplates = [
  "jornada_boas_vindas",
  "jornada_conhecer_objetivo",
  "jornada_beneficios",
  "jornada_oferta",
  "jornada_ultima_chamada",
];

const blockers = [];

if (!token) blockers.push("Falta WHATSAPP_TOKEN.");
if (!wabaId) blockers.push("Falta WHATSAPP_WABA_ID.");
if (!process.env.WHATSAPP_PHONE_NUMBER_ID) blockers.push("Falta WHATSAPP_PHONE_NUMBER_ID.");
if (!process.env.WHATSAPP_VERIFY_TOKEN || !process.env.WHATSAPP_APP_SECRET) {
  blockers.push("Webhook incompleto: faltam WHATSAPP_VERIFY_TOKEN/WHATSAPP_APP_SECRET.");
}
if (!token || !wabaId) {
  console.log(blockers.join("\n"));
  process.exit(1);
}

async function graph(path) {
  const res = await fetch(`https://graph.facebook.com/${version}/${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

const assigned = await graph("me/assigned_whatsapp_business_accounts?fields=id,name");
const assignedWabas = assigned.body?.data || [];
if (!assignedWabas.some((item) => String(item.id) === String(wabaId))) {
  blockers.push(
    `A WABA ${wabaId} nao esta atribuida ao System User do token. ` +
      "Meta Business Settings > Utilizadores > Utilizadores do sistema > CRM-whatsapp > Adicionar recursos > WhatsApp Business Accounts > controlo total."
  );
}

const phones = await graph(`${wabaId}/phone_numbers?fields=id,display_phone_number,status,platform_type`);
for (const phone of phones.body?.data || []) {
  const status = String(phone.status || "").toUpperCase();
  const platform = String(phone.platform_type || "").toUpperCase();
  if (status !== "CONNECTED" || platform === "ON_PREMISE") {
    blockers.push(
      `Numero ${phone.display_phone_number} (${phone.id}) esta ${status || "sem estado"} (${platform || "sem plataforma"}). ` +
        "Migra/religa o numero a Cloud API no WhatsApp Manager e conclui a verificacao."
    );
  }
}

const templates = await graph(`${wabaId}/message_templates?fields=name,status,language&limit=100`);
const byName = new Map((templates.body?.data || []).map((item) => [item.name, item]));
for (const name of expectedTemplates) {
  const template = byName.get(name);
  if (!template) blockers.push(`Template ${name} nao existe.`);
  else if (String(template.status).toUpperCase() !== "APPROVED") {
    blockers.push(`Template ${name} esta ${template.status}.`);
  }
}

const scopes = (await graph(`debug_token?input_token=${encodeURIComponent(token)}`)).body?.data?.scopes || [];
if (!scopes.includes("whatsapp_business_management")) {
  blockers.push("Token sem scope whatsapp_business_management.");
}

const business = await graph(`me/businesses?fields=id,name`);
if (business.status !== 200) {
  console.log("Nota: token sem business_management; a atribuicao da WABA tem de ser feita na UI da Meta.");
}

if (blockers.length) {
  console.log(`Bloqueios (${blockers.length}):`);
  for (const blocker of blockers) console.log(`- ${blocker}`);
  process.exit(1);
}

console.log("WhatsApp pronto: numero ligado, WABA atribuida e templates aprovados.");

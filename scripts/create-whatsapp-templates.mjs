#!/usr/bin/env node
// Cria (ou confirma) os templates da jornada na WhatsApp Cloud API.
// Idempotente: templates que já existem não são recriados.
//
// Pré-requisitos na Meta:
//   1. O System User dono do WHATSAPP_TOKEN tem de estar atribuído à WABA
//      do número +1 555-750-5680 com controlo total (Business Settings >
//      Utilizadores > Utilizadores do sistema > Adicionar recursos).
//   2. O número +1 555-750-5680 tem de estar migrado/ligado à Cloud API.
//
// Uso:
//   node scripts/create-whatsapp-templates.mjs
//   WHATSAPP_WABA_ID=... node scripts/create-whatsapp-templates.mjs
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

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

loadEnv();

const token = process.env.WHATSAPP_TOKEN;
const wabaId = process.env.WHATSAPP_WABA_ID;
const version = process.env.WHATSAPP_API_VERSION || "v23.0";

if (!token || !wabaId) {
  console.error("FATAL: define WHATSAPP_TOKEN e WHATSAPP_WABA_ID.");
  process.exit(1);
}

// Sem variáveis: o motor da jornada envia templates sem `components`.
const TEMPLATES = [
  {
    name: "jornada_boas_vindas",
    body: "Olá! Recebemos o teu contacto. Em breve a nossa equipa fala contigo para te apresentar a melhor solução para ti.",
  },
  {
    name: "jornada_conhecer_objetivo",
    body: "Olá! Para te ajudarmos melhor: qual é o teu objetivo principal connosco? Responde a esta mensagem e a equipa continua o acompanhamento.",
  },
  {
    name: "jornada_beneficios",
    body: "Sabias que podes acompanhar planos, pagamentos e treinos num só lugar? Se quiseres, marcamos uma visita para te mostrar tudo.",
  },
  {
    name: "jornada_oferta",
    body: "Preparámos uma condição especial para começares esta semana. Queres que te envie os detalhes?",
  },
  {
    name: "jornada_ultima_chamada",
    body: "Não queremos que fiques sem resposta. Se ainda tiveres interesse, responde a esta mensagem e falamos hoje.",
  },
];

async function graph(path, options = {}) {
  const res = await fetch(`https://graph.facebook.com/${version}/${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function main() {
  const listed = await graph(`${wabaId}/message_templates?fields=name,status,language&limit=100`);
  if (listed.status !== 200) {
    console.error("Erro ao listar templates:", listed.status, JSON.stringify(listed.body));
    process.exit(1);
  }
  const existing = new Map((listed.body.data || []).map((t) => [t.name, t]));

  for (const template of TEMPLATES) {
    const current = existing.get(template.name);
    if (current) {
      console.log(`= ${template.name} já existe (${current.status}, ${current.language})`);
      continue;
    }
    const out = await graph(`${wabaId}/message_templates`, {
      method: "POST",
      body: JSON.stringify({
        name: template.name,
        language: "pt_PT",
        category: "MARKETING",
        components: [{ type: "BODY", text: template.body }],
      }),
    });
    if (out.status === 200 || out.status === 201) {
      console.log(`+ ${template.name} criado (${out.body.status || "PENDING"})`);
    } else {
      const message = out.body?.error?.error_user_msg || out.body?.error?.message || "falha";
      console.log(`! ${template.name}: ${message}`);
      if (out.body?.error?.error_subcode === 2494160) {
        console.log("  -> Atribui a WABA ao System User com controlo total na Meta e tenta de novo.");
      }
    }
  }
}

main().catch((err) => {
  console.error("Erro:", err.message);
  process.exitCode = 1;
});

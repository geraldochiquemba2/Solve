#!/usr/bin/env node
// Re-importa os leads Fit90 (Supabase A: fit90_leads) para o CRM (Supabase B).
// Idempotente: o CRM faz dedup por externalId (= id do fit90_leads).
//
// Uso:
//   SUPABASE_URL=https://<landing>.supabase.co SUPABASE_SERVICE_KEY=... \
//   CRM_API_URL=https://<crm>.onrender.com CRM_API_KEY=... \
//     node scripts/import-leads.mjs
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRM_URL = (process.env.CRM_API_URL || "").replace(/\/$/, "");
const CRM_KEY = process.env.CRM_API_KEY;

for (const [k, v] of Object.entries({ SUPABASE_URL, SUPABASE_SERVICE_KEY: SERVICE_KEY, CRM_API_URL: CRM_URL, CRM_API_KEY: CRM_KEY })) {
  if (!v) { console.error(`FATAL: falta ${k}`); process.exit(1); }
}

const res = await fetch(`${SUPABASE_URL}/rest/v1/fit90_leads?select=*&order=created_at.asc`, {
  headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
});
if (!res.ok) { console.error("Supabase erro:", res.status, await res.text()); process.exit(1); }
const leads = await res.json();
console.log(`Supabase A: ${leads.length} leads Fit90`);

let ok = 0, skip = 0, fail = 0;
for (const l of leads) {
  if (!l.name || String(l.name).trim().length < 2) { skip++; continue; }
  const r = await fetch(`${CRM_URL}/api/v1/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": CRM_KEY },
    body: JSON.stringify({
      name: l.name, email: l.email || undefined, phone: l.phone || undefined,
      company: l.company || undefined, source: l.source || "fit90_landing",
      notes: l.notes || undefined, externalId: String(l.id),
    }),
  });
  if (r.ok) ok++; else { fail++; console.error("falha", l.id, r.status); }
}
console.log(`\nImportados: ${ok} | saltados: ${skip} | falhas: ${fail}`);

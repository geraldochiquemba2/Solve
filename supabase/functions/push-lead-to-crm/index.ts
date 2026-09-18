import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CRM_URL = Deno.env.get("CRM_API_URL") || "https://solve-sqoh.onrender.com";
const CRM_API_KEY = Deno.env.get("CRM_API_KEY") || "solve-crm-api-key-2024";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "content-type, authorization",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const { name, email, phone, company, source, notes, lead_id } = body;

    if (!name || name.trim().length < 2) {
      return new Response(JSON.stringify({ error: "Nome é obrigatório" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 1. Guardar na tabela fit90_leads (registo local + idempotência)
    const { data: localLead, error: insertErr } = await supabase
      .from("fit90_leads")
      .insert({
        name: name.trim(),
        email: email || null,
        phone: phone || null,
        company: company || null,
        source: source || "fit90_landing",
        notes: notes || null,
      })
      .select()
      .single();

    if (insertErr) {
      console.error("Erro ao inserir fit90_leads:", insertErr);
      return new Response(JSON.stringify({ error: "Erro ao guardar lead" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Empurrar para o CRM (POST /api/v1/leads)
    const externalId = lead_id || localLead.id;

    const crmRes = await fetch(`${CRM_URL}/api/v1/leads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": CRM_API_KEY,
      },
      body: JSON.stringify({
        name: name.trim(),
        email: email || undefined,
        phone: phone || undefined,
        company: company || undefined,
        source: source || "fit90_landing",
        notes: notes || undefined,
        externalId: externalId,
      }),
    });

    const crmData = await crmRes.json();

    if (!crmRes.ok) {
      // Marcar erro no registo local
      await supabase
        .from("fit90_leads")
        .update({ error: crmData.error || `HTTP ${crmRes.status}` })
        .eq("id", localLead.id);

      console.error("CRM rejeitou:", crmRes.status, crmData);
      return new Response(
        JSON.stringify({ error: "CRM rejeitou o lead", detail: crmData }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    // 3. Marcar como empurrado com sucesso
    await supabase
      .from("fit90_leads")
      .update({
        pushed: true,
        pushed_at: new Date().toISOString(),
        crm_lead_id: crmData.data?.id || null,
      })
      .eq("id", localLead.id);

    return new Response(
      JSON.stringify({ ok: true, lead: crmData.data }),
      {
        status: 201,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (err) {
    console.error("Erro inesperado:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

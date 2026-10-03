// claim-notify — új orvos-adatlap átvételi kérelmet jelez e-mailben.
// v2 (audit, 2026-10-03): rate limit + kérelmenként max 1 e-mail + kapcsolat@ címzett
//
// Szükséges környezet:
//   RESEND_API_KEY — a Resend.com API kulcsa (https://resend.com/api-keys)
//   FROM_EMAIL     — a feladó-cím (alap: noreply@szakorvos.hu)
//
// Hívás:  POST { request_id: UUID }
//        (a request_id alapján a fv kiolvassa az adatokat a doctor_claim_requests táblából)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "noreply@szakorvos.hu";
const TO_EMAIL = Deno.env.get("CONTACT_TO") || "kapcsolat@szakorvos.hu";

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

function escapeHtml(s: string | null | undefined): string {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function sha(t: string) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sendViaResend(subject: string, html: string, text: string) {
  if (!RESEND_API_KEY) {
    console.warn("[claim-notify] RESEND_API_KEY hiányzik — nem küldött e-mailt.");
    return { ok: false, error: "missing_api_key" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `Szakorvos.hu <${FROM_EMAIL}>`,
      to: [TO_EMAIL],
      subject,
      html,
      text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[claim-notify] Resend hiba:", res.status, body);
    return { ok: false, error: `resend_${res.status}`, body };
  }

  const data = await res.json();
  return { ok: true, id: data.id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders() });

  try {
    const { request_id } = await req.json();
    if (!request_id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(request_id))) {
      return new Response(JSON.stringify({ error: "missing request_id" }), {
        status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    // — Rate limit (audit, 2026-10-03): 5/óra/IP, és kérelmenként max 1 e-mail —
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "anon";
    const ipKey = (await sha("cn|" + ip)).slice(0, 24);
    const { data: okIp } = await db.rpc("v2_rate_hit", { p_key: "cn:" + ipKey, p_window_sec: 3600, p_max: 5 });
    if (okIp === false) {
      return new Response(JSON.stringify({ error: "rate_limited" }), {
        status: 429, headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }
    const { data: okReq } = await db.rpc("v2_rate_hit", { p_key: "cnreq:" + String(request_id), p_window_sec: 86400, p_max: 1 });
    if (okReq === false) {
      return new Response(JSON.stringify({ ok: true, skipped: "already_notified" }), {
        status: 200, headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    // 1. Kérelem lekérdezése + orvos adatai
    const { data: claim, error: claimErr } = await db
      .from("doctor_claim_requests")
      .select("id, doctor_id, full_name, email, phone, enkep_number, workplace, message, status, created_at")
      .eq("id", request_id).single();

    if (claimErr || !claim) {
      return new Response(JSON.stringify({ error: "claim not found", details: claimErr?.message }), {
        status: 404, headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    let doctorName = "Ismeretlen orvos";
    let doctorSlug = "";
    if (claim.doctor_id) {
      const { data: doc } = await db.from("doctors")
        .select("name, title, slug").eq("id", claim.doctor_id).single();
      if (doc) {
        doctorName = `${doc.title ? doc.title + " " : ""}${doc.name}`.trim();
        doctorSlug = doc.slug || "";
      }
    }

    const doctorUrl = doctorSlug ? `https://www.szakorvos.hu/orvos/${doctorSlug}` : "https://www.szakorvos.hu";

    // 2. E-mail törzs (HTML)
    const subject = `Új adatlap átvételi kérelem: ${doctorName}`;

    const html = `
<!doctype html>
<html lang="hu">
<body style="margin:0;padding:0;font-family:'Inter',Arial,sans-serif;color:#0f172a;background:#f4f6f8">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px">
    <div style="background:#fff;border-radius:14px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.06)">
      <h1 style="font-size:20px;color:#113293;margin:0 0 8px;font-weight:700">Új adatlap átvételi kérelem</h1>
      <p style="font-size:14px;color:#6b7a9a;margin:0 0 24px">Egy orvos igényelte a saját profilját a Szakorvos.hu-n.</p>

      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;color:#475569;width:35%">Orvos profil</td>
            <td style="padding:8px 0;border-bottom:1px solid #eee"><a href="${doctorUrl}" style="color:#264ACA">${escapeHtml(doctorName)}</a></td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;color:#475569">Név</td>
            <td style="padding:8px 0;border-bottom:1px solid #eee">${escapeHtml(claim.full_name)}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;color:#475569">E-mail</td>
            <td style="padding:8px 0;border-bottom:1px solid #eee"><a href="mailto:${escapeHtml(claim.email)}" style="color:#264ACA">${escapeHtml(claim.email)}</a></td></tr>
        ${claim.phone ? `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;color:#475569">Telefon</td>
            <td style="padding:8px 0;border-bottom:1px solid #eee">${escapeHtml(claim.phone)}</td></tr>` : ""}
        ${claim.enkep_number ? `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;color:#475569">ENKK / pecsétszám</td>
            <td style="padding:8px 0;border-bottom:1px solid #eee">${escapeHtml(claim.enkep_number)}</td></tr>` : ""}
        ${claim.workplace ? `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;color:#475569">Munkahely</td>
            <td style="padding:8px 0;border-bottom:1px solid #eee">${escapeHtml(claim.workplace)}</td></tr>` : ""}
      </table>

      ${claim.message ? `<div style="background:#f8fafc;border-left:3px solid #264ACA;padding:12px 14px;border-radius:6px;margin-bottom:24px">
        <div style="font-size:11px;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Üzenet</div>
        <div style="font-size:14px;line-height:1.55;white-space:pre-wrap">${escapeHtml(claim.message)}</div>
      </div>` : ""}

      <p style="font-size:12px;color:#94a3b8;margin:0;padding-top:16px;border-top:1px solid #eee">
        Beérkezési idő: ${new Date(claim.created_at).toLocaleString("hu-HU")}<br>
        Kérelem ID: <code style="font-family:monospace;font-size:11px">${claim.id}</code>
      </p>
    </div>
  </div>
</body>
</html>`;

    const text = `Új adatlap átvételi kérelem

Orvos: ${doctorName}
Profil: ${doctorUrl}

Igénylő adatai:
  Név: ${claim.full_name}
  E-mail: ${claim.email}
  ${claim.phone ? "Telefon: " + claim.phone : ""}
  ${claim.enkep_number ? "ENKK: " + claim.enkep_number : ""}
  ${claim.workplace ? "Munkahely: " + claim.workplace : ""}

${claim.message ? "Üzenet:\n" + claim.message : ""}

Beérkezés: ${new Date(claim.created_at).toLocaleString("hu-HU")}
Kérelem ID: ${claim.id}`;

    const result = await sendViaResend(subject, html, text);

    return new Response(JSON.stringify(result), {
      status: result.ok ? 200 : 500,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[claim-notify] hiba:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  }
});

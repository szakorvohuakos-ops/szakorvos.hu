// Supabase Edge Function: send-contact-email (slug: bright-responder)
// 1) Értesíti a kapcsolat@szakorvos.hu-t az új üzenetről
// 2) Visszaigazolást küld a látogatónak ("megkaptuk, hamarosan válaszolunk")
//
// Secret-ek: RESEND_API_KEY, CONTACT_TO, CONTACT_FROM

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

async function sendEmail(apiKey: string, payload: Record<string, unknown>) {
  return await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { name, email, topic, message } = await req.json();

    if (!name || !email || !message) {
      return new Response(JSON.stringify({ error: "Hiányzó mező" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const CONTACT_TO = Deno.env.get("CONTACT_TO") ?? "kapcsolat@szakorvos.hu";
    const CONTACT_FROM = Deno.env.get("CONTACT_FROM") ?? "Szakorvos.hu <noreply@szakorvos.hu>";

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY nincs beállítva" }), {
        status: 500, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // 1) Értesítés a csapatnak (kapcsolat@)
    const adminHtml = `
      <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1a1f36">
        <h2 style="color:#113293;margin:0 0 4px">Új üzenet a kapcsolati űrlapról</h2>
        <p style="color:#64748b;margin:0 0 18px;font-size:13px">Szakorvos.hu — kapcsolat</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:8px 0;color:#64748b;width:120px">Név</td><td style="padding:8px 0;font-weight:600">${esc(name)}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b">E-mail</td><td style="padding:8px 0"><a href="mailto:${esc(email)}">${esc(email)}</a></td></tr>
          <tr><td style="padding:8px 0;color:#64748b">Téma</td><td style="padding:8px 0">${esc(topic || "—")}</td></tr>
        </table>
        <div style="margin-top:14px;padding:14px 16px;background:#f4f7ff;border:1px solid #e4e8f0;border-radius:10px;white-space:pre-wrap;line-height:1.5">${esc(message)}</div>
      </div>`;

    const adminRes = await sendEmail(RESEND_API_KEY, {
      from: CONTACT_FROM,
      to: [CONTACT_TO],
      reply_to: email,
      subject: `Új kapcsolati üzenet — ${name}${topic ? " (" + topic + ")" : ""}`,
      html: adminHtml,
    });

    if (!adminRes.ok) {
      const errText = await adminRes.text();
      return new Response(JSON.stringify({ error: "Resend hiba (admin)", detail: errText }), {
        status: 502, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // 2) Visszaigazolás a látogatónak
    const userHtml = `
      <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1a1f36">
        <h2 style="color:#113293;margin:0 0 10px">Köszönjük üzenetét!</h2>
        <p style="font-size:14px;line-height:1.6;color:#3c4564;margin:0 0 14px">
          Kedves ${esc(name)},<br><br>
          Megkaptuk az üzenetét, és hamarosan válaszolunk. Általában 1-2 munkanapon belül felvesszük Önnel a kapcsolatot.
        </p>
        <div style="margin:18px 0;padding:14px 16px;background:#f4f7ff;border:1px solid #e4e8f0;border-radius:10px">
          <div style="font-size:12px;color:#64748b;margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em">Az Ön üzenete</div>
          <div style="font-size:14px;white-space:pre-wrap;line-height:1.5;color:#1a1f36">${esc(message)}</div>
        </div>
        <p style="font-size:13px;color:#94a3b8;margin-top:18px;line-height:1.5">
          Ha bármi kiegészítenivalója van, nyugodtan válaszoljon erre az e-mailre.
        </p>
        <p style="font-size:14px;color:#113293;font-weight:600;margin-top:18px">Szakorvos.hu csapata</p>
      </div>`;

    // A visszaigazolás hibája NE buktassa a fő folyamatot
    try {
      await sendEmail(RESEND_API_KEY, {
        from: CONTACT_FROM,
        to: [email],
        reply_to: CONTACT_TO,
        subject: "Köszönjük üzenetét — Szakorvos.hu",
        html: userHtml,
      });
    } catch (_) { /* csendben */ }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});

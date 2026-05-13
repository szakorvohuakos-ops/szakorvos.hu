// supabase/functions/og-image/index.ts
// ────────────────────────────────────────────────────────────────────────────
// Szakorvos.hu — Dinamikus OG (Open Graph) kép generátor
//
// Minden orvos / cikk / találat oldalhoz egyedi 1200×630 SVG kép, amit a
// social platformok automatikusan PNG-vé konvertálnak (Facebook, Twitter,
// LinkedIn, Slack, stb.).
//
// Útvonalak (Vercel rewrite-tal):
//   /og?type=doctor&slug=dr-kiss-janos
//   /og?type=article&slug=fogfajas
//   /og?type=search&q=Kardiológus+Budapest
//   /og?type=logo                                  ← organization schema-hoz
//
// Deploy:
//   supabase functions deploy og-image --no-verify-jwt
//
// MEGJEGYZÉS:
//   SVG-t adunk vissza, nem PNG-t. A legtöbb social crawler képes a
//   `image/svg+xml`-t kezelni, de a Twitter és néhány régebbi platform
//   PNG-t vár. Ha pixelpontos PNG kell, a satori + resvg-wasm kombinációval
//   átalakítható — ez jelenleg túl ad lenne ehhez (a setup hetekbe telne).
//   Az SVG output a legtöbb modern crawler-en jól működik.
// ────────────────────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getDb() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { persistSession: false } });
}

// ─── Szöveg-tördelés SVG-ben (text-wrap nincs, manuálisan) ────────────────
function wrapText(text: string, maxCharsPerLine: number, maxLines = 3): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    if (current.length + w.length + 1 <= maxCharsPerLine) {
      current = current ? current + " " + w : w;
    } else {
      if (current) lines.push(current);
      current = w;
      if (lines.length >= maxLines - 1) {
        // utolsó sor: maradék összefűzve, ha túl hosszú, levágjuk
        if (current.length > maxCharsPerLine) {
          current = current.slice(0, maxCharsPerLine - 1) + "…";
        }
        lines.push(current);
        return lines;
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

// ─── SVG sablon ───────────────────────────────────────────────────────────
interface OgOptions {
  badge?:    string;   // pl. "Kardiológia"
  title:     string;   // fő cím
  subtitle?: string;   // alcím
  emoji?:    string;   // pl. "❤️"
  accent?:   "blue" | "orange" | "green";
}

function buildSvg(opts: OgOptions): string {
  const accentColor =
    opts.accent === "orange" ? "#FF8A00" :
    opts.accent === "green"  ? "#2C9650" :
    "#264ACA";

  const titleLines = wrapText(opts.title || "", 28, 3);
  const titleY = 230; // első sor Y
  const lineH = 80;

  const subLines = opts.subtitle ? wrapText(opts.subtitle, 56, 2) : [];

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#113293"/>
      <stop offset="50%" stop-color="#1a3fb0"/>
      <stop offset="100%" stop-color="#264ACA"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.85" cy="0.15" r="0.6">
      <stop offset="0%" stop-color="${accentColor}" stop-opacity="0.35"/>
      <stop offset="60%" stop-color="${accentColor}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="dots" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1" fill="#ffffff" fill-opacity="0.06"/>
    </pattern>
  </defs>

  <!-- Háttér -->
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#dots)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>

  <!-- Brand badge bal felül -->
  <g transform="translate(64, 64)">
    <rect width="320" height="56" rx="14" fill="#ffffff" fill-opacity="0.12"/>
    <text x="28" y="38" font-family="Inter, system-ui, sans-serif" font-size="24" font-weight="700" fill="#ffffff">
      Szakorvos<tspan fill="#FFD9B8">.hu</tspan>
    </text>
  </g>

  ${opts.badge ? `
  <!-- Kategória badge -->
  <g transform="translate(64, 160)">
    <rect width="${Math.max(140, opts.badge.length * 16 + 40)}" height="44" rx="22" fill="${accentColor}"/>
    <text x="24" y="29" font-family="Inter, system-ui, sans-serif" font-size="17" font-weight="600" fill="#ffffff">${esc(opts.badge.toUpperCase())}</text>
  </g>
  ` : ""}

  <!-- Cím -->
  <g transform="translate(64, 0)">
    ${titleLines.map((line, i) =>
      `<text x="0" y="${titleY + i * lineH}" font-family="Inter, system-ui, sans-serif" font-size="68" font-weight="700" fill="#ffffff" letter-spacing="-2">${esc(line)}</text>`
    ).join("\n    ")}
  </g>

  ${subLines.length > 0 ? `
  <!-- Alcím -->
  <g transform="translate(64, ${titleY + titleLines.length * lineH + 30})">
    ${subLines.map((line, i) =>
      `<text x="0" y="${i * 38}" font-family="Inter, system-ui, sans-serif" font-size="28" font-weight="500" fill="#ffffff" fill-opacity="0.78">${esc(line)}</text>`
    ).join("\n    ")}
  </g>
  ` : ""}

  ${opts.emoji ? `
  <!-- Emoji dekoráció jobb oldalt -->
  <text x="1100" y="330" font-size="220" text-anchor="end" opacity="0.85">${esc(opts.emoji)}</text>
  ` : ""}

  <!-- Alsó CTA sáv -->
  <g transform="translate(64, 540)">
    <text x="0" y="36" font-family="Inter, system-ui, sans-serif" font-size="22" font-weight="600" fill="#ffffff" fill-opacity="0.85">www.szakorvos.hu</text>
    <text x="1072" y="36" font-family="Inter, system-ui, sans-serif" font-size="22" font-weight="500" fill="#ffffff" fill-opacity="0.65" text-anchor="end">Foglaljon online időpontot</text>
  </g>
</svg>`;
}

const SPEC_EMOJI: Record<string, string> = {
  "Kardiológia": "❤️",
  "Neurológia": "🧠",
  "Bőrgyógyászat": "🌿",
  "Gasztroenterológia": "🫁",
  "Ortopédia": "🦴",
  "Szemészet": "👁️",
  "Nőgyógyászat": "💜",
  "Fogászat": "🦷",
  "Pszichiátria": "🧩",
  "Belgyógyászat": "🩺",
  "Gyermekgyógyászat": "👶",
  "Urológia": "🔬",
  "Fül-orr-gégészet": "👂",
  "Onkológia": "🎗️",
  "Allergológia": "🌸",
  "Reumatológia": "🦴",
};

Deno.serve(async (req) => {
  const url  = new URL(req.url);
  const type = url.searchParams.get("type") || "logo";
  const slug = url.searchParams.get("slug") || "";

  let opts: OgOptions = {
    title: "Szakorvos.hu",
    subtitle: "Találjon szakorvost. Foglaljon időpontot.",
    accent: "blue",
    emoji: "🩺",
  };

  try {
    const db = getDb();

    if (type === "doctor" && slug) {
      const isUuid = /^[0-9a-f-]{36}$/i.test(slug);
      const q = db.from("doctors").select(`
        name, title,
        doctor_specialties(specialties(name))
      `).limit(1);
      const { data } = isUuid ? await q.eq("id", slug) : await q.eq("slug", slug);
      if (data && data.length) {
        const d = data[0];
        const spec = d.doctor_specialties?.[0]?.specialties?.name || "Szakorvos";
        opts = {
          title:    `${d.title ? d.title + " " : ""}${d.name}`,
          subtitle: spec,
          badge:    spec,
          emoji:    SPEC_EMOJI[spec] || "🩺",
          accent:   "blue",
        };
      }
    } else if (type === "article" && slug) {
      const { data } = await db.from("knowledge_articles")
        .select("title, specialty")
        .eq("slug", slug)
        .limit(1);
      if (data && data.length) {
        const a = data[0];
        opts = {
          title:    a.title,
          subtitle: a.specialty || "Egészségügyi tudástár",
          badge:    a.specialty || "Tudástár",
          emoji:    SPEC_EMOJI[a.specialty] || "📚",
          accent:   "orange",
        };
      }
    } else if (type === "search") {
      const q = url.searchParams.get("q") || "Szakorvos kereső";
      opts = {
        title:    q,
        subtitle: "Az Ön közelében – értékelések, időpontok, foglalás",
        badge:    "Találatok",
        emoji:    "🔍",
        accent:   "blue",
      };
    } else if (type === "logo") {
      // Default org logo (organization schema-hoz)
      opts = {
        title:    "Szakorvos.hu",
        subtitle: "Magyarország országos szakorvos keresője",
        emoji:    "🩺",
        accent:   "blue",
      };
    }
  } catch (e) {
    console.error("[og-image]", e);
    // Fall through to default opts
  }

  const svg = buildSvg(opts);

  return new Response(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
});

// supabase/functions/sitemap/index.ts
// ────────────────────────────────────────────────────────────────────────────
// Dinamikus sitemap.xml a Szakorvos.hu-hoz.
//
// Tartalmazza:
//   • statikus oldalak (index, talalatok, tudastar, vizsgalatok, login,
//     register, adatvedelem)
//   • az összes aktív orvos: /orvos.html?id={uuid}
//   • az összes közzétett tudástár cikk: /tudastar-cikk.html?slug={slug}
//
// Telepítés:
//   1.  supabase functions deploy sitemap --no-verify-jwt
//   2.  Vercel/Cloudflare-en route-old:
//         /sitemap.xml   →   .../functions/v1/sitemap
//       (vagy frissítsd a robots.txt-t a függvény URL-jére).
//
// Megj.: nem hitelesített, mert a robotok nem küldenek JWT-t.
//        Csak publikus mezőket válogat ki.
//
// Cache: a Cache-Control header 6 órás cache-elést kér a CDN-től /
// böngészőtől. Igény szerint módosítható.
// ────────────────────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_BASE = "https://www.szakorvos.hu";

// Lapozás: ha nagyon sok cikked / orvosod van (3000+), a Supabase REST API
// alapból max 1000 sort ad vissza. Lapozással mindet behúzzuk.
const PAGE_SIZE = 1000;

const STATIC_URLS: { loc: string; changefreq: string; priority: string }[] = [
  { loc: "/",                    changefreq: "daily",   priority: "1.0" },
  { loc: "/talalatok.html",      changefreq: "daily",   priority: "0.9" },
  { loc: "/tudastar.html",       changefreq: "weekly",  priority: "0.8" },
  { loc: "/vizsgalatok.html",    changefreq: "weekly",  priority: "0.8" },
  { loc: "/login.html",          changefreq: "monthly", priority: "0.4" },
  { loc: "/register.html",       changefreq: "monthly", priority: "0.4" },
  { loc: "/adatvedelem.html",    changefreq: "yearly",  priority: "0.3" },
];

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildUrlEntry(loc: string, changefreq: string, priority: string, lastmod?: string): string {
  const parts = [
    `  <url>`,
    `    <loc>${escapeXml(loc)}</loc>`,
    lastmod ? `    <lastmod>${escapeXml(lastmod)}</lastmod>` : "",
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    `  </url>`,
  ].filter(Boolean);
  return parts.join("\n");
}

async function fetchAllPages<T>(
  query: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  // védőszelep: max 50 lap = 50 000 sor (bőven elég)
  for (let i = 0; i < 50; i++) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await query(from, to);
    if (error) {
      console.error("[sitemap] query error:", error);
      break;
    }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

Deno.serve(async (req) => {
  // CORS — a Google bot nem küldi, de a teszteléshez kell lehet
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  // SERVICE_ROLE kulcs, hogy az RLS-t megkerülje és minden publikus
  // sort visszaadjon. Csak read-only műveletet végzünk.
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new Response("Server misconfiguration", { status: 500 });
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // ── Orvosok ──────────────────────────────────────────────────────────────
  const doctors = await fetchAllPages<{ id: string; updated_at: string | null }>(
    (from, to) =>
      db.from("doctors")
        .select("id, updated_at")
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .range(from, to),
  );

  // ── Tudástár cikkek ──────────────────────────────────────────────────────
  // Csak azokat tesszük be, amelyiknek van content-je (= publikált).
  const articles = await fetchAllPages<{ slug: string; updated_at: string | null }>(
    (from, to) =>
      db.from("knowledge_articles")
        .select("slug, updated_at")
        .not("content", "is", null)
        .not("slug", "is", null)
        .order("updated_at", { ascending: false })
        .range(from, to),
  );

  // ── XML összerakása ──────────────────────────────────────────────────────
  const today = new Date().toISOString().split("T")[0];

  const xmlParts: string[] = [];
  xmlParts.push('<?xml version="1.0" encoding="UTF-8"?>');
  xmlParts.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');

  // Statikus oldalak
  for (const s of STATIC_URLS) {
    xmlParts.push(buildUrlEntry(SITE_BASE + s.loc, s.changefreq, s.priority, today));
  }

  // Orvos profilok
  for (const d of doctors) {
    const lastmod = d.updated_at ? d.updated_at.split("T")[0] : today;
    xmlParts.push(
      buildUrlEntry(
        `${SITE_BASE}/orvos.html?id=${encodeURIComponent(d.id)}`,
        "weekly",
        "0.7",
        lastmod,
      ),
    );
  }

  // Tudástár cikkek
  for (const a of articles) {
    const lastmod = a.updated_at ? a.updated_at.split("T")[0] : today;
    xmlParts.push(
      buildUrlEntry(
        `${SITE_BASE}/tudastar-cikk.html?slug=${encodeURIComponent(a.slug)}`,
        "monthly",
        "0.6",
        lastmod,
      ),
    );
  }

  xmlParts.push("</urlset>");
  const xml = xmlParts.join("\n");

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // 6 órás CDN cache: gyors válasz a botoknak, de napi frissesség
      "Cache-Control": "public, max-age=21600, s-maxage=21600",
      "Access-Control-Allow-Origin": "*",
      "X-Total-Doctors": String(doctors.length),
      "X-Total-Articles": String(articles.length),
    },
  });
});

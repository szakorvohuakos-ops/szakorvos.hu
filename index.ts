// supabase/functions/sitemap/index.ts
// ────────────────────────────────────────────────────────────────────────────
// Szakorvos.hu — Dinamikus sitemap.xml
//
// Tartalom:
//   • Statikus oldalak
//   • Az összes aktív orvos:    /orvos/{slug}   + dinamikus OG kép (image:image)
//   • Az összes közzétett cikk: /tudastar/{slug} + OG kép
//   • Top szakterület+város találatok:  /talalatok/{city}/{specialty}
//
// Lapozás 1000-es batchekkel, lastmod az updated_at-ből.
//
// Deploy:  supabase functions deploy sitemap --no-verify-jwt
// ────────────────────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_BASE = "https://www.szakorvos.hu";
const PAGE_SIZE = 1000;

const STATIC_URLS: { loc: string; changefreq: string; priority: string }[] = [
  { loc: "/",                 changefreq: "daily",   priority: "1.0" },
  { loc: "/talalatok",        changefreq: "daily",   priority: "0.9" },
  { loc: "/klinikak",         changefreq: "weekly",  priority: "0.85" },
  { loc: "/tudastar",         changefreq: "weekly",  priority: "0.8" },
  { loc: "/vizsgalatok",      changefreq: "weekly",  priority: "0.8" },
  { loc: "/login.html",       changefreq: "monthly", priority: "0.4" },
  { loc: "/register.html",    changefreq: "monthly", priority: "0.5" },
  { loc: "/adatvedelem.html", changefreq: "yearly",  priority: "0.3" },
];

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function urlEntry(opts: {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
  image?: { loc: string; title?: string };
}): string {
  const lines = [
    "  <url>",
    `    <loc>${escapeXml(opts.loc)}</loc>`,
    opts.lastmod    ? `    <lastmod>${escapeXml(opts.lastmod)}</lastmod>`        : "",
    opts.changefreq ? `    <changefreq>${opts.changefreq}</changefreq>`         : "",
    opts.priority   ? `    <priority>${opts.priority}</priority>`               : "",
  ];
  if (opts.image) {
    lines.push(
      "    <image:image>",
      `      <image:loc>${escapeXml(opts.image.loc)}</image:loc>`,
      opts.image.title ? `      <image:title>${escapeXml(opts.image.title)}</image:title>` : "",
      "    </image:image>",
    );
  }
  lines.push("  </url>");
  return lines.filter(Boolean).join("\n");
}

async function fetchAllPages<T>(
  fn: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  for (let i = 0; i < 50; i++) {
    const { data, error } = await fn(from, from + PAGE_SIZE - 1);
    if (error) {
      console.error("[sitemap] query error", error);
      break;
    }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

function citySlug(s: string): string {
  return s.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin":  "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      },
    });
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!url || !key) return new Response("Server misconfiguration", { status: 500 });

  const db = createClient(url, key, { auth: { persistSession: false } });

  // ── Orvosok ──────────────────────────────────────────────────────────────
  const doctors = await fetchAllPages<{
    id: string;
    slug: string | null;
    name: string;
    updated_at: string | null;
    doctor_specialties: { is_primary: boolean; specialties: { doctor_slug: string | null } | null }[] | null;
  }>(
    (from, to) =>
      db.from("doctors")
        .select("id, slug, name, updated_at, doctor_specialties(is_primary, specialties(doctor_slug))")
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .range(from, to),
  );

  // ── Tudástár cikkek ──────────────────────────────────────────────────────
  const articles = await fetchAllPages<{ slug: string; title: string; updated_at: string | null }>(
    (from, to) =>
      db.from("knowledge_articles")
        .select("slug, title, updated_at")
        .not("content", "is", null)
        .not("slug", "is", null)
        .order("updated_at", { ascending: false })
        .range(from, to),
  );

  // ── Klinikák ─────────────────────────────────────────────────────────────
  const clinics = await fetchAllPages<{ id: string; slug: string | null; name: string; created_at: string | null }>(
    (from, to) =>
      db.from("clinics")
        .select("id, slug, name, created_at")
        .order("created_at", { ascending: false })
        .range(from, to),
  );

  // ── Szakterület + város kombinációk (top találati oldalak SEO-ra) ─────────
  // Fallback megoldás: top 12 város × összes szakterület.
  // (Optimalizációként Postgres view-val cserélhető a tényleges aktív
  // orvossal rendelkező kombinációkra.)
  const TOP_CITIES = [
    "Budapest", "Debrecen", "Szeged", "Miskolc", "Pécs", "Győr",
    "Nyíregyháza", "Kecskemét", "Székesfehérvár", "Szombathely",
    "Szolnok", "Tatabánya"
  ];
  const { data: specs } = await db.from("specialties").select("name").limit(200);
  const specialtyCityPairs: { city: string; specialty: string }[] = [];
  for (const city of TOP_CITIES) {
    for (const s of specs || []) {
      specialtyCityPairs.push({ city, specialty: s.name });
    }
  }

  // ── XML build ────────────────────────────────────────────────────────────
  const today = new Date().toISOString().split("T")[0];
  const out: string[] = [];
  out.push('<?xml version="1.0" encoding="UTF-8"?>');
  out.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
  out.push('        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">');

  // Statikus
  for (const s of STATIC_URLS) {
    out.push(urlEntry({
      loc: SITE_BASE + s.loc,
      lastmod: today,
      changefreq: s.changefreq,
      priority: s.priority,
    }));
  }

  // Orvosok
  for (const d of doctors) {
    const slugOrId = d.slug || d.id;
    const lastmod  = d.updated_at ? d.updated_at.split("T")[0] : today;
    // SEO URL: /:specialty/:slug ha mindkettő megvan, különben fallback /orvos/:slug
    const primarySpec = (d.doctor_specialties || []).find(s => s.is_primary) || d.doctor_specialties?.[0];
    const specSlug = primarySpec?.specialties?.doctor_slug;
    const docUrl = (specSlug && d.slug)
      ? `${SITE_BASE}/${specSlug}/${d.slug}`
      : `${SITE_BASE}/orvos/${slugOrId}`;
    out.push(urlEntry({
      loc:      docUrl,
      lastmod,
      changefreq: "weekly",
      priority:   "0.7",
      image: {
        loc:   `${SITE_BASE}/og?type=doctor&slug=${encodeURIComponent(slugOrId)}`,
        title: d.name,
      },
    }));
  }

  // Cikkek
  for (const a of articles) {
    const lastmod = a.updated_at ? a.updated_at.split("T")[0] : today;
    out.push(urlEntry({
      loc:      `${SITE_BASE}/tudastar/${a.slug}`,
      lastmod,
      changefreq: "monthly",
      priority:   "0.6",
      image: {
        loc:   `${SITE_BASE}/og?type=article&slug=${encodeURIComponent(a.slug)}`,
        title: a.title,
      },
    }));
  }

  // Klinikák
  for (const c of clinics) {
    const slugOrId = c.slug || c.id;
    const lastmod  = c.created_at ? c.created_at.split("T")[0] : today;
    out.push(urlEntry({
      loc:        `${SITE_BASE}/klinikak/${slugOrId}`,
      lastmod,
      changefreq: "monthly",
      priority:   "0.65",
    }));
  }

  // Top szakterület+város találati oldalak (long-tail SEO)
  // Max 300, hogy a sitemap kezelhető méretű maradjon.
  for (const pair of specialtyCityPairs.slice(0, 300)) {
    out.push(urlEntry({
      loc:        `${SITE_BASE}/talalatok/${citySlug(pair.city)}/${citySlug(pair.specialty)}`,
      lastmod:    today,
      changefreq: "weekly",
      priority:   "0.6",
    }));
  }

  out.push("</urlset>");
  const xml = out.join("\n");

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type":  "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=21600, s-maxage=21600",
      "Access-Control-Allow-Origin": "*",
      "X-Total-Doctors":  String(doctors.length),
      "X-Total-Articles": String(articles.length),
      "X-Total-Search":   String(Math.min(specialtyCityPairs.length, 300)),
    },
  });
});

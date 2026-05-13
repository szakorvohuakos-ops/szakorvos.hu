// supabase/functions/seo-render/index.ts
// ────────────────────────────────────────────────────────────────────────────
// Szakorvos.hu — Bot-prerender Edge Function
//
// CÉL:
//   A keresőmotorok (Google, Bing) és social crawler-ek (Facebook, Twitter,
//   Slack, LinkedIn, Telegram, stb.) nem futtatnak / nehezen futtatnak
//   JavaScript-et. Számukra statikus HTML-t adunk vissza a fő SEO oldalakon:
//     • /orvos/{slug}     → orvos profil HTML, Physician schema-val
//     • /tudastar/{slug}  → cikk HTML, MedicalWebPage schema-val
//     • /talalatok/...    → találati lista HTML, ItemList schema-val
//
//   Sima böngészőknek (User-Agent alapján) visszaadjuk a normál SPA fájlt
//   (orvos.html / tudastar-cikk.html / talalatok.html), amit a kliens JS
//   tovább hidratál.
//
// ROUTING (Vercel rewrite-on keresztül):
//   /orvos/:slug         → /functions/v1/seo-render?type=doctor&slug=:slug
//   /tudastar/:slug      → /functions/v1/seo-render?type=article&slug=:slug
//   /talalatok/:city/:specialty?  → /functions/v1/seo-render?type=search&...
//
// Deploy:
//   supabase functions deploy seo-render --no-verify-jwt
// ────────────────────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_BASE = "https://www.szakorvos.hu";

// ─── User-Agent detektálás ─────────────────────────────────────────────────
const BOT_PATTERNS = [
  /googlebot/i,
  /bingbot/i,
  /slurp/i,                  // Yahoo
  /duckduckbot/i,
  /baiduspider/i,
  /yandex/i,
  /sogou/i,
  /facebookexternalhit/i,
  /facebot/i,
  /twitterbot/i,
  /linkedinbot/i,
  /slackbot/i,
  /telegrambot/i,
  /whatsapp/i,
  /discordbot/i,
  /applebot/i,
  /pinterest/i,
  /skypeuripreview/i,
  /vkshare/i,
  /redditbot/i,
  /gptbot/i,                 // OpenAI
  /claudebot/i,
  /perplexitybot/i,
  /chatgpt-user/i,
];

function isBot(userAgent: string | null): boolean {
  if (!userAgent) return false;
  return BOT_PATTERNS.some((re) => re.test(userAgent));
}

// HTML escape — minden user-controlled adatot ezen át kell engedni
function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ─── Supabase kliens (service role, read-only műveletek) ───────────────────
function getDb() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing SUPABASE_URL / SERVICE_ROLE_KEY env");
  return createClient(url, key, { auth: { persistSession: false } });
}


// ═══════════════════════════════════════════════════════════════════════════
// HTML TEMPLATE-EK
// ═══════════════════════════════════════════════════════════════════════════

const COMMON_HEAD = `<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#113293">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://asgnkjmwzhbczpvetprh.supabase.co">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">`;

const COMMON_CSS = `<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',sans-serif;background:#F4F6F8;color:#113293;line-height:1.6;-webkit-font-smoothing:antialiased}
a{color:#113293;text-decoration:none}
a:hover{text-decoration:underline}
.container{max-width:1200px;margin:0 auto;padding:24px 4%}
nav{background:#fff;border-bottom:1px solid #DCE3EA;padding:14px 4%}
nav a{font-weight:700;color:#113293}
nav em{color:#FF8A00;font-style:normal}
h1{font-size:2rem;font-weight:600;color:#113293;letter-spacing:-0.03em;margin:0 0 12px}
h2{font-size:1.35rem;font-weight:600;color:#113293;margin:24px 0 10px;letter-spacing:-0.02em}
h3{font-size:1.05rem;font-weight:600;color:#113293;margin:18px 0 8px}
p{margin:0 0 14px;color:#475569}
.breadcrumb{font-size:13px;color:#94a3b8;margin-bottom:18px}
.breadcrumb a{color:#475569}
.breadcrumb span{margin:0 8px;color:#cbd5e1}
.badge{display:inline-block;font-size:12px;font-weight:600;color:#113293;background:#eef2ff;padding:5px 12px;border-radius:100px;margin-bottom:14px}
.card{background:#fff;border:1px solid #DCE3EA;border-radius:14px;padding:24px;margin-bottom:18px}
.list-item{padding:12px 0;border-bottom:1px solid #f0f4ff}
.list-item:last-child{border-bottom:none}
.meta{display:flex;gap:20px;font-size:13px;color:#475569;margin-bottom:18px;flex-wrap:wrap}
.meta-item{display:flex;align-items:center;gap:6px}
ul,ol{padding-left:22px;margin-bottom:14px;color:#475569}
li{margin-bottom:6px}
strong{color:#113293}
.cta{display:inline-block;background:#FF8A00;color:#fff;padding:12px 24px;border-radius:10px;font-weight:600;margin-top:16px}
.cta:hover{background:#e57a00;text-decoration:none}
.footer{margin-top:48px;padding:24px 4%;background:#fff;border-top:1px solid #DCE3EA;text-align:center;font-size:13px;color:#94a3b8}
</style>`;

function renderHeader(): string {
  return `<nav><a href="/">Szakorvos<em>.hu</em></a></nav>`;
}

function renderFooter(): string {
  return `<footer class="footer">
    <a href="/">Főoldal</a> ·
    <a href="/tudastar">Tudástár A–Z</a> ·
    <a href="/vizsgalatok">Vizsgálatok</a> ·
    <a href="/adatvedelem.html">Adatvédelem</a>
    <p style="margin-top:8px">© Szakorvos.hu</p>
  </footer>`;
}


// ═══════════════════════════════════════════════════════════════════════════
// 1. ORVOS PROFIL OLDAL — Physician schema
// ═══════════════════════════════════════════════════════════════════════════
async function renderDoctor(slug: string): Promise<{ html: string; status: number }> {
  const db = getDb();
  // Slug vagy ID alapú kereses (visszafele kompatibilitás)
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);

  const query = db.from("doctors").select(`
    id, name, title, bio, slug, email, phone, profile_image_url, is_active,
    doctor_specialties(specialties(name, icon)),
    doctor_clinics(clinics(name, address, cities(name))),
    doctor_services(name, price_huf),
    doctor_faq(question, answer)
  `).limit(1);

  const { data, error } = isUuid
    ? await query.eq("id", slug)
    : await query.eq("slug", slug);

  if (error || !data || data.length === 0) {
    return { html: renderNotFound("Orvos nem található", slug), status: 404 };
  }
  const d = data[0];
  if (!d.is_active) {
    return { html: renderNotFound("Az orvos profil jelenleg nem aktív", slug), status: 410 };
  }

  const fullName = `${d.title ? d.title + " " : ""}${d.name}`;
  const specialties: string[] = (d.doctor_specialties || [])
    .map((ds: any) => ds.specialties?.name)
    .filter(Boolean);
  const primarySpec = specialties[0] || "Szakorvos";

  const clinics = (d.doctor_clinics || [])
    .map((dc: any) => ({
      name: dc.clinics?.name,
      address: dc.clinics?.address,
      city: dc.clinics?.cities?.name,
    }))
    .filter((c: any) => c.name);

  const services = (d.doctor_services || []).filter((s: any) => s?.name);
  const faqs = (d.doctor_faq || []).filter((f: any) => f?.question && f?.answer);

  const canonical = `${SITE_BASE}/orvos/${d.slug || d.id}`;
  const ogImage   = `${SITE_BASE}/og?type=doctor&slug=${encodeURIComponent(d.slug || d.id)}`;

  // Meta description (160 char max ideális)
  const cityName = clinics[0]?.city || "";
  const descParts = [
    fullName,
    primarySpec,
    cityName ? `(${cityName})` : "",
    "– foglaljon online időpontot, olvasson véleményeket a Szakorvos.hu-n.",
  ].filter(Boolean);
  const description = descParts.join(" ").slice(0, 160);

  // ─── Schema.org JSON-LD ──────────────────────────────────────────────────
  const schema: any = {
    "@context": "https://schema.org",
    "@type": "Physician",
    "name": fullName,
    "url": canonical,
    "image": ogImage,
    "medicalSpecialty": specialties,
    "description": d.bio || description,
  };
  if (d.phone) schema.telephone = d.phone;
  if (d.email) schema.email = d.email;
  if (clinics.length > 0) {
    schema.worksFor = clinics.map((c: any) => ({
      "@type": "MedicalClinic",
      "name": c.name,
      "address": {
        "@type": "PostalAddress",
        "streetAddress": c.address || "",
        "addressLocality": c.city || "",
        "addressCountry": "HU",
      },
    }));
  }

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Főoldal", "item": SITE_BASE },
      { "@type": "ListItem", "position": 2, "name": "Orvosok", "item": `${SITE_BASE}/talalatok` },
      { "@type": "ListItem", "position": 3, "name": fullName, "item": canonical },
    ],
  };

  const faqSchema = faqs.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map((f: any) => ({
      "@type": "Question",
      "name": f.question,
      "acceptedAnswer": { "@type": "Answer", "text": f.answer },
    })),
  } : null;

  // ─── HTML ────────────────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="hu">
<head>
${COMMON_HEAD}
<title>${esc(fullName)} – ${esc(primarySpec)}${cityName ? ", " + esc(cityName) : ""} | Szakorvos.hu</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="profile">
<meta property="og:title" content="${esc(fullName)} – ${esc(primarySpec)} | Szakorvos.hu">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:locale" content="hu_HU">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(fullName)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(ogImage)}">
<link rel="alternate" hreflang="hu" href="${esc(canonical)}">
<link rel="alternate" hreflang="x-default" href="${esc(canonical)}">
<script type="application/ld+json">${JSON.stringify(schema)}</script>
<script type="application/ld+json">${JSON.stringify(breadcrumb)}</script>
${faqSchema ? `<script type="application/ld+json">${JSON.stringify(faqSchema)}</script>` : ""}
${COMMON_CSS}
</head>
<body>
${renderHeader()}
<main class="container" itemscope itemtype="https://schema.org/Physician">
  <nav class="breadcrumb" aria-label="Útvonal">
    <a href="/">Főoldal</a><span>›</span>
    <a href="/talalatok">Orvosok</a><span>›</span>
    ${primarySpec ? `<a href="/talalatok?specialty=${encodeURIComponent(primarySpec)}">${esc(primarySpec)}</a><span>›</span>` : ""}
    <span style="color:#475569">${esc(fullName)}</span>
  </nav>

  <article>
    <span class="badge">${esc(primarySpec)}</span>
    <h1 itemprop="name">${esc(fullName)}</h1>

    <div class="meta">
      ${specialties.length > 0 ? `<div class="meta-item">🩺 ${specialties.map(esc).join(", ")}</div>` : ""}
      ${cityName ? `<div class="meta-item" itemprop="address" itemscope itemtype="https://schema.org/PostalAddress"><span itemprop="addressLocality">📍 ${esc(cityName)}</span></div>` : ""}
      ${d.phone ? `<div class="meta-item">📞 <a href="tel:${esc(d.phone)}" itemprop="telephone">${esc(d.phone)}</a></div>` : ""}
    </div>

    ${d.bio ? `<div class="card"><h2>Bemutatkozás</h2><div itemprop="description">${esc(d.bio).replace(/\n/g, "<br>")}</div></div>` : ""}

    ${clinics.length > 0 ? `<div class="card">
      <h2>Rendelők</h2>
      ${clinics.map((c: any) => `<div class="list-item" itemprop="worksFor" itemscope itemtype="https://schema.org/MedicalClinic">
        <strong itemprop="name">${esc(c.name)}</strong>
        ${c.address || c.city ? `<div style="font-size:14px;color:#475569;margin-top:4px">${esc([c.address, c.city].filter(Boolean).join(", "))}</div>` : ""}
      </div>`).join("")}
    </div>` : ""}

    ${services.length > 0 ? `<div class="card">
      <h2>Szolgáltatások és árak</h2>
      <ul>
        ${services.map((s: any) => `<li><strong>${esc(s.name)}</strong>${s.price_huf ? ` – ${s.price_huf.toLocaleString("hu-HU")} Ft` : ""}</li>`).join("")}
      </ul>
    </div>` : ""}

    ${faqs.length > 0 ? `<div class="card">
      <h2>Gyakori kérdések</h2>
      ${faqs.map((f: any) => `<div class="list-item">
        <h3>${esc(f.question)}</h3>
        <p>${esc(f.answer)}</p>
      </div>`).join("")}
    </div>` : ""}

    <p style="margin-top:24px"><a class="cta" href="/orvos/${esc(d.slug || d.id)}">Időpont foglalás</a></p>
  </article>
</main>
${renderFooter()}
<!-- Crawler-friendly statikus HTML. A böngészők a SPA verzióra navigálnak. -->
</body>
</html>`;

  return { html, status: 200 };
}


// ═══════════════════════════════════════════════════════════════════════════
// 2. TUDÁSTÁR CIKK OLDAL — MedicalWebPage schema
// ═══════════════════════════════════════════════════════════════════════════
async function renderArticle(slug: string): Promise<{ html: string; status: number }> {
  const db = getDb();
  const { data, error } = await db
    .from("knowledge_articles")
    .select("id, title, slug, specialty, content, content_html, created_at, updated_at")
    .eq("slug", slug)
    .limit(1);

  if (error || !data || data.length === 0) {
    return { html: renderNotFound("Cikk nem található", slug), status: 404 };
  }
  const a = data[0];

  // Kapcsolódó cikkek
  const { data: related } = await db
    .from("knowledge_articles")
    .select("title, slug")
    .eq("specialty", a.specialty)
    .neq("slug", a.slug)
    .not("content", "is", null)
    .limit(8);

  const canonical = `${SITE_BASE}/tudastar/${a.slug}`;
  const ogImage   = `${SITE_BASE}/og?type=article&slug=${encodeURIComponent(a.slug)}`;
  const description = a.content
    ? a.content.replace(/<[^>]+>/g, "").trim().slice(0, 160)
    : `${a.title} – részletes orvosi tájékoztató. Tudja meg mikor és melyik szakorvoshoz forduljon.`;

  const schema = {
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    "name": a.title,
    "headline": a.title,
    "description": description,
    "url": canonical,
    "inLanguage": "hu",
    "image": ogImage,
    "datePublished": a.created_at || new Date().toISOString(),
    "dateModified": a.updated_at || a.created_at || new Date().toISOString(),
    "publisher": {
      "@type": "Organization",
      "name": "Szakorvos.hu",
      "url": SITE_BASE,
      "logo": { "@type": "ImageObject", "url": `${SITE_BASE}/og?type=logo` },
    },
    "about": { "@type": "MedicalCondition", "name": a.title },
    "specialty": a.specialty ? { "@type": "MedicalSpecialty", "name": a.specialty } : undefined,
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Főoldal", "item": SITE_BASE },
      { "@type": "ListItem", "position": 2, "name": "Tudástár A–Z", "item": `${SITE_BASE}/tudastar` },
      { "@type": "ListItem", "position": 3, "name": a.title, "item": canonical },
    ],
  };

  // Tartalom: az adatbázisban tárolt content_html vagy content
  const articleBody = a.content_html || a.content ||
    `<p>A <strong>${esc(a.title)}</strong> témakör részletes orvosi leírása.</p>`;

  const html = `<!DOCTYPE html>
<html lang="hu">
<head>
${COMMON_HEAD}
<title>${esc(a.title)} | Szakorvos.hu Tudástár</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(a.title)} | Szakorvos.hu Tudástár">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:locale" content="hu_HU">
<meta property="article:section" content="${esc(a.specialty || "Egészségügy")}">
<meta property="article:modified_time" content="${esc(a.updated_at || a.created_at || new Date().toISOString())}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(a.title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(ogImage)}">
<link rel="alternate" hreflang="hu" href="${esc(canonical)}">
<link rel="alternate" hreflang="x-default" href="${esc(canonical)}">
<script type="application/ld+json">${JSON.stringify(schema)}</script>
<script type="application/ld+json">${JSON.stringify(breadcrumb)}</script>
${COMMON_CSS}
</head>
<body>
${renderHeader()}
<main class="container" itemscope itemtype="https://schema.org/MedicalWebPage">
  <nav class="breadcrumb" aria-label="Útvonal">
    <a href="/">Főoldal</a><span>›</span>
    <a href="/tudastar">Tudástár A–Z</a><span>›</span>
    <span style="color:#475569">${esc(a.title)}</span>
  </nav>

  <article>
    ${a.specialty ? `<span class="badge">${esc(a.specialty)}</span>` : ""}
    <h1 itemprop="name">${esc(a.title)}</h1>

    <div class="meta">
      <div class="meta-item">🛡️ Ellenőrzött orvosi tartalom</div>
      <div class="meta-item">📅 Frissítve: ${esc((a.updated_at || a.created_at || "").split("T")[0])}</div>
    </div>

    <div class="card" itemprop="text">
      ${articleBody}
    </div>

    ${a.specialty ? `<div class="card">
      <h2>${esc(a.specialty)} szakorvost keres?</h2>
      <p>Találja meg a legjobb ${esc(a.specialty.toLowerCase())} szakorvost az Ön közelében.</p>
      <a class="cta" href="/talalatok?specialty=${encodeURIComponent(a.specialty)}">Szakorvosok keresése</a>
    </div>` : ""}

    ${related && related.length > 0 ? `<div class="card">
      <h2>Kapcsolódó cikkek</h2>
      <ul>
        ${related.map((r: any) => `<li><a href="/tudastar/${esc(r.slug)}">${esc(r.title)}</a></li>`).join("")}
      </ul>
    </div>` : ""}

    <p style="font-size:12px;color:#94a3b8;margin-top:24px">Ez az oldal általános tájékoztatást nyújt, és nem helyettesíti a szakorvosi vizsgálatot vagy diagnózist.</p>
  </article>
</main>
${renderFooter()}
</body>
</html>`;

  return { html, status: 200 };
}


// ═══════════════════════════════════════════════════════════════════════════
// 3. TALÁLATI LISTA (city / specialty filterrel) — ItemList schema
// ═══════════════════════════════════════════════════════════════════════════
async function renderSearch(opts: { city?: string; specialty?: string }): Promise<{ html: string; status: number }> {
  const db = getDb();

  // Query építés
  let q = db.from("doctors")
    .select(`
      id, name, title, slug, bio,
      doctor_specialties(specialties(name)),
      doctor_clinics(clinics(name, cities(name)))
    `)
    .eq("is_active", true)
    .limit(50);

  // (NB: A specialty és city szűrést a Postgres komplexebb módon várja a M:N
  //  kapcsolat miatt — ezt elosztott index-keresőkkel érdemes megoldani.)

  const { data, error } = await q;
  if (error) {
    return { html: renderNotFound("Hiba a találatok lekérésekor", ""), status: 500 };
  }

  // Kliens-oldali szűrés (a Postgres-szel megoldható lenne, de így egyszerűbb)
  let doctors = data || [];
  if (opts.specialty) {
    const specLower = opts.specialty.toLowerCase();
    doctors = doctors.filter((d: any) =>
      d.doctor_specialties?.some((ds: any) =>
        ds.specialties?.name?.toLowerCase().includes(specLower)
      )
    );
  }
  if (opts.city) {
    const cityLower = opts.city.toLowerCase();
    doctors = doctors.filter((d: any) =>
      d.doctor_clinics?.some((dc: any) =>
        dc.clinics?.cities?.name?.toLowerCase().includes(cityLower)
      )
    );
  }

  const titleParts = [
    opts.specialty || "Szakorvos",
    opts.city ? `${opts.city}` : "",
    "kereső",
  ].filter(Boolean);
  const pageTitle = titleParts.join(" ");

  const pathParts = ["talalatok"];
  if (opts.city)      pathParts.push(opts.city.toLowerCase());
  if (opts.specialty) pathParts.push(opts.specialty.toLowerCase().replace(/\s+/g, "-"));
  const canonical = `${SITE_BASE}/${pathParts.join("/")}`;
  const ogImage   = `${SITE_BASE}/og?type=search&q=${encodeURIComponent(pageTitle)}`;

  const description = `${doctors.length} ${esc(opts.specialty || "szakorvos")} ${opts.city ? esc(opts.city) + "ben" : "Magyarországon"} – foglaljon online időpontot a Szakorvos.hu-n.`.slice(0, 160);

  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": pageTitle,
    "url": canonical,
    "numberOfItems": doctors.length,
    "itemListElement": doctors.slice(0, 20).map((d: any, i: number) => ({
      "@type": "ListItem",
      "position": i + 1,
      "item": {
        "@type": "Physician",
        "name": `${d.title ? d.title + " " : ""}${d.name}`,
        "url": `${SITE_BASE}/orvos/${d.slug || d.id}`,
        "medicalSpecialty": d.doctor_specialties?.[0]?.specialties?.name,
      },
    })),
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Főoldal", "item": SITE_BASE },
      { "@type": "ListItem", "position": 2, "name": "Orvosok", "item": `${SITE_BASE}/talalatok` },
      ...(opts.specialty ? [{ "@type": "ListItem", "position": 3, "name": opts.specialty, "item": canonical }] : []),
    ],
  };

  const html = `<!DOCTYPE html>
<html lang="hu">
<head>
${COMMON_HEAD}
<title>${esc(pageTitle)} (${doctors.length} orvos) | Szakorvos.hu</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(pageTitle)} | Szakorvos.hu">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(ogImage)}">
<script type="application/ld+json">${JSON.stringify(itemListSchema)}</script>
<script type="application/ld+json">${JSON.stringify(breadcrumb)}</script>
${COMMON_CSS}
</head>
<body>
${renderHeader()}
<main class="container">
  <nav class="breadcrumb" aria-label="Útvonal">
    <a href="/">Főoldal</a><span>›</span>
    <a href="/talalatok">Orvosok</a>
    ${opts.specialty ? `<span>›</span><span style="color:#475569">${esc(opts.specialty)}</span>` : ""}
  </nav>

  <h1>${esc(pageTitle)}</h1>
  <p style="color:#475569;margin-bottom:24px">${esc(doctors.length)} találat. Foglaljon online időpontot.</p>

  ${doctors.length === 0 ? `<div class="card"><p>Nincs találat a megadott kritériumokkal. Próbálja másik várossal vagy szakterülettel.</p></div>` :
    doctors.map((d: any) => {
      const fullName = `${d.title ? d.title + " " : ""}${d.name}`;
      const spec = d.doctor_specialties?.[0]?.specialties?.name || "";
      const cl   = d.doctor_clinics?.[0]?.clinics;
      const city = cl?.cities?.name || "";
      return `<div class="card">
        <h2><a href="/orvos/${esc(d.slug || d.id)}">${esc(fullName)}</a></h2>
        <div class="meta">
          ${spec ? `<div class="meta-item">🩺 ${esc(spec)}</div>` : ""}
          ${cl?.name ? `<div class="meta-item">🏥 ${esc(cl.name)}</div>` : ""}
          ${city ? `<div class="meta-item">📍 ${esc(city)}</div>` : ""}
        </div>
        ${d.bio ? `<p>${esc(d.bio.slice(0, 200))}${d.bio.length > 200 ? "…" : ""}</p>` : ""}
      </div>`;
    }).join("")}
</main>
${renderFooter()}
</body>
</html>`;

  return { html, status: 200 };
}


// ═══════════════════════════════════════════════════════════════════════════
// 404 oldal — egységes
// ═══════════════════════════════════════════════════════════════════════════
function renderNotFound(reason: string, slug: string): string {
  return `<!DOCTYPE html>
<html lang="hu">
<head>
${COMMON_HEAD}
<title>${esc(reason)} (404) | Szakorvos.hu</title>
<meta name="description" content="A keresett oldal nem található. Térjen vissza a főoldalra vagy keressen szakorvost.">
<meta name="robots" content="noindex">
${COMMON_CSS}
</head>
<body>
${renderHeader()}
<main class="container" style="text-align:center;padding:60px 4%">
  <span class="badge">404 – Nem található</span>
  <h1>${esc(reason)}</h1>
  ${slug ? `<p>A keresett azonosító: <code style="background:#eef2ff;padding:3px 8px;border-radius:6px">${esc(slug)}</code></p>` : ""}
  <p style="margin-top:24px">
    <a class="cta" href="/">Vissza a főoldalra</a>
  </p>
  <div class="card" style="margin-top:32px;text-align:left">
    <h2>Hasznos linkek</h2>
    <ul>
      <li><a href="/talalatok">Szakorvos kereső</a></li>
      <li><a href="/tudastar">Tudástár A–Z</a></li>
      <li><a href="/vizsgalatok">Vizsgálatok és kezelések</a></li>
    </ul>
  </div>
</main>
${renderFooter()}
</body>
</html>`;
}


// ═══════════════════════════════════════════════════════════════════════════
// FŐ HANDLER
// ═══════════════════════════════════════════════════════════════════════════
Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const ua  = req.headers.get("User-Agent");
    const type = url.searchParams.get("type");
    const slug = url.searchParams.get("slug") || "";

    // ── Ha NEM bot: a Vercel-rewrite-on át küldjük a normál SPA-ra ─────────
    // Vercel rewrite szabálya így néz ki (lásd vercel.json):
    //   { "source": "/orvos/:slug", "has": [{ "type": "header", "key": "user-agent", "value": "(?i).*(bot|crawler|spider|slurp|preview).*"  }],
    //     "destination": "/functions/v1/seo-render?type=doctor&slug=:slug" }
    // Tehát ide csak akkor jut a kérés, ha bot. De second-guess-ként újra ellenőrzünk:
    if (!isBot(ua)) {
      // Nem bot — redirect a megfelelő SPA fájlra a query-paraméterrel
      const fallbacks: Record<string, string> = {
        doctor:  `/orvos.html?id=${encodeURIComponent(slug)}`,
        article: `/tudastar-cikk.html?slug=${encodeURIComponent(slug)}`,
        search:  `/talalatok.html${url.search}`,
      };
      const fallback = type ? fallbacks[type] : null;
      if (fallback) {
        return new Response(null, {
          status: 302,
          headers: { Location: fallback },
        });
      }
    }

    let result: { html: string; status: number };

    switch (type) {
      case "doctor": {
        if (!slug) return new Response("Missing slug", { status: 400 });
        result = await renderDoctor(slug);
        break;
      }
      case "article": {
        if (!slug) return new Response("Missing slug", { status: 400 });
        result = await renderArticle(slug);
        break;
      }
      case "search": {
        result = await renderSearch({
          city:      url.searchParams.get("city")      || undefined,
          specialty: url.searchParams.get("specialty") || undefined,
        });
        break;
      }
      default:
        return new Response("Unknown type", { status: 400 });
    }

    return new Response(result.html, {
      status: result.status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        // 1 órás CDN cache + 5 perc browser, így gyors a botoknak,
        // de a frissítések is hamar elérhetők.
        "Cache-Control": "public, max-age=300, s-maxage=3600",
        "X-Robots-Tag": result.status === 200 ? "index, follow" : "noindex",
      },
    });
  } catch (e) {
    console.error("[seo-render]", e);
    return new Response(
      `<!DOCTYPE html><html><body><h1>500 Internal Server Error</h1></body></html>`,
      {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }
});

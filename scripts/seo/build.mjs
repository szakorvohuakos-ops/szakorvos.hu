// szakorvos.hu – statikus SEO-oldalak és sitemapok generálása
// Futtatás: node scripts/seo/build.mjs            (adat a Supabase-ből, get_seo_directory RPC)
//           node scripts/seo/build.mjs --data x.json   (helyi adatfájlból)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const SITE = 'https://www.szakorvos.hu';
const SB_URL = 'https://asgnkjmwzhbczpvetprh.supabase.co';
const SB_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZ25ram13emhiY3pwdmV0cHJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMzk1NDMsImV4cCI6MjA5MjgxNTU0M30.WCprcmT4oFq1iPfYeQvwGyDv5Vox6YZdn5efouN_Nc0';
const MIN_COMBO = 3;      // ennyi orvos alatt nincs külön szakterület+város oldal
const MIN_CITY = 5;       // városoldal minimum
const OUT = path.join(ROOT, 'szakorvos');

// ---------- adat ----------
async function load() {
  const i = process.argv.indexOf('--data');
  if (i > 0) return JSON.parse(fs.readFileSync(process.argv[i + 1], 'utf8'));
  const r = await fetch(SB_URL + '/rest/v1/rpc/get_seo_directory', {
    method: 'POST',
    headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' },
    body: '{}'
  });
  if (!r.ok) throw new Error('RPC hiba: ' + r.status + ' ' + (await r.text()).slice(0, 300));
  return r.json();
}

// ---------- segédek ----------
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slugify = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const coll = new Intl.Collator('hu');
const fmt = n => n.toLocaleString('hu-HU').replace(/\u00a0/g, '\u202f');
const lc = s => s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
function write(rel, html) {
  const f = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, html);
}
function doctorUrl(d) {
  const prim = (d.sp.find(x => x[1]) || d.sp[0] || [])[0];
  return d.s.startsWith('dr-') && prim ? `/${prim}/${d.s}` : `/orvos/${d.s}`;
}
import { fmtName, initials, sortKey } from './name.mjs';

// ---------- sablon ----------
const SHELL_RAW = fs.readFileSync(path.join(HERE, 'shell', 'shell.html'), 'utf8');
const SHELL_CSS = (SHELL_RAW.match(/<style[^>]*>([\s\S]*?)<\/style>/) || [, ''])[1];
const SHELL = SHELL_RAW.replace(/<style[^>]*>[\s\S]*?<\/style>/, '');
const NAV = fs.readFileSync(path.join(HERE, 'shell', 'nav.html'), 'utf8');
const FOOT = fs.readFileSync(path.join(HERE, 'shell', 'footer.html'), 'utf8');
const CSS = fs.readFileSync(path.join(HERE, 'seo.css'), 'utf8');
const CSS_VER = (await import('node:crypto')).createHash('md5').update(SHELL_CSS + CSS).digest('hex').slice(0, 8);

function page({ title, desc, canon, crumbs, body, ld = [] }) {
  const bc = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c[0], item: SITE + c[1] }))
  };
  const lds = [bc, ...ld].map(o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('\n');
  return `<!doctype html>
<html lang="hu"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}${canon}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta property="og:type" content="website"><meta property="og:site_name" content="Szakorvos.hu">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SITE}${canon}"><meta property="og:locale" content="hu_HU">
<meta name="theme-color" content="#2A4A9C">
<link rel="stylesheet" href="/css/fonts.css">\n<style id="szk-premium-mini">html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}::selection{background:#2A4A9C;color:#fff}h1,h2,h3{letter-spacing:-.02em}h1,h2{text-wrap:balance}p{text-wrap:pretty}a,button{-webkit-tap-highlight-color:transparent;transition:color .16s,background-color .16s,border-color .16s}:focus-visible{outline:2px solid #2A4A9C;outline-offset:2px;border-radius:4px}@media(prefers-reduced-motion:reduce){*{transition-duration:.01ms!important;scroll-behavior:auto}}</style>
<link rel="icon" href="/favicon/favicon.ico" sizes="any"><link rel="icon" type="image/svg+xml" href="/szakorvos-icon.svg">
<link rel="stylesheet" href="/szakorvos/seo.css?v=${CSS_VER}">
${lds}
<script>window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)};</script>
<script defer src="/_vercel/insights/script.js"></script>
</head><body class="seo">
${NAV}
<main id="content">
<div class="sw">
<nav class="crumbs" aria-label="Morzsamenü">${crumbs.map((c, i) => i < crumbs.length - 1 ? `<a href="${c[1]}">${esc(c[0])}</a><span aria-hidden="true">›</span>` : `<span aria-current="page">${esc(c[0])}</span>`).join('')}</nav>
${body}
</div>
</main>
${FOOT}
${SHELL}
<script src="/js/skt.js" defer></script>
<script src="/js/cookie-consent.js?v=20261003b" defer></script>
</body></html>
`;
}

const AI_BOX = (spec) => `<aside class="aibox">
  <span class="aibadge"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5l1.9 5.6 5.6 1.9-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.9z"/></svg>AI-kereső</span>
  <div><b>Nem biztos benne, hogy ${spec ? esc(lc(spec)) + ' kell' : 'melyik szakorvos kell'}?</b><p>Írja le a panaszát a saját szavaival – az AI-kereső megmondja, melyik szakterület illik hozzá, és kiadja a közeli orvosokat.</p></div>
  <a class="btn ai" href="/">Kérdezze az AI-keresőt&nbsp;›</a>
  <small style="display:block;margin-top:6px;font-size:11.5px;opacity:.75">A beírt tünetleírást anonim módon dolgozzuk fel — <a href="/adatvedelem#ai">részletek</a></small>
</aside>`;

// ---------- fő ----------
const data = await load();
const specs = new Map(data.specialties.map(s => [s.slug, s]));
const clinics = data.clinics; // id -> [name, slug, city, district, rating, reviews]
const docs = data.doctors.map(a => ({ raw: a[0], n: fmtName(a[0]), k: sortKey(a[0]), s: a[1], p: !!a[2], q: +a[3] || 0, sp: a[4] || [], cl: a[5] || [] }));

// index: spec -> city -> Set(doctor idx)
const combo = new Map(); const cityDocs = new Map(); const cityName = new Map();
docs.forEach((d, i) => {
  const cities = new Set(d.cl.map(id => clinics[id]).filter(Boolean).map(c => c[2]));
  cities.forEach(c => { cityName.set(slugify(c), c); if (!cityDocs.has(c)) cityDocs.set(c, new Set()); cityDocs.get(c).add(i); });
  d.sp.forEach(([sl]) => {
    if (!specs.has(sl)) return;
    if (!combo.has(sl)) combo.set(sl, new Map());
    cities.forEach(c => { const m = combo.get(sl); if (!m.has(c)) m.set(c, new Set()); m.get(c).add(i); });
  });
});
const specTotal = sl => { const s = new Set(); combo.get(sl)?.forEach(v => v.forEach(i => s.add(i))); return s.size; };
const hasCombo = (sl, c) => (combo.get(sl)?.get(c)?.size || 0) >= MIN_COMBO;
const hasCity = c => (cityDocs.get(c)?.size || 0) >= MIN_CITY;
const comboUrl = (sl, c) => `/szakorvos/${sl}/${slugify(c)}`;
const cityUrl = c => `/szakorvos/varos/${slugify(c)}`;
const byCount = (a, b) => b[1] - a[1] || coll.compare(a[0], b[0]);

fs.rmSync(OUT, { recursive: true, force: true });
write('szakorvos/seo.css', SHELL_CSS + '\n' + CSS);
const urls = [];
let nCombo = 0, nSpec = 0, nCity = 0;

// 1) szakterület + város
for (const [sl, cm] of combo) {
  const sp = specs.get(sl);
  for (const [city, set] of cm) {
    if (set.size < MIN_COMBO) continue;
    const list = [...set].map(i => docs[i]).sort((a, b) => (b.p - a.p) || (b.q - a.q) || coll.compare(a.k, b.k));
    const clinicSet = new Set();
    const cards = list.map(d => {
      const cls = d.cl.map(id => [id, clinics[id]]).filter(([, c]) => c && c[2] === city);
      cls.forEach(([id]) => clinicSet.add(id));
      const dist = [...new Set(cls.map(([, c]) => c[3]).filter(Boolean))];
      const url = doctorUrl(d);
      const others = d.sp.map(x => specs.get(x[0])?.dn).filter(Boolean).filter(x => x !== sp.dn);
      return `<article class="dc"${dist.length ? ` data-d="${esc(dist.join(' '))}"` : ''}>
  <a class="av" href="${url}" tabindex="-1" aria-hidden="true">${esc(initials(d.raw))}</a>
  <div class="dm">
    <h3><a href="${url}">${esc(d.n)}</a>${d.p ? '<span class="pb">Partner</span>' : ''}</h3>
    <p class="ds">${esc(sp.dn)}${others.length ? ' · ' + esc(others.slice(0, 2).join(', ')) : ''}</p>
    <ul class="cl">${cls.slice(0, 3).map(([, c]) => `<li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 22s7-6.2 7-12A7 7 0 0 0 5 10c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>${c[1] ? `<a href="/klinikak/${esc(c[1])}">${esc(c[0])}</a>` : esc(c[0])}${c[3] ? ` <span class="di">${esc(c[3])}. ker.</span>` : ''}${c[4] ? ` <span class="rt">★ ${String(c[4]).replace('.', ',')}${c[5] ? ` <small>(${fmt(c[5])})</small>` : ''}</span>` : ''}</li>`).join('')}${cls.length > 3 ? `<li class="more">+${cls.length - 3} további rendelő</li>` : ''}</ul>
  </div>
  <a class="go" href="${url}" aria-label="${esc(d.n)} adatlapja">Adatlap ›</a>
</article>`;
    }).join('\n');
    const dists = city === 'Budapest' ? [...new Set(list.flatMap(d => d.cl.map(id => clinics[id]).filter(c => c && c[2] === city && c[3]).map(c => c[3])))] : [];
    const romanOrder = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX','XXI','XXII','XXIII'];
    dists.sort((a, b) => romanOrder.indexOf(a) - romanOrder.indexOf(b));
    const otherCities = [...cm].filter(([c, s]) => c !== city && s.size >= MIN_COMBO).map(([c, s]) => [c, s.size]).sort(byCount).slice(0, 24);
    const otherSpecs = [...combo].filter(([s2, m]) => s2 !== sl && (m.get(city)?.size || 0) >= MIN_COMBO).map(([s2, m]) => [s2, m.get(city).size]).sort((a, b) => b[1] - a[1]).slice(0, 30);
    const canon = comboUrl(sl, city);
    const title = `${sp.dn} ${city} – ${list.length} szakorvos | Szakorvos.hu`;
    const desc = `${list.length} ${lc(sp.dn)} ${city} területén, ${clinicSet.size} rendelőben: név, rendelő, cím és Google-értékelés egy helyen. Keressen panasz alapján is az AI-keresővel.`;
    const body = `<header class="sh">
  <span class="eb">${esc(sp.n)}</span>
  <h1>${esc(sp.dn)} – ${esc(city)}</h1>
  <p class="lead"><b>${list.length}</b> ${esc(lc(sp.dn))} <b>${clinicSet.size}</b> rendelőben, ${esc(city)} területén. Válassza ki az orvost, és nézze meg az elérhetőségeit, rendelési helyeit.</p>
  <div class="acts"><a class="btn pri" href="/talalatok?specialty=${encodeURIComponent(sl)}&amp;city=${encodeURIComponent(city)}">Szűrés és térkép&nbsp;›</a><a class="btn ghost" href="/szakorvos/${sl}">${esc(sp.dn)} más városokban</a></div>
</header>
${dists.length > 1 ? `<div class="chips" id="dchips" role="group" aria-label="Kerület szerinti szűrés"><button type="button" class="on" data-k="">Összes kerület</button>${dists.map(k => `<button type="button" data-k="${esc(k)}">${esc(k)}. ker.</button>`).join('')}</div>` : ''}
<section class="list" aria-label="Orvosok">
${cards}
</section>
${AI_BOX(sp.dn)}
${sp.desc ? `<section class="about"><h2>Mivel foglalkozik a ${esc(lc(sp.dn))}?</h2><p>${esc(sp.desc)}</p></section>` : ''}
${otherSpecs.length ? `<section class="rel"><h2>További szakorvosok – ${esc(city)}</h2><div class="tags">${otherSpecs.map(([s2, n]) => `<a href="${comboUrl(s2, city)}">${esc(specs.get(s2).dn)} <small>${n}</small></a>`).join('')}</div>${hasCity(city) ? `<p class="all"><a href="${cityUrl(city)}">Összes szakterület – ${esc(city)} ›</a></p>` : ''}</section>` : ''}
${otherCities.length ? `<section class="rel"><h2>${esc(sp.dn)} más városokban</h2><div class="tags">${otherCities.map(([c, n]) => `<a href="${comboUrl(sl, c)}">${esc(c)} <small>${n}</small></a>`).join('')}</div></section>` : ''}
<p class="src">Az adatok nyilvános forrásokból és a rendelők saját közléséből származnak, és rendszeresen frissülnek. Hibát talált? <a href="/kapcsolat">Jelezze nekünk</a>.</p>
${dists.length > 1 ? `<script>(function(){var c=document.getElementById('dchips');if(!c)return;c.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;[].forEach.call(c.children,function(x){x.classList.toggle('on',x===b)});var k=b.getAttribute('data-k');[].forEach.call(document.querySelectorAll('.list .dc'),function(a){a.hidden=!!k&&(' '+(a.getAttribute('data-d')||'')+' ').indexOf(' '+k+' ')<0;});});})();</script>` : ''}`;
    const ld = [{
      '@context': 'https://schema.org', '@type': 'ItemList', name: `${sp.dn} – ${city}`, numberOfItems: list.length,
      itemListElement: list.slice(0, 100).map((d, i) => ({ '@type': 'ListItem', position: i + 1, item: { '@type': 'Physician', name: d.n, url: SITE + doctorUrl(d), address: { '@type': 'PostalAddress', addressLocality: city, addressCountry: 'HU' } } }))
    }];
    write(`szakorvos/${sl}/${slugify(city)}/index.html`, page({ title, desc, canon, crumbs: [['Kezdőlap', '/'], ['Szakorvosok', '/szakorvos'], [sp.dn, `/szakorvos/${sl}`], [city, canon]], body, ld }));
    urls.push([canon, '0.8']); nCombo++;
  }
}

// 2) szakterület-hub
for (const [sl, sp] of specs) {
  const cm = combo.get(sl); if (!cm) continue;
  const total = specTotal(sl); if (!total) continue;
  const rows = [...cm].map(([c, s]) => [c, s.size]).sort(byCount);
  const canon = `/szakorvos/${sl}`;
  const body = `<header class="sh">
  <span class="eb">${esc(sp.n)}</span>
  <h1>${esc(sp.dn)} – városok szerint</h1>
  <p class="lead"><b>${fmt(total)}</b> ${esc(lc(sp.dn))} <b>${rows.length}</b> településen. Válassza ki a várost!</p>
  <div class="acts"><a class="btn pri" href="/talalatok?specialty=${encodeURIComponent(sl)}">Összes ${esc(lc(sp.dn))} a találati oldalon&nbsp;›</a></div>
</header>
<section class="cities" aria-label="Városok">${rows.map(([c, n]) => hasCombo(sl, c) ? `<a href="${comboUrl(sl, c)}"><b>${esc(c)}</b><small>${n} orvos</small></a>` : `<a class="thin" href="/talalatok?specialty=${encodeURIComponent(sl)}&amp;city=${encodeURIComponent(c)}"><b>${esc(c)}</b><small>${n} orvos</small></a>`).join('')}</section>
${AI_BOX(sp.dn)}
${sp.desc ? `<section class="about"><h2>Mivel foglalkozik a ${esc(lc(sp.dn))}?</h2><p>${esc(sp.desc)}</p></section>` : ''}
<section class="rel"><h2>További szakterületek</h2><div class="tags">${[...specs.values()].filter(s => s.slug !== sl && specTotal(s.slug)).map(s => `<a href="/szakorvos/${s.slug}">${esc(s.dn)}</a>`).join('')}</div></section>`;
  write(`szakorvos/${sl}/index.html`, page({ title: `${sp.dn} – ${fmt(total)} szakorvos ${rows.length} településen | Szakorvos.hu`, desc: `${sp.dn} keresése városok szerint: ${fmt(total)} orvos ${rows.length} településen, rendelővel, címmel és értékeléssel.`, canon, crumbs: [['Kezdőlap', '/'], ['Szakorvosok', '/szakorvos'], [sp.dn, canon]], body }));
  urls.push([canon, '0.7']); nSpec++;
}

// 3) város-hub
for (const [city, set] of cityDocs) {
  if (set.size < MIN_CITY) continue;
  const rows = [...combo].map(([sl, m]) => [sl, m.get(city)?.size || 0]).filter(r => r[1] > 0).sort((a, b) => b[1] - a[1]);
  const canon = cityUrl(city);
  const clinicN = Object.values(clinics).filter(c => c[2] === city).length;
  const body = `<header class="sh">
  <span class="eb">Városi szakorvos-kereső</span>
  <h1>Szakorvosok – ${esc(city)}</h1>
  <p class="lead"><b>${fmt(set.size)}</b> szakorvos <b>${clinicN}</b> rendelőben, <b>${rows.length}</b> szakterületen, ${esc(city)} területén.</p>
  <div class="acts"><a class="btn pri" href="/talalatok?city=${encodeURIComponent(city)}">Összes orvos – ${esc(city)}&nbsp;›</a><a class="btn ghost" href="/klinikak?city=${encodeURIComponent(city)}">Rendelők</a></div>
</header>
<section class="cities" aria-label="Szakterületek">${rows.map(([sl, n]) => hasCombo(sl, city) ? `<a href="${comboUrl(sl, city)}"><b>${esc(specs.get(sl).dn)}</b><small>${n} orvos</small></a>` : `<a class="thin" href="/talalatok?specialty=${encodeURIComponent(sl)}&amp;city=${encodeURIComponent(city)}"><b>${esc(specs.get(sl).dn)}</b><small>${n} orvos</small></a>`).join('')}</section>
${AI_BOX(null)}`;
  write(`szakorvos/varos/${slugify(city)}/index.html`, page({ title: `Szakorvos ${city} – ${fmt(set.size)} orvos, ${rows.length} szakterület | Szakorvos.hu`, desc: `Szakorvosok ${city} területén szakterület szerint: ${fmt(set.size)} orvos ${clinicN} rendelőben. Név, cím, elérhetőség és értékelés.`, canon, crumbs: [['Kezdőlap', '/'], ['Szakorvosok', '/szakorvos'], [city, canon]], body }));
  urls.push([canon, '0.7']); nCity++;
}

// 4) gyűjtőoldal
{
  const specRows = [...specs.values()].map(s => [s, specTotal(s.slug)]).filter(r => r[1]).sort((a, b) => coll.compare(a[0].dn, b[0].dn));
  const cityRows = [...cityDocs].filter(([c, s]) => s.size >= MIN_CITY).map(([c, s]) => [c, s.size]).sort(byCount);
  const body = `<header class="sh">
  <span class="eb">Országos szakorvos-kereső</span>
  <h1>Szakorvosok szakterület és város szerint</h1>
  <p class="lead"><b>${fmt(docs.length)}</b> orvos, <b>${specRows.length}</b> szakterület, <b>${cityRows.length}</b> város. Válasszon szakterületet vagy várost – vagy írja le a panaszát az AI-keresőnek.</p>
</header>
<h2 class="h2">Szakterületek</h2>
<section class="cities" aria-label="Szakterületek">${specRows.map(([s, n]) => `<a href="/szakorvos/${s.slug}"><b>${esc(s.dn)}</b><small>${fmt(n)} orvos</small></a>`).join('')}</section>
<h2 class="h2">Városok</h2>
<section class="cities" aria-label="Városok">${cityRows.map(([c, n]) => `<a href="${cityUrl(c)}"><b>${esc(c)}</b><small>${fmt(n)} orvos</small></a>`).join('')}</section>
${AI_BOX(null)}`;
  write('szakorvos/index.html', page({ title: 'Szakorvosok szakterület és város szerint | Szakorvos.hu', desc: `Országos szakorvos-kereső: ${fmt(docs.length)} orvos ${specRows.length} szakterületen és ${cityRows.length} városban. Válasszon szakterületet vagy várost.`, canon: '/szakorvos', crumbs: [['Kezdőlap', '/'], ['Szakorvosok', '/szakorvos']], body }));
  urls.unshift(['/szakorvos', '0.8']);
}

// ---------- sitemapok ----------
const today = new Date().toISOString().slice(0, 10);
const xmlEsc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const urlset = rows => `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.map(([u, p]) => `  <url><loc>${xmlEsc(SITE + u)}</loc>${p ? `<priority>${p}</priority>` : ''}</url>`).join('\n')}\n</urlset>\n`;
const STATIC = [['/', '1.0'], ['/talalatok', '0.9'], ['/klinikak', '0.8'], ['/tudastar', '0.7'], ['/vizsgalatok', '0.6'], ['/register', '0.5'], ['/kapcsolat', '0.3'], ['/adatvedelem', '0.2'], ['/aszf', '0.2'], ['/impresszum', '0.2']];
write('sitemap-oldalak.xml', urlset([...STATIC, ...urls]));
const docUrls = [...new Set(docs.map(doctorUrl))].map(u => [u, '0.6']);
write('sitemap-orvosok.xml', urlset(docUrls));
write('sitemap-klinikak.xml', urlset((data.all_clinic_slugs || []).map(s => [`/klinikak/${encodeURIComponent(s)}`, '0.6'])));
write('sitemap-tudastar.xml', urlset((data.articles || []).map(s => [`/tudastar/${encodeURIComponent(s)}`, '0.5'])));
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${['sitemap-oldalak.xml', 'sitemap-orvosok.xml', 'sitemap-klinikak.xml', 'sitemap-tudastar.xml'].map(f => `  <sitemap><loc>${SITE}/${f}</loc></sitemap>`).join('\n')}\n</sitemapindex>\n`);

console.log(`Kész: ${nCombo} szakterület+város, ${nSpec} szakterület-, ${nCity} városoldal; sitemap: ${urls.length + STATIC.length} oldal, ${docUrls.length} orvos, ${(data.all_clinic_slugs || []).length} klinika, ${(data.articles || []).length} cikk.`);

# Szakorvos.hu — Változások összefoglalója

Ez a csomag **három kört** tartalmaz:
1. Dizájn-egységesítés + biztonsági javítások + dinamikus sitemap (1. kör)
2. Teljes SEO optimalizáció (2. kör)
3. **SEO audit + finomhangolás** (jelen kör — 8 hiba kijavítva)

---

## 🔍 3. KÖR — SEO AUDIT JAVÍTÁSAI

Az előző körben elvégzett munka után végigmentem auditálással. Találtam 8 problémát, mindet kijavítottam.

### Kritikus (production-breaking)

**1. `index.html` `Cache-Control: no-cache` meta törlése**
Korábban benne volt egy `<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">` és társai. Ez minden requestnél friss letöltést kényszerített a kliensben, ami **rontotta a Core Web Vitals-t** (LCP, FCP). A Vercel-szintű cache header már jó (`max-age=300, s-maxage=3600`), ezt a meta-t törölni kellett.

**2. `index.html` — duplikált `WebSite` és `MedicalOrganization` schema törlése**
Két `WebSite` schema volt a fájlban (egyik a régi inline, másik amit a SEO inject hozzátett), valamint egy régi, kevésbé részletes `MedicalOrganization`. A Google figyelmeztet duplikáció miatt. A régiek törölve, a SEO inject által hozzáadott (részletesebb, MedicalOrganization + Sitelinks Search Box-szal) marad.

**3. Vercel redirect bug fix: a régi `/orvos.html?id=X` redirect elveszítette az ID-t**
Súlyos bug volt: a `vercel.json`-ben a `/orvos.html` redirect destination-je `/talalatok` volt, ami **nem őrizte meg az ID-t** — minden meglévő `/orvos.html?id=abc-123` link a találati listára került, nem az új profil URL-re! Javítva: `(?<docid>.*)` named regex capture + `/orvos/:docid` destination. A `tudastar-cikk.html?slug=X` redirect szintén javítva.

### Fontos (SEO-rontó)

**4. `register.html` és `talalatok.html` — H1 felvétele**
Mindkét fontos publikus oldal `<h1>` nélkül volt. Most:
- `register.html`: "Hozzon létre fiókot a Szakorvos.hu-n"
- `talalatok.html`: "Orvos keresési **találatok**" (a meglévő `.htitle` div upgrade-elve H1-re)

**5. Admin oldalak — `<meta name="robots" content="noindex,nofollow,noarchive">`**
A `robots.txt` Disallow erős védelem volt, de **defense-in-depth** szempontból minden admin oldalra felkerült a `noindex` meta is. (`admin.html`, `admin-orvos.html`, `admin-klinika.html`, `admin-tudastar.html`, `admin-beallitasok.html`, `generator.html`)

**6. Statikus `sitemap.xml` fallback frissítése**
A statikus fájl még a régi `.html` URL-eket tartalmazta. Most a clean URL-ekre van állítva — ha az Edge Function valamiért nem felel, a fallback is helyes.

**7. `robots.txt` — AI/LLM crawler explicit engedélyek**
Explicit `Allow: /` szabály a GPTBot, ChatGPT-User, ClaudeBot, PerplexityBot, anthropic-ai, Google-Extended, CCBot számára. (Ha a jövőben le akarod tiltani, csak átírod `Disallow: /`-ra.)

**8. SPA oldalak `og:image:width`/`og:image:height`/`og:image:alt`**
A korábbi SEO inject kihagyta a statikus oldalakon ezeket — bár az `orvos.html` és `tudastar-cikk.html`-en is hiányoztak. Most már mindkettőn ott vannak.

### Plusz: lista oldalak schema-i

Az audit során kiderült hogy a `talalatok.html`, `tudastar.html`, `vizsgalatok.html` oldalakon nem volt strukturált adat (csak az index-en és a dinamikusakon). Felkerült mindegyikre:
- `CollectionPage` schema (oldaltípus jelölés)
- `BreadcrumbList` schema (útvonal a SERP-en)

### Cache header-ek finomítása

A `vercel.json` cache fejlécei kibővítve:
- **HTML**: 5 min browser, 1 óra CDN, 24 óra stale-while-revalidate
- **CSS/JS/fontok/képek**: 30 napos immutable cache (jó LCP)

---

## 🚀 2. KÖR — SEO OPTIMALIZÁCIÓ

### 1. Tiszta, SEO-barát URL-ek (Vercel rewrites)

A `?id=uuid` és `.html?slug=...` formátumú URL-ek lecserélve clean URL-ekre:

| Régi | Új |
|------|-----|
| `/orvos.html?id=abc-123` | `/orvos/dr-kiss-janos-kardiologus-budapest` |
| `/tudastar-cikk.html?slug=fogfajas` | `/tudastar/fogfajas` |
| `/talalatok.html?specialty=Kardiológia&city=Budapest` | `/talalatok/budapest/kardiologia` |
| `/talalatok.html` | `/talalatok` |
| `/tudastar.html` | `/tudastar` |
| `/vizsgalatok.html` | `/vizsgalatok` |

A `vercel.json` tartalmazza az összes rewrite és redirect szabályt. A régi `?id=`/`?slug=` URL-ek **permanens 301 redirect-et** kapnak az új clean URL-re — így a meglévő linkek és Google index nem veszik kárba.

### 2. Bot-prerender Edge Function

Ez a legfontosabb darab — a JS-ben renderelődő oldalak (orvos profil, tudástár cikk, találati lista) eddig csak `"Cikk betöltése..."` placeholdert mutattak a keresőmotoroknak. Most:

**`supabase/functions/seo-render/index.ts`** — User-Agent alapján:
- **Botoknak** (Googlebot, Bingbot, Facebook, Twitter, Slack, LinkedIn, stb. — 24 különböző bot felismerve) **statikus, tartalom-gazdag HTML-t** szolgál ki, **inline schema.org JSON-LD**-vel.
- **Böngészőknek** redirect-eli a normál SPA fájlra (vagy a Vercel rewrite eleve csak a botokra forwarderol).

A botok látnak:
- Teljes content HTML-ben (nem JS-ben)
- Schema.org JSON-LD (Physician / MedicalWebPage / MedicalClinic / FAQPage / BreadcrumbList / ItemList)
- OG / Twitter Card meta-k
- Canonical URL
- Hreflang (`hu`, `x-default`)
- Belső linkek (kapcsolódó cikkek, vissza navigáció)

### 3. SQL migráció — slug oszlop + race condition védelem

**`supabase/migrations/001_seo_slugs.sql`** (idempotens, újrafuttatható):

- `hu_slugify()` Postgres függvény — magyar ékezetes karakterek → ASCII slug
- `doctors.slug` oszlop + auto-generálás trigger (név + szakterület + város alapján)
- `clinics.slug` oszlop + auto-generálás trigger
- **Backfill** — minden meglévő rekordra legenerálja a slug-ot
- **Unique partial index** mindkét slug oszlopra
- **`doctors.admin_user_id` UNIQUE partial index** (race condition védelem DB szinten)
- `rate_limits` tábla az ai-chat rate limiter-hez

**Futtatás:** Supabase Dashboard → SQL Editor → bemásolod → RUN.

### 4. Dinamikus OG kép generátor

**`supabase/functions/og-image/index.ts`** — minden orvos, cikk, találat oldalhoz egyedi 1200×630 SVG OG kép:

- `/og?type=doctor&slug=...` — orvos név + szakterület + emoji + brand színek
- `/og?type=article&slug=...` — cikk címe + szakterület badge
- `/og?type=search&q=...` — keresési kifejezés
- `/og?type=logo` — szervezeti default (Organization schema-hoz)

### 5. Sitemap kibővítés

**`supabase/functions/sitemap/index.ts`** — frissítve:
- **`<image:image>` tag-ek** minden orvos- és cikk-URL mellé
- **Long-tail SEO oldalak:** top 12 város × szakterület keresési oldalak
- Új clean URL formátum

### 6. Schema.org bővítés

| Oldal | Schema típus |
|-------|--------------|
| `index.html` | `MedicalOrganization`, `WebSite` (Sitelinks Search Box) |
| `orvos.html` (SPA + prerender) | `Physician`, `MedicalClinic` (worksFor), `BreadcrumbList`, `FAQPage` (ha van FAQ) |
| `tudastar-cikk.html` (SPA + prerender) | `MedicalWebPage`, `MedicalCondition`, `MedicalSpecialty`, `BreadcrumbList` |
| `talalatok.html` (lista + prerender) | `CollectionPage`, `BreadcrumbList`, `ItemList` (Physician-ekkel) |
| `tudastar.html`, `vizsgalatok.html` | `CollectionPage`, `BreadcrumbList` |

### 7. Egyedi 404 oldal

**`404.html`** — SEO-barát hibaoldal: `noindex,follow`, 3 db navigációs kártya.

### 8. Egyéb

- Security headers a `vercel.json`-ben
- Cache header-ek 30 napos immutable a statikus assetekre
- Preconnect Supabase, fonts.googleapis, fonts.gstatic

---

## 📋 TELEPÍTÉSI CHECKLIST

A változások telepítése három lépésben:

### 1. Adatbázis migráció (kötelező, ELŐSZÖR ezt)

```sql
-- Supabase Dashboard → SQL Editor → New query → bemásolod → RUN
-- supabase/migrations/001_seo_slugs.sql
```

Sanity check utána:
```sql
select count(*), count(slug) from doctors;     -- a kettőnek egyezni kell
select count(*), count(slug) from clinics;
select id, name, slug from doctors limit 10;   -- legyenek értelmes slug-ok
```

### 2. Edge Functions deploy

```bash
# Új függvények
supabase functions deploy seo-render --no-verify-jwt
supabase functions deploy og-image   --no-verify-jwt

# Frissített függvény
supabase functions deploy sitemap    --no-verify-jwt
```

> Megjegyzés: a `--no-verify-jwt` azért kell, mert ezeket a függvényeket nyilvánosan kell elérni (Google, social crawler-ek hívják).

### 3. Frontend deploy

```bash
vercel --prod
# vagy git push, ha Vercel a Git-tel van összekötve
```

### 4. Verifikáció

1. **Sitemap:** `https://www.szakorvos.hu/sitemap.xml` — XML response, orvosokkal és cikkekkel.
2. **OG kép:** `https://www.szakorvos.hu/og?type=logo` — SVG kép.
3. **Bot prerender teszt:**
   ```bash
   curl -A "Mozilla/5.0 (compatible; Googlebot/2.1)" https://www.szakorvos.hu/orvos/dr-kiss-janos | head -100
   ```
   Statikus, tartalom-gazdag HTML-t kell kapnod — nem JS-t.
4. **Redirect teszt:**
   ```bash
   curl -I https://www.szakorvos.hu/orvos.html?id=abc-123
   # → 301 → Location: /orvos/abc-123  ← itt az ID megőrződik!
   ```
5. **Google Rich Results Test:** https://search.google.com/test/rich-results
6. **Mobile-Friendly Test:** https://search.google.com/test/mobile-friendly
7. **Search Console:** új sitemap URL beadása.

---

## 🎯 NICE-TO-HAVE (KÖVETKEZŐ LÉPÉSEK)

A "kiváló" cél elérve. Ha még egy szintet ugranál:

1. **Astro / Next.js átírás** — natív SSR, jobb Core Web Vitals (külön projekt)
2. **Content marketing** — több tudástár cikk, helyi backlinkek
3. **AggregateRating schema** értékelésekhez — csillagok a SERP-en
4. **Twitter handle `twitter:site`** ha van Twitter accountod
5. **Google Search Console verification meta** ha még nincs verified domain
6. **PWA manifest** — telepíthető a mobilra
7. **Real User Monitoring (RUM)** — Vercel Speed Insights / Plausible Analytics
8. **AI-chat rate limiter integrálása** (jelenleg template, lásd `supabase/functions/ai-chat/_rate-limit.ts`)

---

## 🛠️ 1. KÖR — ELŐZŐ ITERÁCIÓ (változatlan)

Csak emlékeztetőül:
- Dizájn egységesítés 11 fájlon (`Inter` font + `#113293` brand)
- Race condition fix a `register.html`-ben
- AI chat klienskorlát és Authorization header
- AI chat rate limiter template
- fetch() → Supabase JS SDK migráció

---

Sok sikert! 🚀

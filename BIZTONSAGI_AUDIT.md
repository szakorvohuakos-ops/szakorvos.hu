# Szakorvos.hu – Teljes biztonsági audit

**Dátum:** 2026-06-09
**Rendszer:** Szakorvos.hu – statikus HTML/CSS/JS frontend + Supabase backend (Vercel hosting)

---

## ⚡ JAVÍTÁSOK ÁLLAPOTA (2026-06-09 frissítés)

**Elvégezve (DB-migrációval, élesben alkalmazva):**
- ✅ **K-2** – Storage `doctor photos all` (public ALL) policy eltávolítva. Mostantól: publikus olvasás marad, írás/törlés CSAK `authenticated`. Az admin-fotófeltöltés (bejelentkezve) tovább működik; az anon-visszaélés (törlés/feltöltés) megszűnt. *(migráció: secure_storage_photo_buckets)*
- ✅ **M-1** – `image/svg+xml` eltávolítva a `site-assets` engedélyezett MIME-listájából (SVG-XSS vektor zárva).
- ✅ **M-2** – `partner_registrations` és `doctor_claim_requests` INSERT mostantól mezőhossz-validációhoz kötött (spam/DoS csökkentés). *(migráció: validate_public_insert_forms)*
- ✅ **M-4** – Felesleges anon write-grant-ek visszavonva minden tábláról; az anon már csak az 5 jogos táblába tud INSERT-elni (contact_messages, doctor_claim_requests, partner_registrations, ai_conversations, search_logs). *(migráció: revoke_excess_anon_write_grants)*

**Elvégezve (frontend-fájlban – fel kell tölteni élesre):**
- ✅ **M-3** – A `vercel.json` már tartalmazott security headereket; megerősítve: `unsafe-eval` és a felesleges `api.openai.com` eltávolítva a CSP-ből, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, HSTS preload + 2 év. **Teendő: töltsd fel a vercel.json-t és telepítsd.**
- ✅ **K-1 (részleges)** – Az `admin-import.html` már **nem menti** a service_role kulcsot localStorage-ba (csak memóriában él). **Teendő: töltsd fel az admin-import.html-t.**

**Csak ÁLTALAD végezhető (nem DB-művelet – kötelező):**
- ⚠️ **K-1 (kötelező hátralévő rész)** – **Forgasd (reset) a service_role kulcsot** a Supabase Dashboardon: Project Settings → API → service_role → Reset. A jelenlegi kulcs böngészőben járt, ezért potenciálisan kompromittált. Hosszú távon az importert tedd `verify_jwt:true` edge function mögé, hogy a kulcs soha ne kerüljön kliensre.
- ⚠️ **K-3** – Állítsd a nem-publikus edge function-öket `verify_jwt: true`-ra, és a függvényen belül ellenőrizd a superadmin szerepet. A `debug-*` függvényeket töröld vagy zárd le. (Dashboard → Edge Functions, vagy `supabase functions deploy --no-verify-jwt` kikapcsolása.) A pontos listához és a prompt-injection ellenőrzéshez küldd el a függvények `index.ts`-ét.

**Opcionális (alacsony prioritás):**
- **A-1** – SRI a CDN-ekre: a CSP már korlátozza a script-forrásokat; az SRI törékeny a `@2` mozgó verzió miatt. Ha kéred, pontos verzióra pinnelem és hash-elem.

---

# Szakorvos.hu – Teljes biztonsági audit (eredeti jelentés)

**Architektúra megjegyzés:** A rendszer **nem** React/Next.js. Nincs build-lépés, nincs `package.json`/`node_modules`, nincsenek Server Actionök. A frontend statikus oldalakból áll, amelyek böngészőből közvetlenül a Supabase REST/Storage/Functions végpontjait hívják az inline `anon` kulccsal.

---

## A vizsgálat hatóköre – mit néztem meg és mit NEM

**Teljeskörűen vizsgálva (közvetlen hozzáféréssel):**
- Supabase adatbázis: RLS, tábla- és oszlopszintű grant-ek, policy-k, SECURITY DEFINER függvények, privilege escalation, storage bucket policy-k. Élesben, `anon` szerepként is teszteltem.
- Frontend forráskód (27 HTML + `js/cookie-consent.js`): XSS-sinkek, DOM injection, `innerHTML`, `escapeHtml`, localStorage, JWT-kezelés, admin route-védelem.
- Edge function-ök **metaadata** (JWT-védelem be/ki, név, státusz).

**NEM vizsgálható (nincs hozzáférésem – NEKED kell ellenőrizned):**
- Edge function-ök **forráskódja** – az MCP csak listázni tudja, a kódot nem olvassa. A prompt injection, a service-role-használat és az input-validáció a függvénykódban dől el. → Ezekről csak a `verify_jwt` flag és a viselkedés alapján következtetek; a kód átnézése külön szükséges.
- **Vercel-konfiguráció**, környezeti változók, élő HTTP **security headerek** (CSP, HSTS, X-Frame-Options) – ezeket élő HTTP-kéréssel vagy a Vercel-projektből kell ellenőrizni.
- **CORS** tényleges beállítása az edge function-ökön (kódfüggő).
- A `git`/deploy pipeline és a `.gitignore` (kerül-e titok a repóba).

---

## Vezetői összefoglaló

A rendszer **adatvédelmi alapja jó**: az RLS mindenhol be van kapcsolva, a betegadatok (patients, appointments, user_profiles, ai_conversations) az anon számára nem olvashatók, a privilege escalation (saját szerep superadminra emelése) blokkolt, a SECURITY DEFINER függvények search_path-védettek, és a frontend következetesen `escapeHtml`-t használ (nincs nyilvánvaló XSS).

Azonban **több súlyos hibát találtam**, amelyek éles, egészségügyi adatokat kezelő rendszerben nem elfogadhatók:

| # | Súlyosság | Probléma |
|---|-----------|----------|
| K-1 | **KRITIKUS** | A `service_role` kulcs a böngésző localStorage-ában (admin-import.html) |
| K-2 | **KRITIKUS** | Anon (bejelentkezés nélküli) feltöltés/törlés a doctor-photos és clinic-photos storage bucketbe |
| K-3 | **KRITIKUS** | ~30 edge function `verify_jwt: false` – auth nélkül hívható, ismeretlen belső védelemmel |
| M-1 | MAGAS | SVG-feltöltés engedélyezve a site-assets bucketben (SVG-XSS) |
| M-2 | MAGAS | `partner_registrations` és `doctor_claim_requests` INSERT validáció és rate-limit nélkül (spam/DoS) |
| M-3 | MAGAS | Hiányzó / ellenőrizetlen HTTP security headerek (CSP, HSTS, X-Frame-Options) |
| M-4 | MAGAS | Felesleges, túl tág anon write-grant-ek (DELETE/INSERT/UPDATE/TRUNCATE) szinte minden táblán |
| K-4 | KRITIKUS* | AI-funkciók prompt-injection / jogosulatlan lekérdezés – kódfüggő, ellenőrizendő |
| A-1 | ALACSONY | CDN-ek SRI (integritás-hash) nélkül |
| A-2 | ALACSONY | Az inline anon kulcs kitettsége (elvárt, de érdemes tudatosítani) |

\* Kódellenőrzés-függő; a kockázat valós, de a pontos besorolás a függvénykód ismeretében véglegesíthető.

---

# KRITIKUS kockázatok

## K-1 — service_role kulcs a böngésző localStorage-ában

**Fájl:** `admin-import.html` (sorok: 274, 284, 356–361, 413)

```
const SRK_KEY = 'szakorvos_admin_srk';
const saved = localStorage.getItem(SRK_KEY);
srkInput.addEventListener('change', () => localStorage.setItem(SRK_KEY, srkInput.value.trim()));
localStorage.setItem(SRK_KEY, srk);
```

**Mi a baj:** A Supabase `service_role` kulcs **teljesen megkerüli az RLS-t** – aki birtokolja, az a teljes adatbázist olvashatja, írhatja, törölheti (minden betegadat, minden orvos, minden tábla). Ez a kulcs itt a böngésző localStorage-ában tárolódik kliensoldalon.

**Kihasználás:**
- Bármilyen XSS (akár egy jövőbeli, most még nem létező rés) a kulcsot egyetlen `localStorage.getItem('szakorvos_admin_srk')` hívással kiolvashatja és elküldheti a támadónak → teljes adatbázis-kompromittálódás.
- A megosztott/nyilvános/lopott gépen maradt kulcs ugyanígy kiolvasható.
- A kulcs a böngésző memóriájában és a lemezen is megjelenhet.

**Valós kockázat:** Nagyon magas. Egyetlen kulcs kiszivárgása = teljes adatbázis (összes egészségügyi adat) elvesztése/kiszivárgása. GDPR szempontból ez bejelentésköteles incidens lenne.

**Javítás (kötelező):**
1. **Soha** ne kezeld a service_role kulcsot böngészőben. Az import-műveletet tedd át egy edge function mögé, amely `verify_jwt: true`-val fut, és a függvényen belül ellenőrzi, hogy a hívó `superadmin`. A service_role kulcs csak a Supabase szerveroldali környezetében (edge function env secret) létezhet.
2. **Azonnal forgasd (rotate) a service_role kulcsot** a Supabase Dashboardon (Project Settings → API → "Reset service_role"), mert a jelenlegi kulcs már potenciálisan kompromittálódott (böngészőben járt).
3. Töröld a localStorage-logikát az `admin-import.html`-ből.

---

## K-2 — Anon feltöltés és törlés a doctor-photos / clinic-photos bucketbe

**Hely:** Supabase Storage, `storage.objects` policy: `"doctor photos all"`

```
cmd: ALL   roles: {public}
USING:      (bucket_id IN ('doctor-photos','clinic-photos'))
WITH CHECK: (bucket_id IN ('doctor-photos','clinic-photos'))
```

**Mi a baj:** A policy `cmd = ALL` és `roles = {public}` – tehát SELECT/INSERT/UPDATE/**DELETE** is, **bárkinek, bejelentkezés nélkül** (anon). Élesben megerősítve: `anon_has_insert_grant = true`, a public ALL policy létezik. Az egyetlen korlát a bucket MIME-listája (jpeg/png/webp) és az 5 MB méret.

**Kihasználás (csak az anon kulccsal, ami a frontendben nyíltan ott van):**
- **Törlés:** a támadó az összes orvos- és klinikafotót letörölheti (`DELETE`) → tartalomrombolás.
- **Felülírás/feltöltés:** tetszőleges orvos fotóját kicserélheti (pl. obszcén/félrevezető képre) – reputációs és jogi kár egészségügyi kontextusban.
- **Tárhely-elárasztás:** sok 5 MB-os kép feltöltése → tárhely- és sávszélesség-költség (DoS / számlatámadás).

**Valós kockázat:** Magas–kritikus. Nincs hozzá szükség semmilyen különleges tudásra; a publikus anon kulcs elég.

**Javítás (migráció):** Cseréld a `public` ALL policy-t szerep- és tulajdon-alapú szabályokra. Csak `authenticated` (és lehetőleg csak az adott orvos/klinika admin vagy superadmin) tölthessen fel/törölhessen; a SELECT maradhat publikus (a fotók megjelenítéséhez).

```sql
-- Régi, túl tág policy eltávolítása
DROP POLICY IF EXISTS "doctor photos all" ON storage.objects;

-- Publikus OLVASÁS megmarad (a képek megjelenítéséhez)
CREATE POLICY "photos public read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id IN ('doctor-photos','clinic-photos'));

-- Írás/törlés CSAK bejelentkezett felhasználónak (finomítható admin/own szintre)
CREATE POLICY "photos auth write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('doctor-photos','clinic-photos'));

CREATE POLICY "photos auth update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id IN ('doctor-photos','clinic-photos'));

CREATE POLICY "photos auth delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id IN ('doctor-photos','clinic-photos'));
```

> Megjegyzés: ha a fotó-feltöltés eddig az anon kulccsal történt a frontendről, azt át kell állítani bejelentkezett admin-folyamatra, különben elromlik. Tesztelni kell.

---

## K-3 — Tömeges `verify_jwt: false` edge function

**Hely:** Supabase Edge Functions (összesen 39 függvény; a többségük `verify_jwt: false`).

A `verify_jwt: false` azt jelenti, hogy a Supabase **nem kényszerít ki érvényes JWT-t** a függvény hívásához – tehát **bárki, az interneten, hívhatja** (legfeljebb az anon kulcs ismeretében, ami nyilvános). Néhány különösen érzékeny, `verify_jwt:false` függvény:

- **Adatmódosító importerek/scraperek:** `google-clinics-import`, `clinic-email-scraper`, `foglaljorvost-scraper/-import/-doctors-import/-link-doctors`, `odoktor-clinics-import`, `teladoc-scrape/-doctors/-clinic-doctors`, `clinic-website-doctors-scrape/-import`, `geocode-all-clinics`, `refresh-clinic-addresses` → ha ezek **service_role-lal írnak a DB-be** és nincs belső auth-ellenőrzés, **bárki módosíthatja az adatbázist** rajtuk keresztül.
- **Költséges külső API-t hívó függvények:** `geocode`, `geocode-all-clinics` (Google Maps API – kvótalopás/számlatámadás), `generate-doctor-summary`, `generate-treatment(s)`, `ai-chat`, `parse-search` (LLM-költség → pénzügyi DoS).
- **Debug-függvények éles környezetben:** `debug-fetch`, `odoktor-debug`, `teladoc-debug`, `teladoc-debug-orvos` – debug-végpontok nem valók élesbe (gyakran túl sokat elárulnak vagy SSRF-re használhatók).

**Mi a baj / kihasználás:**
- Ha egy importer `verify_jwt:false` + service_role + nincs saját role-ellenőrzés → tetszőleges hívó trigerelheti az adatírást, vagy a paraméterein keresztül manipulálhatja, mit ír be.
- `debug-fetch` névből SSRF-gyanús (ha tetszőleges URL-t fetch-el szerveroldalról, belső hálózati erőforrásokat érhet el).
- A költséges AI/geocode függvények korlátlan hívása nagy számlát vagy kvótakimerülést okozhat.

**Valós kockázat:** Kritikus lehet – de **kódfüggő**. A pontos hatást csak a függvények forrásából lehet megmondani.

**Javítás:**
1. Minden függvénynél, ami **nem szándékosan publikus** (azaz nem a `parse-search`/`ai-chat`/`sitemap`/`get-doctor-summary` típusú, kifejezetten anonim-frontend végpont), állítsd `verify_jwt: true`-ra, és a függvényen belül ellenőrizd a hívó szerepét (superadmin).
2. A **debug-* függvényeket töröld** vagy `verify_jwt:true` + superadmin-gate mögé tedd.
3. A szándékosan publikus függvényekbe (parse-search, ai-chat, geocode) építs **rate-limitet** (IP/sessions alapú; van `rate_limits` táblád – használd) és szigorú input-validációt.
4. Nézd át a `debug-fetch`-et SSRF szempontból: tiltsd a belső/privát IP-tartományokat, engedélyezz csak whitelistelt domaineket.

> **Ehhez a függvénykódokat át kell néznem vagy neked kell** – kérd meg, hogy a kritikus függvények (`*-import`, `debug-fetch`, `ai-chat`, `parse-search`, `geocode*`) `index.ts`-ét másold be, és egyenként átnézem.

---

## K-4 — AI-funkciók: prompt injection / jogosulatlan lekérdezés (ellenőrizendő)

**Hely:** `ai-chat`, `parse-search`, `generate-doctor-summary`, `generate-articles/-treatments` edge function-ök (kód nem látható).

**Lehetséges kockázatok (kódellenőrzés nélkül, általános LLM-architektúra alapján):**
- **Prompt injection:** ha a felhasználói keresőszöveg közvetlenül a rendszer-promptba kerül, a támadó utasíthatja az LLM-et a rendszer-prompt felfedésére, viselkedés-felülírásra, vagy ha az LLM-nek DB-eszköze/SQL-generálása van, jogosulatlan lekérdezésre.
- **Adatszivárgás AI-válaszon át:** ha az AI a service_role-lal vagy tág joggal kérdez a DB-ből és az eredményt visszaadja, megkerülheti az RLS-t (pl. „listázd az összes beteg e-mailjét").
- **Jailbreak:** orvosi diagnózis kicsikarása (felelősségi kockázat).

**Javítás:**
- A felhasználói inputot **soha** ne fűzd közvetlenül a system promptba; különítsd el (user role message), és validáld/hosszkorlátozd.
- Az AI **ne** kapjon nyers DB-hozzáférést; csak előre definiált, RLS-tisztelő lekérdezéseken keresztül dolgozzon, paraméterezve.
- Építs kimeneti szűrőt (ne adjon vissza e-mailt, telefonon túli PII-t, belső mezőt).
- A „nem diagnosztizál, csak javasol" elv már megvalósult a frontend tünet-segédben – ezt tartsd meg az AI-oldali promptban is.

> Ez is **kódellenőrzés-függő**. Kérd, hogy az `ai-chat` és `parse-search` `index.ts`-ét nézzem át.

---

# MAGAS kockázatok

## M-1 — SVG-feltöltés engedélyezve (SVG-XSS)

**Hely:** `site-assets` bucket – `allowed_mime_types` tartalmazza: `image/svg+xml`.

**Mi a baj:** Az SVG egy XML-formátum, amibe `<script>` ágyazható. Ha valaki SVG-t tölt fel és azt egy böngésző **közvetlenül megnyitja** (nem `<img>`-ben, hanem a publikus storage-URL-en), a benne lévő JS lefuthat a storage-domain kontextusában. A `site-assets` írása ugyan csak `authenticated`-nek engedett (jó), de ha bármelyik admin-fiók kompromittálódik, vagy belső szereplő rosszindulatú, ez stored XSS-t ad.

**Valós kockázat:** Magas (különösen, mert admin-feltöltésű tartalom megbízhatónak tűnik).

**Javítás:**
- Vedd ki az `image/svg+xml`-t az engedélyezett MIME-listából, ha nincs rá feltétlen szükség:
```sql
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif']
WHERE id = 'site-assets';
```
- Ha SVG mégis kell: szervírozd `Content-Disposition: attachment`-tel vagy külön (nem süti-megosztó) domainről, és/vagy sanitizáld feltöltéskor (pl. DOMPurify szerveroldalon).

## M-2 — `partner_registrations` és `doctor_claim_requests`: validáció és rate-limit nélküli INSERT

**Hely:** Supabase policy-k.
- `partner_registrations` INSERT (anon): `WITH CHECK (true)`
- `doctor_claim_requests` INSERT (anon, authenticated): `WITH CHECK (true)`

**Mi a baj:** Nincs sem mezőhossz-, sem tartalom-, sem mennyiségi korlát (a `contact_messages`-nél van length-check és consent – itt nincs). Bárki az anon kulccsal korlátlanul, automatizáltan tölthet be rekordokat.

**Kihasználás:** Tömeges szemét-beszúrás (akár GB-nyi adat) → adatbázis-hízás, költség, a beérkező igénylések használhatatlanná tétele (spam-elárasztás), e-mail-értesítő (claim-notify) elárasztása.

**Valós kockázat:** Magas (üzemeltetési/DoS, nem adatszivárgás).

**Javítás (migráció) – a contact_messages mintájára:**
```sql
-- doctor_claim_requests: méret/alap-validáció
DROP POLICY IF EXISTS "Anyone can submit claim request" ON public.doctor_claim_requests;
CREATE POLICY "claim insert validated" ON public.doctor_claim_requests
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    char_length(coalesce(full_name,'')) BETWEEN 1 AND 200
    AND char_length(coalesce(email,'')) BETWEEN 3 AND 200
    AND char_length(coalesce(message,'')) <= 3000
  );  -- igazítsd a tényleges oszlopnevekhez

-- partner_registrations: méret/alap-validáció
DROP POLICY IF EXISTS "anon_insert_partner_reg" ON public.partner_registrations;
CREATE POLICY "partner insert validated" ON public.partner_registrations
  FOR INSERT TO anon
  WITH CHECK (
    char_length(coalesce(name,'')) BETWEEN 1 AND 200
    AND char_length(coalesce(email,'')) BETWEEN 3 AND 200
  );  -- igazítsd a tényleges oszlopnevekhez
```
Plusz: rate-limit az űrlap mögé (edge function + `rate_limits` tábla, IP/idő alapon), és CAPTCHA (pl. Cloudflare Turnstile) a két publikus űrlapra.

## M-3 — HTTP security headerek (ellenőrizendő a Vercelen)

**Hely:** Vercel-konfiguráció (`vercel.json`) / élő HTTP-válasz – **nem volt látható**.

**Mi a baj / mit ellenőrizz:** Statikus oldalnál ezek a fő védelmi rétegek a böngészőben. Hiányuk esetén XSS, clickjacking, MITM könnyebb. Ellenőrizendő fejlécek:
- `Content-Security-Policy` – korlátozza, honnan tölthet scriptet (csak self + a két CDN + Supabase). Ez a legfontosabb XSS-csökkentő.
- `Strict-Transport-Security` (HSTS) – kötelező HTTPS.
- `X-Frame-Options: DENY` vagy CSP `frame-ancestors 'none'` – clickjacking ellen.
- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy: strict-origin-when-cross-origin`.
- `Permissions-Policy` – kamera/mikrofon/geolokáció szűkítése.

**Javítás – `vercel.json`:**
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=(self)" },
        { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com https://maps.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://asgnkjmwzhbczpvetprh.supabase.co https://maps.googleapis.com; frame-ancestors 'none'" }
      ]
    }
  ]
}
```
> A CSP-t tesztelni kell (a Google Maps és az inline scriptek miatt; az `'unsafe-inline'` átmenetileg kell, de hosszabb távon nonce-ra érdemes váltani). Ellenőrzd élesben: `curl -I https://szakorvos.hu`.

## M-4 — Felesleges, túl tág anon write-grant-ek

**Hely:** Supabase tábla-grant-ek. Az `anon` szerepnek szinte minden táblára van DELETE/INSERT/UPDATE/TRUNCATE **grant**-je (élesben kilistázva).

**Mi a baj:** Jelenleg az RLS blokkolja, így **most nem kihasználható**. De ez „defense in depth" hiba: ha valaha bármelyik táblára felkerül egy téves, túl tág policy (pl. egy `USING(true)` UPDATE), azonnal éles lyuk lesz, mert a grant már megvan. A legkisebb jogosultság elve sérül.

**Valós kockázat:** Magas potenciál, alacsony jelenlegi kihasználhatóság.

**Javítás:** Vond vissza az anon (és authenticated, ahol nem indokolt) felesleges write-grant-jeit. Tartsd meg az anon SELECT-et a publikus táblákon és az INSERT-et a konkrét beküldő táblákon (contact_messages, partner_registrations, doctor_claim_requests, ai_conversations, search_logs). Példa minta (NE futtasd vakon – előbb listázni, mit használ a frontend):
```sql
-- Példa: a publikus, csak-olvasandó tábláknál vond vissza az írást az anontól
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.doctors FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.clinics FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.specialties FROM anon;
-- ... a többi publikus-olvasandó táblára hasonlóan
```

---

# KÖZEPES kockázatok

## KÖ-1 — `doctor_click_stats` publikusan olvasható + reviews/availability `USING(true)`
- `doctor_click_stats` SELECT policy `USING(true)` (public): a kattintási statisztikák bárkinek láthatók. Üzletileg érzékeny lehet (mely orvosokat keresik), de nem PII. Mérlegeld a szűkítést.
- `reviews`, `availability`, `cities`, stb. `SELECT USING(true)` – ezek szándékosan publikusak, rendben, de jó tudni.

## KÖ-2 — IDOR-felület a publikus adatokon
A frontend `?id=`, `?slug=` paraméterekkel kérdez orvost/klinikát. Mivel az adatok amúgy is publikusak (orvoskereső), ez **nem valódi IDOR** – nincs jogosultsághoz kötött rekord, amit átlépve másét lehetne látni. A betegadat-táblák `auth.uid()`-hez kötöttek, ott nincs IDOR. **Rendben.**

## KÖ-3 — CSRF
Tiszta token-alapú (Bearer JWT a fetch-ben), nem süti-alapú a Supabase auth → klasszikus CSRF nem releváns. A cookie-consent süti nem auth-süti. **Rendben**, de ha valaha süti-alapú auth jön, kell SameSite + CSRF-token.

---

# ALACSONY kockázatok

## A-1 — CDN-ek SRI nélkül
**Fájlok:** minden HTML, ami betölti:
- `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2`
- `https://unpkg.com/@googlemaps/markerclusterer/dist/index.min.js`

A `@2` és a `markerclusterer` verzió nincs pinnelve pontos verzióra és nincs `integrity` (SRI) hash. Ha a CDN-t kompromittálják, tetszőleges JS futhat az oldaladon. **Javítás:** pinneld pontos verzióra és adj `integrity="sha384-..."` + `crossorigin="anonymous"` attribútumot.

## A-2 — Inline anon kulcs (elvárt, de tudatosítandó)
Az anon kulcs a frontendben nyíltan szerepel – ez a Supabase-modellben **normális és elvárt** (az anon kulcs nem titok; az RLS véd). Fontos: soha ne keverd össze a service_role-lal (lásd K-1). Tartsd a védelmet az RLS-ben.

---

# Mit kell tőled, hogy a hiányzó részt is auditáljam

1. A kritikus edge function-ök forráskódja (`index.ts`): legalább `google-clinics-import`, `clinic-email-scraper`, bármelyik `*-import`, `debug-fetch`, `geocode`, `ai-chat`, `parse-search`. → prompt injection, service_role-használat, input-validáció, SSRF ellenőrzéséhez.
2. A `vercel.json` (vagy a Vercel projekt header-beállításai), illetve engedd, hogy élesben ellenőrizzem a fejléceket.
3. Erősítsd meg, hogy a service_role kulcs forgatása megtörtént (K-1).

---

# Prioritási sorrend (mit javíts először)

1. **K-1** – service_role kulcs forgatása + kivétel a böngészőből (azonnal).
2. **K-2** – storage `doctor photos all` policy szűkítése (azonnal, migrációval – lentebb kész SQL).
3. **K-3** – érzékeny edge function-ök `verify_jwt:true` + belső role-check; debug-függvények törlése.
4. **M-3** – security headerek a `vercel.json`-ban.
5. **M-1, M-2, M-4** – SVG kivétele, beküldő-űrlap validáció+rate-limit, felesleges grant-ek visszavonása.
6. **A-1** – SRI a CDN-ekre.

A K-2, M-1, M-2, M-4 azonnal alkalmazható SQL-migrációként készen áll fentebb. Szólj, melyiket alkalmazzam (a storage- és grant-változások működést is érinthetnek, ezért tesztelni kell).

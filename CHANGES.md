# Szakorvos.hu — Változások

## 2026-05-19 — Klinika cím komponensek szétválasztása (kereshetőség)

### Adatbázis (migráció `004_clinics_address_split.sql`)
- **clinics.postal_code** (varchar(10)) — irányítószám
- **clinics.street** (text) — utca + házszám
- **clinics.district** (varchar(8)) — budapesti kerület római számmal (I-XXIII)
- Indexek mindkét új mezőre a gyors kereséshez
- **`bp_district_from_zip(zip)`** SQL függvény: budapesti zip-ből automatikus kerület meghatározás
- **Trigger `clinics_address_sync`**: a strukturált mezőkből BEFORE INSERT/UPDATE újraépíti az `address` mezőt formázott alakra: `"1122 Budapest XII. kerület, Maros utca 16/b"`
- Adatmigráció: a meglévő `address` szövegekből regex-szel kihámozza a postal_code-ot, utcanevet, és Budapestnél a kerületet zip alapján

### admin-klinika.html
- A régi egyetlen "Cím" mező helyett: **Irányítószám, Kerület (dropdown), Utca és házszám** külön mezők
- A kerület dropdown csak Budapestnél jelenik meg (`toggleDistrictVisibility`)
- **Automatikus kerület felajánlás**: 4 jegyű budapesti zip beírásakor (1XYY) automatikusan kiválasztja a megfelelő kerületet a dropdown-ban (csak ha még üres)
- `saveClinic` átírva: a 3 új mezőt menti, a trigger újraépíti az `address`-t, geocoding az így keletkezett szépen formázott címmel fut

### klinika.html
- Hero meta + Kapcsolat szekció a strukturált komponenseket jeleníti meg külön sorokban
- `formatAddressShort(c, city)` → "1122 Budapest XII. ker., Maros utca 16/b"
- `formatAddressFull(c, city)` → két sor: "1122 Budapest XII. kerület" / "Maros utca 16/b"

### klinikak.html (találati lista)
- Select bővítve: `postal_code, street, district, cover_url`
- **Kereső bővített match**: irányítószám, kerület (pl. "XII", "1122", "XII. kerület"), utcanév, address — a felhasználó bármelyikre keresve találatot kap

---

## 2026-05-19 — Klinika profil teljes felfrissítés

### Adatbázis (Supabase, migráció 003_clinics_cover_gallery.sql)
- **clinics.cover_url** (text, nullable) — banner kép URL a profil tetejére
- **clinics.gallery** (jsonb, default `[]`) — galéria képek tömbje `[{url, caption?}]` formátumban
- Adatmigráció: ha létezett legacy `clinic_photos` array oszlop, a tartalma áttöltve a gallery-be
- **clinic-photos** Supabase Storage bucket létrehozva (public read, auth write, 5 MB/file, image MIME only)
- Storage RLS policies: SELECT public, INSERT/UPDATE/DELETE authenticated

### klinika.html — Új profil oldal
- **Új hero design** (banner-stílusú, mint a doctolib/booksy):
  - Szélesvásznú banner kép a tetején (1600×600 ajánlott)
  - Logo "kerek doboz" alulra lóg (104×104px, fehér keret + árnyék)
  - Google rating badge a banner jobb felső sarkában
  - Név + meta (cím, orvosok, szakterületek száma) + Telefon/Weboldal CTA-k
- **Bemutatkozás szekció** — `description` mezőből, "Tovább olvasom" toggle ha hosszú
- **Galéria szekció** — 3/4 oszlopos rács, lightbox-szal (◀▶ navigáció, ESC, kattintsa kívülre)
- **Vizsgálatok és árak szekció** — `treatments` táblából a klinika orvosainak szakterületei alapján:
  - Top 6 vizsgálat preview-ban, ár szerint csökkenő sorrendben
  - "Összes (XX) megtekintése" modal — keresős, mint az orvos profilon
  - Vizsgálat mellett szakterület chip
- **Sticky CTA mobilon** — csak hívás gomb, 240px görgetés után jelenik meg
- Layout hiba javítva: a `<div class="side">` nyitó tag hiányzott a régiből (sticky-positioning miatt fontos)

### admin-klinika.html — Bővített kép-kezelő
- **Logo + Borító kép külön** — két feltöltő UI (négyzetes 400×400 logónak, szélesvásznú 1600×600 borítónak)
- **Eltávolítás gomb** mindkét képhez (storage törlés + DB null)
- **Galéria kártya** új szekció:
  - Rács előnézet a meglévő képekből (hover-on jelenik meg az X gomb)
  - Multiple file upload (egy lépésben több kép)
  - Maximum 20 kép, 5 MB/kép
  - Automatikus storage cleanup törléskor
- Storage bucket: `clinic-photos` (clinics/{id}/logo-{ts}.ext, cover-{ts}.ext, gallery-{ts}-{i}.ext)

---

## 2026-05-18 — Orvos profil: szolgáltatások és árak a vizsgálatok adattárából

### Adatbázis (Supabase, alkalmazva)
- **treatments.price_huf** (integer, nullable) — indikatív ár forintban
- **treatments.price_note** (text, nullable) — opcionális megjegyzés
- **idx_treatments_specialty** — index a szakterület-szűrésre
- Mind a **1369 vizsgálat** automatikusan beárazva:
  - **Típus-alapú** alapár (konzultáció: 14k, szakorvosi vizsgálat: 17-18k, terápia: 25k, diagnosztika: 22-35k, esztétikai: 60k, sebészeti: 80k)
  - **Szakterület-szorzó** (esztétikai 1.30x, sebészeti/kardiológia 1.20x, pszichológia 0.80x, háziorvos 0.85x)
  - Konzultáció-típusú vizsgálatok mindig konzultációs áron (a "Hajbeültetés konzultáció" tipusú hibrid címeknél is)
  - Eredmény: 11 000 – 104 000 Ft sáv, átlag ~24 000 Ft
- Migrációs SQL fájl: `supabase/migrations/002_treatments_pricing.sql`

### orvos.html
- **renderServicesTab átírva**: a `treatments` táblából olvas az orvos szakterületei alapján
- **Prioritási sorrend**:
  1. `doctor_services` tábla (orvos-specifikus override, ha van)
  2. `treatments` tábla az orvos `doctor_specialties` szerinti szakterület(ei)hez
  3. Heurisztikus fallback (csak ha sem orvos-specifikus, sem treatments)
- **Top 5 vizsgálat** látszik a profilon (ár szerint csökkenő sorrendben)
- **"Összes szolgáltatás megtekintése"** gomb most modált nyit:
  - Teljes vizsgálatlista keresővel
  - ESC / X / overlay-kattintás bezár
  - Reszponzív (mobil: 92vh, asztali: 85vh / 680px)
  - Lábléc megjegyzés: "Az árak indikatív jellegűek, az orvostól és klinikától függhetnek"

---

## 2026-05-14 — Hero átdolgozás + AI chat modal

### Új fájlok
- **klinikak.html** — Klinika találati oldal listázóval, szűrőkkel, lapozóval
- **klinika.html** — Egyéni klinika profil oldal SEO URL-lel (/klinikak/:slug)

### Hero szekció (index.html)
- **3 soros cím + 4 négyzet alakú stat box** jobbra (Szakorvos / Klinika / Tudástár / Vizsgálat)
- **Élő számok** Supabase-ből (doctors, clinics, knowledge_articles, treatments)
- **Hagyományos kereső 110% szélességű** (átnyúlik a jobb oszlopra)
- **3 tab** a keresőn: Szakorvos / Klinika / Tudástár
- **AI chat modalban** nyílik kattintásra
- **Partner gomb** (narancs) felül a jobb oldalon
- **AI orvosi asszisztens CTA kártya** (zöld) — kattintásra felugrik a modal chat

### Menü (egységes minden HTML-ben)
- **Átlátszó alapból**, görgetéskor frosted glass + finom árnyék (.scrolled osztály)
- Az indexen még átláthatóbb (body.is-index extra felülírás)
- Mobile drawer: visibility:hidden alapból, csak .open-kor látható
- Menü tartalma beégetve minden HTML-be

### SEO URL-ek
- Orvosok: /:specialty/dr-:slug (pl. /borgyogyasz/dr-horvath-reka)
- Klinikák: /klinikak/:slug (pl. /klinikak/budai-maganklinika)
- Sitemap edge function-ben frissítve mindkettő

### Találati oldalak
- Toggle gomb: Orvosok ↔ Klinikák tetejére
- Lapozó javítva (#pgNums inline-flex)
- "További találatok betöltése" gomb a lapozó fölött

### Prémium UI
- Glassmorphism: stat boxok + search box + AI CTA
- Layered shadows (3-4 rétegű árnyékok)
- Spring easing mikroanimációkban
- Shimmer effekt eyebrow feliraton + Keresés gombon
- Staggered hero reveal belépéskor
- Gradient text "Megmondjuk." accent szón

### Adatbázis (Supabase, alkalmazva)
- slugify() PostgreSQL függvény (magyar ékezetek)
- doctors.slug oszlop + UNIQUE + auto-trigger
- clinics.slug oszlop + UNIQUE + auto-trigger
- 38 orvos, 20 klinika slug legenerálva

### Vercel routing
- /klinikak → klinikak.html
- /klinikak/:slug → klinika.html
- /:specialty/:slug(dr-.*) → orvos.html

### Deploy lépések
1. Push GitHub-ra
2. Vercel auto-deploy
3. Supabase Functions deploy: sitemap (klinika URL-ek miatt)

# Szakorvos.hu — Változások

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

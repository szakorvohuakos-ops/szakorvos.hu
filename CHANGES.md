# Szakorvos.hu — Változások

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

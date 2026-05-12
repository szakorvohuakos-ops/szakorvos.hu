# Szakorvos.hu — Változások összefoglalója

Ebben az iterációban négy fő területen történtek módosítások: dizájn egységesítés, biztonsági javítások, dinamikus sitemap, és kódminőség.

---

## 1. Dizájn egységesítés ✅

A teljes oldal egységes paletta és tipográfia alá került:

| Mit | Régi | Új |
|-----|------|-----|
| **Font** | Nunito Sans / Nunito (admin oldalakon, login, register, generator, tudastar-cikk, vizsgalatok, adatvedelem) | **Inter** mindenhol |
| **Brand kék** | `#283897`, `#3b56e0`, `#0B2A6B` (variálódott) | **`#113293`** egységesen |
| **Brand-2** | `#4042e2` | **`#264ACA`** |
| **Narancs** | `#ff6b2b` | **`#FF8A00`** |
| **Zöld** | `#22c55e` | **`#2C9650`** |
| **font-weight** | 800, 900 (Nunito heavy stílus) | **700** (Inter max) |

Érintett fájlok (11):
`login.html`, `register.html`, `admin.html`, `admin-orvos.html`, `admin-klinika.html`, `admin-tudastar.html`*, `generator.html`, `tudastar-cikk.html`, `vizsgalatok.html`, `adatvedelem.html`, `orvos.html`.

\* Az `admin-tudastar.html` dark theme — a `--brand` itt világosabb (`#264ACA`) maradt a kontraszt miatt, de a paletta egységesítve.

### Érintetlen (eleve egységesek voltak)
`index.html`, `talalatok.html`, `tudastar.html`, `admin-beallitasok.html`.

---

## 2. Biztonsági javítások ✅

### 2a. AI chat — frontend kliens-szintű védelem (`index.html`)
- **Authorization + apikey header** hozzáadva (a Supabase beépített rate limit ezzel működik)
- **Klienskorlát:** max 24 üzenet a `chatHistory`-ban, max 12 000 karakter payload
- **429 Too Many Requests** speciális kezelése (felhasználóbarát üzenet)

### 2b. AI chat — szerver-oldali rate limit template
Új fájl: `supabase/functions/ai-chat/_rate-limit.ts`

Drop-in IP-alapú rate limiter middleware Postgres backinggal.
- 60 mp ablakon belül max 20 hívás / IP (konfigurálható)
- Failover: ha az adatbázis hibázik, **engedélyez** (DoS-védelem feláldozása helyett)
- A header logika `CF-Connecting-IP`, `X-Forwarded-For`, `X-Real-IP` sorrendben próbálkozik
- A fájl tartalmazza az SQL séma létrehozó parancsokat is, kommentként

**Telepítés:** olvasd el a fájl tetején lévő használati blokkot.

### 2c. Race condition fix (`register.html`)
A `claimProfile` függvény eddig nem ellenőrizte, hogy a `.update()` ténylegesen frissített-e sort. Ha két felhasználó egyszerre claim-elte ugyanazt az orvost, az utolsó nyert volna, de mindkettő "sikeres" üzenetet kapott.

**Javítva:**
- `.select()` a `.update()` után — visszakapjuk a frissített sorokat
- Ha 0 sor jött vissza, a felhasználó megfelelő hibaüzenetet kap és a lista is frissül
- Az `selectDoctor` átírva `data-attribute + event delegation`-re (XSS-biztosabb a korábbi `onclick="selectDoctor('${d.name.replace(/'/g,...)}')"`-nál)

---

## 3. Dinamikus sitemap.xml ✅

Új Edge Function: `supabase/functions/sitemap/index.ts`

Tartalom:
- **Statikus oldalak** (index, talalatok, tudastar, vizsgalatok, login, register, adatvedelem)
- **Minden aktív orvos** (`/orvos.html?id={uuid}`)
- **Minden publikált tudástár cikk** (`/tudastar-cikk.html?slug={slug}`)

Jellemzők:
- Lapozás 1000-es batchekkel (50 lap = 50 000 sor max) — ha 3000+ cikked van, mind bekerül
- `lastmod` header az `updated_at`-ből
- 6 órás CDN cache (`Cache-Control: public, max-age=21600`)
- `X-Total-Doctors` / `X-Total-Articles` response headerek (monitoring)

**Telepítés:**
```bash
supabase functions deploy sitemap --no-verify-jwt
```

**Vercel routing** (vagy Cloudflare/stb.): `vercel.json.example` mutatja a rewrite szabályt.
A `/sitemap.xml` ekkor az Edge Function output-ját adja, és nem szükséges hozzá külön kód.

**A statikus `sitemap.xml` megmarad** — ha nem deployolod az Edge Function-t, a régi statikus marad. (Csak az `admin-beallitasok.html`-t adtam hozzá a `robots.txt`-hez Disallow-ként, ami lemaradt.)

---

## 4. Kódminőség ✅

### Egységes SDK használat
Korábban a `tudastar.html`, `tudastar-cikk.html`, `vizsgalatok.html` közvetlen `fetch()`-csel hívta a Supabase REST API-t. Ezek átírva a **Supabase JS SDK**-ra (`db.from(...)`):

| Fájl | Régi | Új |
|------|------|-----|
| `tudastar.html` | `fetch + Range header` lapozás | `db.from('knowledge_articles').range(from, to)` |
| `tudastar-cikk.html` | 4 db `fetch` hívás | 2 db `db.from(...)` hívás (kapcsolódó cikkek 2 query → 1 query `.or()`-ral) |
| `vizsgalatok.html` | Custom `sbFetch` wrapper | Standard `db.from(...).range(...)` |
| `index.html` | Custom `sbGet` wrapper (3 párhuzamos fetch) | `Promise.all([db.from(...), db.from(...), db.from(...)])` |

### Egyéb javítások
- `robots.txt` — `admin-beallitasok.html` hozzáadva a Disallow listához (eddig hiányzott)
- `tudastar-cikk.html` — a hibakezelő szövegekben maradt `font-family:Nunito` is `Inter`-re cserélve

---

## Mit NEM csináltunk (szándékosan, a választásod alapján)

- ❌ **Közös `/js/supabase-init.js`** — maradt inline minden HTML-ben (a te kérésedre)
- ❌ **Adatbázis migrációk** — nem írtunk `UNIQUE constraint`-et az `admin_user_id` mezőre, ahogy kérted (a frontend race condition fix így is sokat segít, de a teljes védelem a DB szinten kívánatos lenne)

---

## Telepítési checklist

A frontend változások azonnal hatályosak — csak töltsd fel a fájlokat a hostingra.

A backend változások telepítéshez:

```bash
# 1. Sitemap Edge Function
supabase functions deploy sitemap --no-verify-jwt

# 2. (Opcionális) AI chat rate limiter integráció:
#    – másold be a _rate-limit.ts-t a meglévő ai-chat function mappába
#    – importáld és használd a checkRateLimit() függvényt
#    – futtasd a fájl alján lévő SQL-t a Supabase SQL Editor-ben

# 3. Vercel rewrite — a vercel.json-be:
#    "rewrites": [
#      { "source": "/sitemap.xml",
#        "destination": "https://asgnkjmwzhbczpvetprh.supabase.co/functions/v1/sitemap" }
#    ]
```

Sok sikert! 🚀

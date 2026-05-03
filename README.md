# Szakorvos.hu — Frontend Struktúra

## Fájlstruktúra

```
szakorvos/
├── index.html              ← Szemantikus HTML, külső fájl-hivatkozásokkal
├── css/
│   ├── variables.css       ← Design token rendszer (:root változók)
│   ├── base.css            ← Reset, globális stílusok, animációk
│   ├── layout.css          ← Hero grid, container, section wrappers
│   └── components/
│       ├── navbar.css      ← Navigáció + mobile drawer
│       ├── hero.css        ← Stat boxok, cím, AI widget, feature ikonok
│       └── buttons.css     ← Gomb variánsok (BEM)
└── js/
    ├── app.js              ← Entry point, DOMContentLoaded init
    ├── ai.js               ← AI Edge Function hívás + typewriter animáció
    ├── search.js           ← Keresési logika, autocomplete, state, debounce
    └── ui.js               ← DOM manipuláció, widget state machine, render
```

## Fontosabb változtatások

### Biztonság
- A Supabase anon key **nincs** a frontend kódban
- Placeholder: `window.__SUPABASE_KEY__` — build step vagy szerver injektálja
- Ajánlott: backend proxy minden DB híváshoz

### JavaScript (ES6 modulok)
- `import/export` — nincs globális változó szivárgás
- `app.js` az egyetlen entry point (`type="module"`)
- `ai.js` — mock-olható: az `analyseQuery()` függvény cserélhető teszteléshez
- `search.js` — `searchState` objektum a keresési állapothoz
- `search.js` — `debounce()` utility az autocomplete inputhoz

### CSS (BEM konvenció)
- `.ai-widget__header`, `.stat-box__num`, `.btn--primary` stb.
- Design tokenek: `--color-brand`, `--space-4`, `--radius-md` stb.
- `!important` eltávolítva ahol lehetséges

### HTML
- `<nav>`, `<main>`, `<section>`, `<aside>` szemantikus tagek
- `aria-label`, `aria-live`, `role="log"`, `role="list"` attribútumok
- `<label for="chatInput">` + `.sr-only` az accessibilitáshoz
- Base64 logó → `assets/logo.svg` (külön fájlba kell exportálni)

### Performance
- Google Fonts `preconnect` hint
- CSS `<link rel="preload">` a kritikus stílusokhoz (opcionális)
- Base64 képek eltávolítva, `assets/` mappába szervezve

## Fejlesztési következő lépések

1. A maradék szekciók (népszerű szakterületek, why, partners) kiemelése saját component CSS fájlokba
2. Vite vagy Rollup build tool bekötése az env variánsokhoz
3. `bundle.js` generálása a `nomodule` fallbackhez
4. `logo.svg` exportálása az `assets/` mappába
5. Backend proxy az összes Supabase híváshoz

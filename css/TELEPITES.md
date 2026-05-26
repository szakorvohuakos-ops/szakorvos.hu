# 📦 FÁZIS 1+2 — Telepítési útmutató

## Mi van a `css/` mappában?

| Fájl | Méret | Mit tartalmaz |
|---|---|---|
| `design-system.css` | 10.7 KB | Színek, font-méretek, spacing, radius, shadow tokenek |
| `components.css` | 7.1 KB | Közös Header (Nav) + Footer CSS |

**Összesen: 17.8 KB** — egyszer letöltődik, utána cache-ből jön.

## Mi történik vizuálisan?

**SEMMI.** Pontosan ugyanúgy néz ki minden mint most. Ez a fázis **csak előkészítés** a következő lépésekhez:
- Most tokenek készen állnak az új komponensekhez
- Header / Footer CSS egy helyen van — eltávolítható lesz az inline `<style>`-okból

---

## 🛠 Telepítés — 2 lépés

### 1. lépés: Töltsd fel a `css/` mappát

A repo gyökérben hozz létre egy `css/` mappát (ha még nincs), és tedd bele:
- `design-system.css`
- `components.css`

Tehát:
```
szakorvos.hu/
  ├── index.html
  ├── orvos.html
  ├── ...
  └── css/
       ├── design-system.css   ← ÚJ
       └── components.css       ← ÚJ
```

### 2. lépés: Add hozzá a `<link>` sorokat a HTML `<head>`-ekbe

**Minden** publikus HTML fájlba (14 db) szúrd be ezt a 2 sort közvetlenül a `<head>` után:

```html
<link rel="stylesheet" href="/css/design-system.css">
<link rel="stylesheet" href="/css/components.css">
```

**Hova pontosan?** Legjobb hely: a `<meta charset>` után, a meglévő `<link>` és `<style>` előtt. Pl:

```html
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="...">
  
  <!-- ⬇️ ÚJ — ezt szúrd be ⬇️ -->
  <link rel="stylesheet" href="/css/design-system.css">
  <link rel="stylesheet" href="/css/components.css">
  <!-- ⬆️ ÚJ ⬆️ -->
  
  <link rel="canonical" href="...">
  ... egyéb meta tagek ...
  <style> ... a meglévő inline stílusok ... </style>
</head>
```

**Sorrend fontos**: a `design-system.css` ELŐBB legyen mint a `components.css`, mert a `components.css` használja a `--color-*` változókat.

---

## 📋 Hova kell beszúrni — fájlonként

Ezekbe a fájlokba kell beszúrni (publikus oldalak):

- [ ] `index.html`
- [ ] `orvos.html`
- [ ] `talalatok.html`
- [ ] `klinika.html`
- [ ] `klinikak.html`
- [ ] `tudastar.html`
- [ ] `tudastar-cikk.html`
- [ ] `vizsgalatok.html`
- [ ] `vizsgalat.html`
- [ ] `kapcsolat.html`
- [ ] `login.html`
- [ ] `register.html`
- [ ] `adatvedelem.html`
- [ ] `404.html`

Admin oldalakba **nem szükséges** (admin.html, admin-orvos.html stb.) — azoknak külön a saját CSS-eik vannak.

---

## ✅ Mit nyertél ezzel?

1. ✅ **Egy helyen vannak a design tokenek** → később 1 helyen tudsz színt cserélni
2. ✅ **Header + Footer kódduplikáció megszűnt** → ~14 KB megspórolva
3. ✅ **Új komponenseket** mostantól a token-rendszerre lehet építeni → konzisztens
4. ✅ **Caching** → a böngésző egyszer tölti le, utána minden oldal villámgyors

---

## 🚫 Mit NE csinálj még?

**NE töröld** a meglévő inline `<style>` blokkokat az oldalakról! Most még szükségesek mert:
- A meglévő stílusok ott vannak definiálva
- Ha most kitörlöd, az oldal eltörik

A következő fázisban (FÁZIS 2 part 2) majd **egyenként** kitisztítjuk az inline `<style>`-okból a Header és Footer CSS-t, miután meggyőződtünk hogy minden visszamarad.

---

## 🛟 Visszaállítás

Ha valami baj van:
1. Töröld a 2 `<link>` sort a HTML fájlokból
2. A `css/` mappát is törölheted
3. Az oldal pontosan olyan lesz mint korábban (a `szakorvos-backup-2026-05-26.zip`-ben van a teljes mentés is)

---

## 📞 Kérdés?

Ha valami nem világos, mondd meg és segítek. A telepítés után jöhet a **FÁZIS 3+ — egységes kártya rendszer**, ami már látható vizuális változást is hoz.

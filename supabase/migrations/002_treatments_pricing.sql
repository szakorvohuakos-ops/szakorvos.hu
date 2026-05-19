-- ═════════════════════════════════════════════════════════════════════
-- 002 — Treatments: ár-mező + automatikus feltöltés
-- ═════════════════════════════════════════════════════════════════════
-- Hozzáad egy price_huf (indikatív ár forintban) és price_note (megjegyzés)
-- oszlopot a treatments táblához, majd szakterület + címben szereplő
-- kulcsszó alapján automatikusan kitölti az árat. Az orvos profil oldal
-- ezekből az árakból dolgozik a "Szolgáltatások és árak" szekcióban
-- (orvos-specifikus override-ot a doctor_services tábla biztosít).

-- 1) Oszlopok
ALTER TABLE public.treatments
  ADD COLUMN IF NOT EXISTS price_huf integer,
  ADD COLUMN IF NOT EXISTS price_note text;

COMMENT ON COLUMN public.treatments.price_huf IS
  'Tipikus indikatív ár forintban. NULL = egyedi árazás.';
COMMENT ON COLUMN public.treatments.price_note IS
  'Opcionális megjegyzés az árhoz (pl. "alkalmanként", "csomagban").';

CREATE INDEX IF NOT EXISTS idx_treatments_specialty
  ON public.treatments(specialty);

-- 2) Automatikus árazás: típus + szakterület-szorzó, 1000-re kerekítve
WITH priced AS (
  SELECT
    id, title, specialty,
    CASE
      WHEN title ~* '(műtét|sebészet|operác|implantáció|beültetés|eltávolítás|excízió|biopszia|reszekció|plasztika)'
        THEN 80000
      WHEN title ~* '(botox|hialuron|filler|feltöltés|lézer|laser|peeling|mezo|hifu|fiatalít|anti.?aging|prp\b)'
        THEN 60000
      WHEN title ~* '(endoszkóp|gasztroszkóp|kolonoszkóp|bronchoszkóp|ultrahang|uh\b|mri|ct\b|röntgen|mammográf|csontsűrűség|denzitometria)'
        THEN 35000
      WHEN title ~* '(teszt|szűrés|szűrővizsgálat|terheléses|holter|ekg|eeg|spirometria|allergén|laborvizsgálat|hormonvizsgálat)'
        THEN 22000
      WHEN title ~* '(terápia|kezelés|rehabilitác|gondozás)' AND title !~* '(konzultác)'
        THEN 25000
      WHEN title ~* '(konzultác|tanácsad|véleményezés|online)'
        THEN 14000
      WHEN title ~* '(kontroll|utógondozás|utánkövetés)'
        THEN 11000
      WHEN title ~* '(szakorvosi vizsgálat|első vizsgálat|kivizsgál|anamnézis)'
        THEN 18000
      WHEN title ~* '(vizsgálat)'
        THEN 17000
      ELSE 19000
    END AS base_price,
    CASE
      WHEN specialty IN ('Esztétikai medicina','Plasztikai sebészet','Bőrgyógyászat')                       THEN 1.30
      WHEN specialty IN ('Szülészet-nőgyógyászat','Urológia','Kardiológia','Idegsebészet','Sebészet')        THEN 1.20
      WHEN specialty IN ('Ortopédia és traumatológia','Reumatológia','Neurológia','Onkológia','Gasztroenterológia',
                         'Endokrinológia és anyagcsere-betegségek','Pulmonológia','Fül-orr-gégészet',
                         'Szemészet','Belgyógyászat','Allergológia és klinikai immunológia',
                         'Angiológia','Haematológia','Nefrológia','Fájdalomterápia')                          THEN 1.10
      WHEN specialty IN ('Pszichológia','Klinikai szakpszichológia','Pszichoterápia','Pszichiátria',
                         'Addiktológia','Dietetika','Gyógytorna','Logopédia')                                 THEN 0.80
      WHEN specialty IN ('Háziorvos','Gyermekgyógyászat','Foglalkozás-egészségügy','Sportorvos')              THEN 0.85
      ELSE 1.00
    END AS spec_mult
  FROM treatments
  WHERE price_huf IS NULL
)
UPDATE treatments t
SET price_huf = ROUND( (p.base_price * p.spec_mult) / 1000.0 ) * 1000
FROM priced p
WHERE t.id = p.id;

-- 3) Javítás: konzultáció / tanácsadás mindig konzultációs áron, akkor is
-- ha a cím tartalmaz drágább beavatkozási kulcsszót is
-- (pl. "Hajbeültetés konzultáció" → konzultáció ára, nem műtéti)
WITH spec_mult AS (
  SELECT id,
    CASE
      WHEN specialty IN ('Esztétikai medicina','Plasztikai sebészet','Bőrgyógyászat')                       THEN 1.30
      WHEN specialty IN ('Szülészet-nőgyógyászat','Urológia','Kardiológia','Idegsebészet','Sebészet')        THEN 1.20
      WHEN specialty IN ('Ortopédia és traumatológia','Reumatológia','Neurológia','Onkológia','Gasztroenterológia',
                         'Endokrinológia és anyagcsere-betegségek','Pulmonológia','Fül-orr-gégészet',
                         'Szemészet','Belgyógyászat','Allergológia és klinikai immunológia',
                         'Angiológia','Haematológia','Nefrológia','Fájdalomterápia')                          THEN 1.10
      WHEN specialty IN ('Pszichológia','Klinikai szakpszichológia','Pszichoterápia','Pszichiátria',
                         'Addiktológia','Dietetika','Gyógytorna','Logopédia')                                 THEN 0.80
      WHEN specialty IN ('Háziorvos','Gyermekgyógyászat','Foglalkozás-egészségügy','Sportorvos')              THEN 0.85
      ELSE 1.00
    END AS sm
  FROM treatments
)
UPDATE treatments t
SET price_huf = ROUND( (16000 * sm.sm) / 1000.0 ) * 1000
FROM spec_mult sm
WHERE t.id = sm.id
  AND t.title ~* '(konzultác|tanácsad|véleményezés)';

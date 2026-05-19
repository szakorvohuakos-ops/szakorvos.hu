-- ═══════════════════════════════════════════════════════════════════════
-- 004: Klinika cím komponensek szétválasztása
-- ═══════════════════════════════════════════════════════════════════════
-- postal_code, street, district mezők. address marad backward compat-ként,
-- trigger újraépíti a strukturált mezőkből.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE clinics ADD COLUMN IF NOT EXISTS postal_code varchar(10);
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS street text;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS district varchar(8);

COMMENT ON COLUMN clinics.postal_code IS 'Irányítószám (4 jegy, pl. 1122)';
COMMENT ON COLUMN clinics.street IS 'Utca és házszám (pl. Maros utca 16/b)';
COMMENT ON COLUMN clinics.district IS 'Budapesti kerület római számmal (I-XXIII)';

CREATE INDEX IF NOT EXISTS idx_clinics_postal_code ON clinics(postal_code);
CREATE INDEX IF NOT EXISTS idx_clinics_district ON clinics(district);

-- ═══════════════════════════════════════════════════════════════════════
-- Budapesti irányítószám → kerület lookup függvény
-- Budapesti zipek 1XYY formátumúak, ahol XY a kerület száma (01-23)
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION bp_district_from_zip(zip text)
RETURNS text AS $$
DECLARE
  district_num int;
  roman text[] := ARRAY['I','II','III','IV','V','VI','VII','VIII','IX','X',
                        'XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX',
                        'XXI','XXII','XXIII'];
BEGIN
  IF zip IS NULL OR zip !~ '^1\d{3}$' THEN RETURN NULL; END IF;
  district_num := substring(zip from 2 for 2)::int;
  IF district_num BETWEEN 1 AND 23 THEN
    RETURN roman[district_num];
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ═══════════════════════════════════════════════════════════════════════
-- Adatmigráció: meglévő `address`-ből kihámozni a komponenseket
-- ═══════════════════════════════════════════════════════════════════════

UPDATE clinics SET
  postal_code = (regexp_match(address, '\m(\d{4})\M'))[1]
WHERE address IS NOT NULL AND postal_code IS NULL;

UPDATE clinics SET district = bp_district_from_zip(postal_code)
WHERE district IS NULL AND postal_code IS NOT NULL;

-- Utca + házszám: irányítószámot, ismert városneveket, "X. kerület"-et levágjuk
UPDATE clinics SET street = trim(both ' ,' from
  regexp_replace(
    regexp_replace(
      regexp_replace(address, '\m\d{4}\M', '', 'g'),
      '\m(Budapest|Debrecen|Szeged|Pécs|Miskolc|Győr|Nyíregyháza|Kecskemét|Székesfehérvár|Szombathely|Szolnok|Tatabánya|Kaposvár|Békéscsaba|Veszprém|Eger|Zalaegerszeg|Sopron|Érd|Dunaújváros|Hódmezővásárhely)\M',
      '', 'gi'),
    '\s*[IVX]+\.?\s*(kerület|ker\.?)?\s*', ' ', 'gi'
  )
)
WHERE address IS NOT NULL AND street IS NULL;

UPDATE clinics SET street = regexp_replace(street, '\s+', ' ', 'g') WHERE street IS NOT NULL;
UPDATE clinics SET street = trim(both ' ,' from street) WHERE street IS NOT NULL;
UPDATE clinics SET street = NULL WHERE street = '';

-- ═══════════════════════════════════════════════════════════════════════
-- Trigger: strukturált mezőkből újraépíti az `address`-t
-- Formátum: "1122 Budapest XII. kerület, Maros utca 16/b"
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION clinics_rebuild_address()
RETURNS trigger AS $$
DECLARE
  city_name text;
  loc text;
  parts text[] := ARRAY[]::text[];
BEGIN
  IF NEW.postal_code IS NULL AND NEW.street IS NULL AND NEW.district IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND
     NEW.postal_code IS NOT DISTINCT FROM OLD.postal_code AND
     NEW.district    IS NOT DISTINCT FROM OLD.district AND
     NEW.street      IS NOT DISTINCT FROM OLD.street AND
     NEW.city_id     IS NOT DISTINCT FROM OLD.city_id
  THEN
    RETURN NEW;
  END IF;

  IF NEW.city_id IS NOT NULL THEN
    SELECT name INTO city_name FROM cities WHERE id = NEW.city_id;
  END IF;

  loc := '';
  IF NEW.postal_code IS NOT NULL THEN loc := NEW.postal_code; END IF;
  IF city_name IS NOT NULL THEN loc := trim(loc || ' ' || city_name); END IF;
  IF NEW.district IS NOT NULL THEN loc := loc || ' ' || NEW.district || '. kerület'; END IF;
  IF loc <> '' THEN parts := array_append(parts, loc); END IF;

  IF NEW.street IS NOT NULL AND NEW.street <> '' THEN
    parts := array_append(parts, NEW.street);
  END IF;

  IF array_length(parts, 1) > 0 THEN
    NEW.address := array_to_string(parts, ', ');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS clinics_address_sync ON clinics;
CREATE TRIGGER clinics_address_sync
  BEFORE INSERT OR UPDATE ON clinics
  FOR EACH ROW
  EXECUTE FUNCTION clinics_rebuild_address();

-- Address normalizálása: trigger kényszerített futtatása
UPDATE clinics SET street = street WHERE postal_code IS NOT NULL OR street IS NOT NULL OR district IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════
-- 003: Klinika borítókép és galéria
-- ═══════════════════════════════════════════════════════════════════════
-- Hozzáadja a clinics.cover_url (banner kép) és clinics.gallery (JSONB
-- tömb URL-ekkel) oszlopokat. A klinika profil oldalon ezek jelennek meg
-- a hero szekcióban (cover) és a galéria szekcióban (gallery).
-- A clinic_photos legacy oszlop megmarad backward compat miatt.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE clinics ADD COLUMN IF NOT EXISTS cover_url text;
COMMENT ON COLUMN clinics.cover_url IS 'Hero banner kép URL (szélesvásznú, ajánlott 1600x600px)';

ALTER TABLE clinics ADD COLUMN IF NOT EXISTS gallery jsonb DEFAULT '[]'::jsonb;
COMMENT ON COLUMN clinics.gallery IS 'Galéria képek tömb: [{"url": "...", "caption": "opcionális"}]';

-- Adatmigráció: ha van clinic_photos régi oszlop array-ként, áttöltjük gallery-be
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clinics' AND column_name = 'clinic_photos'
  ) THEN
    UPDATE clinics
       SET gallery = (
         SELECT jsonb_agg(jsonb_build_object('url', elem))
         FROM jsonb_array_elements_text(clinic_photos::jsonb) elem
       )
     WHERE clinic_photos IS NOT NULL
       AND jsonb_typeof(clinic_photos::jsonb) = 'array'
       AND (gallery IS NULL OR gallery = '[]'::jsonb);
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- ha clinic_photos más típus, ignoráljuk
  NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- Storage bucket: clinic-photos (publikus olvasás)
-- ═══════════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'clinic-photos',
  'clinic-photos',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS: bárki olvashat, csak authentikált admin tölthet fel
DROP POLICY IF EXISTS "clinic-photos public read" ON storage.objects;
CREATE POLICY "clinic-photos public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'clinic-photos');

DROP POLICY IF EXISTS "clinic-photos auth upload" ON storage.objects;
CREATE POLICY "clinic-photos auth upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'clinic-photos');

DROP POLICY IF EXISTS "clinic-photos auth update" ON storage.objects;
CREATE POLICY "clinic-photos auth update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'clinic-photos');

DROP POLICY IF EXISTS "clinic-photos auth delete" ON storage.objects;
CREATE POLICY "clinic-photos auth delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'clinic-photos');

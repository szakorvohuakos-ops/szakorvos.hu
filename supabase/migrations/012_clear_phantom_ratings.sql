-- 012: fantomértékelések törlése — vélemény-darabszám nélküli (review_count=0) importált rating
-- nem valódi páciensértékelés (Teladoc-import helyőrző értéke volt). 308 sor érintett.
-- Alkalmazva élesben: 2026-09-30 (Supabase migration: clear_phantom_ratings)
update public.doctors
   set rating = 0
 where rating > 0
   and coalesce(review_count, 0) = 0
   and source <> 'demo';

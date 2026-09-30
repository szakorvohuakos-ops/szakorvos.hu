-- 006: fix search_path a 4 érintett függvénynél (Supabase linter: function_search_path_mutable)
-- Alkalmazva élesben: 2026-09-30 (Supabase migration: fix_function_search_path)
ALTER FUNCTION public.slugify(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.bp_district_from_zip(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.immutable_unaccent(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.guess_gender_hu(text) SET search_path = public, pg_temp;

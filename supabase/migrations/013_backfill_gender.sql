-- 013: hiányzó gender kitöltése névalapú becsléssel (sziluett-avatarhoz) + gender a klinika-RPC-ben
-- Alkalmazva élesben: 2026-09-30 (Supabase migration: backfill_gender + get_clinic_profile módosítás)
update public.doctors set gender = guess_gender_hu(name) where gender is null and guess_gender_hu(name) is not null;
-- get_clinic_profile: a doctors JSON-ba bekerült a 'gender' mező ('photo_url' után)

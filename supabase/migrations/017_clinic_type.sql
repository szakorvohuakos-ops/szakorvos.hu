-- Rendelő típusa (admin által állítható); NULL = automatikus (szakterületek száma alapján)
alter table public.clinics add column if not exists clinic_type text check (clinic_type in ('small','big'));
grant select (clinic_type) on public.clinics to anon, authenticated;
grant update (clinic_type) on public.clinics to authenticated;
-- get_clinic_profile: c_pub-ba felvéve a clinic_type (élesben alkalmazva)

-- 014: Orvos- és klinika-admin javítások (2026-10-03)
--  1) védett oszlopok: orvos/klinika admin nem állíthatja magát partnerré, ellenőrzötté, nem írhatja át a nevét, slugját, számlálókat
--  2) orvos a saját rendelési helyein a vizitdíjat módosíthatja (csak azt)
--  3) admin_requests tábla: orvos felvétele/eltávolítása (klinika), rendelési hely / névváltozás kérése (orvos)
--  4) képtárhely: mindenki csak a saját mappájába írhat (doctor-photos/<doctor_id>/…, clinic-photos/<clinic_id>/…), site-assets csak szuperadmin
-- Futtatás: Supabase → SQL Editor → az egész fájl beillesztése → Run. Többször is futtatható.

create or replace function public.protect_doctor_columns() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if public.get_my_role() is distinct from 'doctor_admin'::user_role then return new; end if;
  if tg_op = 'INSERT' then
    new.admin_user_id := auth.uid(); new.is_partner := false; new.verified_at := null; new.verified_by := null;
    new.quality_score := null; new.rating := null; new.review_count := 0; new.is_active := false; new.status := 'pending';
    new.profile_views := 0; new.profile_clicks := 0; new.contact_clicks := 0; new.is_professional := false;
    return new;
  end if;
  new.id := old.id; new.slug := old.slug; new.name := old.name; new.admin_user_id := old.admin_user_id;
  new.is_partner := old.is_partner; new.verified_at := old.verified_at; new.verified_by := old.verified_by;
  new.quality_score := old.quality_score; new.rating := old.rating; new.review_count := old.review_count;
  new.status := old.status; new.source := old.source; new.is_professional := old.is_professional;
  new.profile_views := old.profile_views; new.profile_clicks := old.profile_clicks; new.contact_clicks := old.contact_clicks;
  new.created_at := old.created_at; new.teladoc_id := old.teladoc_id; new.on_teladoc := old.on_teladoc;
  new.on_foglaljorvost := old.on_foglaljorvost; new.from_clinic_website := old.from_clinic_website;
  -- jóváhagyásra váró profilt az orvos nem tehet maga nyilvánossá
  if old.is_active is distinct from true then new.is_active := old.is_active; end if;
  new.updated_at := now(); new.last_activity_at := now();
  return new;
end $$;
drop trigger if exists trg_protect_doctor_columns on public.doctors;
create trigger trg_protect_doctor_columns before insert or update on public.doctors
  for each row execute function public.protect_doctor_columns();

create or replace function public.protect_clinic_columns() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if public.get_my_role() is distinct from 'clinic_admin'::user_role then return new; end if;
  new.id := old.id; new.slug := old.slug; new.name := old.name; new.city_id := old.city_id; new.admin_user_id := old.admin_user_id;
  new.status := old.status; new.source := old.source; new.created_at := old.created_at;
  new.google_place_id := old.google_place_id; new.google_rating := old.google_rating; new.google_review_count := old.google_review_count;
  new.google_attribution := old.google_attribution; new.last_google_sync := old.last_google_sync;
  new.on_foglaljorvost := old.on_foglaljorvost; new.foglaljorvost_url := old.foglaljorvost_url;
  new.on_odoktor := old.on_odoktor; new.odoktor_url := old.odoktor_url; new.on_teladoc := old.on_teladoc;
  new.teladoc_url := old.teladoc_url; new.teladoc_id := old.teladoc_id; new.email_scrape_attempted_at := old.email_scrape_attempted_at;
  return new;
end $$;
drop trigger if exists trg_protect_clinic_columns on public.clinics;
create trigger trg_protect_clinic_columns before update on public.clinics
  for each row execute function public.protect_clinic_columns();

drop policy if exists "Doctor admin update own fees" on public.doctor_clinics;
create policy "Doctor admin update own fees" on public.doctor_clinics for update to authenticated
  using (get_my_role() = 'doctor_admin'::user_role and doctor_id in (select id from public.doctors where admin_user_id = auth.uid()))
  with check (get_my_role() = 'doctor_admin'::user_role and doctor_id in (select id from public.doctors where admin_user_id = auth.uid()));
create or replace function public.protect_doctor_clinic_keys() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if public.get_my_role() is distinct from 'superadmin'::user_role and auth.uid() is not null then
    new.doctor_id := old.doctor_id; new.clinic_id := old.clinic_id;
    if new.consultation_fee is not null and (new.consultation_fee < 0 or new.consultation_fee > 2000000) then
      raise exception 'Érvénytelen díj';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_protect_doctor_clinic_keys on public.doctor_clinics;
create trigger trg_protect_doctor_clinic_keys before update on public.doctor_clinics
  for each row execute function public.protect_doctor_clinic_keys();

create table if not exists public.admin_requests (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('clinic_add_doctor','clinic_remove_doctor','doctor_add_clinic','doctor_remove_clinic','name_change','other')),
  clinic_id uuid references public.clinics(id) on delete cascade,
  doctor_id uuid references public.doctors(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  message text check (char_length(coalesce(message,'')) <= 3000),
  status text not null default 'pending' check (status in ('pending','approved','rejected','done')),
  admin_note text,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
alter table public.admin_requests enable row level security;
drop policy if exists "own requests insert" on public.admin_requests;
create policy "own requests insert" on public.admin_requests for insert to authenticated
  with check (
    created_by = auth.uid() and status = 'pending' and (
      (get_my_role() = 'clinic_admin'::user_role and clinic_id in (select id from public.clinics where admin_user_id = auth.uid()))
      or (get_my_role() = 'doctor_admin'::user_role and doctor_id in (select id from public.doctors where admin_user_id = auth.uid()))
    ));
drop policy if exists "own requests read" on public.admin_requests;
create policy "own requests read" on public.admin_requests for select to authenticated
  using (created_by = auth.uid() or get_my_role() = 'superadmin'::user_role);
drop policy if exists "superadmin manage requests" on public.admin_requests;
create policy "superadmin manage requests" on public.admin_requests for all to authenticated
  using (get_my_role() = 'superadmin'::user_role) with check (get_my_role() = 'superadmin'::user_role);
create index if not exists admin_requests_status_idx on public.admin_requests(status, created_at desc);

drop policy if exists "photos auth insert" on storage.objects;
drop policy if exists "photos auth update" on storage.objects;
drop policy if exists "photos auth delete" on storage.objects;
drop policy if exists "clinic-photos auth upload" on storage.objects;
drop policy if exists "clinic-photos auth update" on storage.objects;
drop policy if exists "clinic-photos auth delete" on storage.objects;
drop policy if exists "auth_upload_site_assets" on storage.objects;
drop policy if exists "auth_update_site_assets" on storage.objects;
drop policy if exists "auth_delete_site_assets" on storage.objects;

create or replace function public.can_write_photo(p_bucket text, p_name text) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
  select case
    when public.get_my_role() = 'superadmin'::user_role then p_bucket in ('doctor-photos','clinic-photos','site-assets')
    when p_bucket = 'doctor-photos' and public.get_my_role() = 'doctor_admin'::user_role then
      split_part(p_name,'/',1) in (select id::text from public.doctors where admin_user_id = auth.uid())
    when p_bucket = 'clinic-photos' and public.get_my_role() = 'clinic_admin'::user_role then
      split_part(p_name,'/',1) in (select id::text from public.clinics where admin_user_id = auth.uid())
    else false end;
$$;
drop policy if exists "photos owner insert" on storage.objects;
drop policy if exists "photos owner update" on storage.objects;
drop policy if exists "photos owner delete" on storage.objects;
create policy "photos owner insert" on storage.objects for insert to authenticated
  with check (public.can_write_photo(bucket_id, name));
create policy "photos owner update" on storage.objects for update to authenticated
  using (public.can_write_photo(bucket_id, name)) with check (public.can_write_photo(bucket_id, name));
create policy "photos owner delete" on storage.objects for delete to authenticated
  using (public.can_write_photo(bucket_id, name));

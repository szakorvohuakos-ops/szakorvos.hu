-- 011: orvos-admin hiányzó jogosultságok
-- Alkalmazva élesben: 2026-09-30 (Supabase migration: doctor_admin_missing_policies)
drop policy if exists "Doctor admin create own profile" on public.doctors;
create policy "Doctor admin create own profile" on public.doctors
  for insert to authenticated
  with check (get_my_role() = 'doctor_admin'::user_role and admin_user_id = auth.uid());

drop policy if exists "Doctor admin manage own specialties" on public.doctor_specialties;
create policy "Doctor admin manage own specialties" on public.doctor_specialties
  for all to authenticated
  using (get_my_role() = 'doctor_admin'::user_role and doctor_id in (select id from public.doctors where admin_user_id = auth.uid()))
  with check (get_my_role() = 'doctor_admin'::user_role and doctor_id in (select id from public.doctors where admin_user_id = auth.uid()));

drop policy if exists "Doctor admin manage own insurances" on public.doctor_insurances;
create policy "Doctor admin manage own insurances" on public.doctor_insurances
  for all to authenticated
  using (get_my_role() = 'doctor_admin'::user_role and doctor_id in (select id from public.doctors where admin_user_id = auth.uid()))
  with check (get_my_role() = 'doctor_admin'::user_role and doctor_id in (select id from public.doctors where admin_user_id = auth.uid()));

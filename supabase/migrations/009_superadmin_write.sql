-- 009: szuperadmin írási jog a hiányzó tartalomtáblákra (admin felülethez)
-- Alkalmazva élesben: 2026-09-30 (Supabase migration: superadmin_write_missing_tables)
do $$
declare t text;
begin
  foreach t in array array['treatments','doctor_clinics','doctor_specialties','doctor_insurances','insurance_types','availability']
  loop
    execute format('drop policy if exists "superadmin manage %s" on public.%I', t, t);
    execute format('create policy "superadmin manage %s" on public.%I for all to authenticated using (get_my_role() = ''superadmin''::user_role) with check (get_my_role() = ''superadmin''::user_role)', t, t);
  end loop;
end $$;

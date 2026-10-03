-- 015: Partnerprogram – spamvédelem, adatlap-igénylés, szuperadmin-kezelés (2026-10-03)
-- Futtatás: Supabase → SQL Editor → az egész fájl beillesztése → Run. Többször is futtatható.

-- 1) új oszlopok: melyik adatlapot igényli, üzenet, hozzájárulás, admin-jegyzet
alter table public.partner_registrations
  add column if not exists doctor_id uuid references public.doctors(id) on delete set null,
  add column if not exists clinic_id uuid references public.clinics(id) on delete set null,
  add column if not exists message text,
  add column if not exists consent boolean not null default false,
  add column if not exists admin_note text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists user_id uuid;
alter table public.partner_registrations alter column status set default 'new';

-- 2) szigorúbb beküldési szabály (a botok eddig szakterület nélkül, értelmetlen településsel küldtek)
drop policy if exists "partner insert validated" on public.partner_registrations;
create policy "partner insert validated" on public.partner_registrations for insert to anon, authenticated
  with check (
    consent = true
    and coalesce(status,'new') = 'new'
    and reg_type in ('doctor','clinic')
    and char_length(coalesce(first_name,'')) between 2 and 100
    and char_length(coalesce(last_name,'')) between 2 and 100
    and email ~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$' and char_length(email) <= 200
    and char_length(coalesce(phone,'')) between 6 and 40
    and char_length(coalesce(city,'')) between 2 and 120
    and char_length(coalesce(specialty,'')) <= 120
    and char_length(coalesce(clinic_name,'')) <= 200
    and char_length(coalesce(message,'')) <= 2000
    and (reg_type = 'clinic' or specialty is not null or doctor_id is not null)
    and (reg_type = 'doctor' or clinic_name is not null or clinic_id is not null)
    and admin_note is null and reviewed_at is null and user_id is null
  );
drop policy if exists "superadmin update partner_reg" on public.partner_registrations;
create policy "superadmin update partner_reg" on public.partner_registrations for update to authenticated
  using (get_my_role() = 'superadmin'::user_role) with check (get_my_role() = 'superadmin'::user_role);
drop policy if exists "superadmin delete partner_reg" on public.partner_registrations;
create policy "superadmin delete partner_reg" on public.partner_registrations for delete to authenticated
  using (get_my_role() = 'superadmin'::user_role);

-- 3) gyakorisági korlát: ugyanaz az e-mail 24 órán belül egyszer, összesen max. 15 / 10 perc
create or replace function public.partner_reg_rate_limit() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if exists (select 1 from public.partner_registrations where lower(email) = lower(new.email) and created_at > now() - interval '24 hours') then
    raise exception 'Ezzel az e-mail-címmel már érkezett jelentkezés az elmúlt 24 órában.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.partner_registrations where created_at > now() - interval '10 minutes') >= 15 then
    raise exception 'Túl sok jelentkezés – kérjük, próbálja újra később.' using errcode = 'P0001';
  end if;
  new.created_at := now(); new.status := 'new';
  return new;
end $$;
drop trigger if exists trg_partner_reg_rate_limit on public.partner_registrations;
create trigger trg_partner_reg_rate_limit before insert on public.partner_registrations
  for each row execute function public.partner_reg_rate_limit();

-- ugyanez az adatlap-igénylésekre (orvos-adatlapról beküldött „Ön az orvos?” űrlap)
create or replace function public.claim_rate_limit() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if exists (select 1 from public.doctor_claim_requests where lower(email) = lower(new.email) and created_at > now() - interval '24 hours') then
    raise exception 'Ezzel az e-mail-címmel már érkezett igénylés az elmúlt 24 órában.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.doctor_claim_requests where created_at > now() - interval '10 minutes') >= 15 then
    raise exception 'Túl sok igénylés – kérjük, próbálja újra később.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists trg_claim_rate_limit on public.doctor_claim_requests;
create trigger trg_claim_rate_limit before insert on public.doctor_claim_requests
  for each row execute function public.claim_rate_limit();

-- 4) a 2026-10-04 előtti, fel nem dolgozott jelentkezések spamnek jelölése (nem törlés – visszaállítható)
update public.partner_registrations set status = 'spam'
 where coalesce(status,'new') = 'new' and created_at < '2026-10-04';

create index if not exists partner_reg_status_idx on public.partner_registrations(status, created_at desc);
create index if not exists partner_reg_email_idx on public.partner_registrations(lower(email), created_at desc);

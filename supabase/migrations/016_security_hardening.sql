-- 016 — biztonsági hardening (audit, 2026-10-03)
-- Futtatás: Supabase Dashboard → SQL Editor → beillesztés → Run

-- 1) Belső/trigger függvények ne legyenek RPC-ként hívhatók
revoke execute on function public.protect_clinic_columns() from public, anon, authenticated;
revoke execute on function public.protect_doctor_clinic_keys() from public, anon, authenticated;
revoke execute on function public.protect_doctor_columns() from public, anon, authenticated;
revoke execute on function public.claim_rate_limit() from public, anon, authenticated;
revoke execute on function public.partner_reg_rate_limit() from public, anon, authenticated;
revoke execute on function public.can_write_photo(text, text) from public, anon;
revoke execute on function public.calc_doctor_completeness(public.doctors) from public, anon;
revoke execute on function public.get_doctor_completeness_breakdown(uuid) from public, anon;

-- 2) Ottfelejtett backup tábla archívba
do $$
begin
  if to_regclass('public.doctor_clinics_backup_20260603') is not null then
    if to_regclass('archive_2026_09.doctor_clinics_backup_20260603') is not null then
      alter table public.doctor_clinics_backup_20260603 rename to doctor_clinics_backup_20260603_pub;
      alter table public.doctor_clinics_backup_20260603_pub set schema archive_2026_09;
    else
      alter table public.doctor_clinics_backup_20260603 set schema archive_2026_09;
    end if;
  end if;
end $$;

-- 3) Kapcsolati üzenetek: max 3 üzenet / e-mail-cím / 24 óra
create or replace function public.contact_msg_rate_limit()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if (select count(*) from public.contact_messages
      where lower(email) = lower(new.email)
        and created_at > now() - interval '24 hours') >= 3 then
    raise exception 'Erről az e-mail-címről ma már érkezett üzenet. Kérjük, próbálja újra később.';
  end if;
  return new;
end $$;
revoke execute on function public.contact_msg_rate_limit() from public, anon, authenticated;

drop trigger if exists trg_contact_msg_rate_limit on public.contact_messages;
create trigger trg_contact_msg_rate_limit
  before insert on public.contact_messages
  for each row execute function public.contact_msg_rate_limit();

-- 4) Adatlap-átvételi kérelmek: max 2 kérelem / e-mail-cím / 24 óra
create or replace function public.claim_req_rate_limit()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if (select count(*) from public.doctor_claim_requests
      where lower(email) = lower(new.email)
        and created_at > now() - interval '24 hours') >= 2 then
    raise exception 'Erről az e-mail-címről ma már érkezett kérelem. Kérjük, próbálja újra később.';
  end if;
  return new;
end $$;
revoke execute on function public.claim_req_rate_limit() from public, anon, authenticated;

drop trigger if exists trg_claim_req_rate_limit on public.doctor_claim_requests;
create trigger trg_claim_req_rate_limit
  before insert on public.doctor_claim_requests
  for each row execute function public.claim_req_rate_limit();

-- 5) A bejelentkezett felhasználóknak továbbra is kell (admin fotófeltöltés stb.)
grant execute on function public.can_write_photo(text, text) to authenticated;
grant execute on function public.calc_doctor_completeness(public.doctors) to authenticated;
grant execute on function public.get_doctor_completeness_breakdown(uuid) to authenticated;

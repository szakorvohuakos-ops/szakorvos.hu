-- 007: adatmegőrzési idők automatikus érvényesítése (adatvédelmi szabályzat "Megőrzési idők" fejezete)
-- Alkalmazva élesben: 2026-09-30 (Supabase migration: retention_cleanup_pg_cron)
create extension if not exists pg_cron;

create or replace function public.szk_retention_cleanup()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.contact_messages where created_at < now() - interval '1 year';
  delete from public.partner_registrations where created_at < now() - interval '1 year';
  delete from public.search_logs where created_at < now() - interval '14 months';
  delete from v2.search_logs where created_at < now() - interval '14 months';
  delete from public.search_intent_cache where created_at < now() - interval '30 days';
  delete from v2.ai_cache where created_at < now() - interval '30 days';
end;
$$;
revoke execute on function public.szk_retention_cleanup() from anon, authenticated;
select cron.schedule('szk-retention-cleanup', '40 3 * * *', $$select public.szk_retention_cleanup()$$);

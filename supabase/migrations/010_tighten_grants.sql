-- 010: RPC execute-jogok szűkítése (a PUBLIC-grant miatt a korábbi revoke nem érvényesült)
-- Alkalmazva élesben: 2026-09-30 (Supabase migration: tighten_function_grants)
revoke execute on function public.szk_retention_cleanup() from public, anon, authenticated;
revoke execute on function public.admin_stats_overview(int) from public, anon;
grant execute on function public.admin_stats_overview(int) to authenticated;
revoke execute on function public.admin_search_stats(int) from public, anon;
grant execute on function public.admin_search_stats(int) to authenticated;
revoke execute on function public.verify_doctor(uuid, boolean) from public, anon;
grant execute on function public.verify_doctor(uuid, boolean) to authenticated;

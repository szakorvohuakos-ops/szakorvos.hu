-- 008: szuperadmin statisztika RPC-k + site_events olvasási policy
-- Alkalmazva élesben: 2026-09-30 (Supabase migration: admin_stats_rpcs)

create policy "superadmin read site_events" on public.site_events
  for select to authenticated using (get_my_role() = 'superadmin'::user_role);

create or replace function public.admin_stats_overview(p_days int default 14)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v jsonb; begin
  if get_my_role() is distinct from 'superadmin'::user_role then
    raise exception 'Csak szuperadmin';
  end if;
  select jsonb_build_object(
    'daily', (select coalesce(jsonb_agg(t order by d),'[]'::jsonb) from (
        select date_trunc('day',created_at)::date d,
               count(*) filter (where event='pageview') pageviews,
               count(distinct session_id) sessions
        from site_events where created_at > now() - (p_days||' days')::interval
        group by 1) t),
    'devices', (select coalesce(jsonb_object_agg(device,c),'{}'::jsonb) from (
        select coalesce(device,'ismeretlen') device, count(distinct session_id) c
        from site_events where created_at > now() - (p_days||' days')::interval group by 1) t),
    'top_pages', (select coalesce(jsonb_agg(t),'[]'::jsonb) from (
        select split_part(page,'?',1) page, count(*) c from site_events
        where event='pageview' and created_at > now() - (p_days||' days')::interval
        group by 1 order by c desc limit 12) t),
    'top_referrers', (select coalesce(jsonb_agg(t),'[]'::jsonb) from (
        select referrer, count(*) c from site_events
        where event='pageview' and referrer is not null and referrer <> ''
          and referrer not like '%szakorvos.hu%'
          and created_at > now() - (p_days||' days')::interval
        group by 1 order by c desc limit 10) t),
    'events', (select coalesce(jsonb_object_agg(event,c),'{}'::jsonb) from (
        select event, count(*) c from site_events
        where created_at > now() - (p_days||' days')::interval group by 1) t),
    'today_sessions', (select count(distinct session_id) from site_events where created_at::date = current_date),
    'today_pageviews', (select count(*) from site_events where event='pageview' and created_at::date = current_date)
  ) into v;
  return v;
end $$;

create or replace function public.admin_search_stats(p_days int default 14)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v jsonb; begin
  if get_my_role() is distinct from 'superadmin'::user_role then
    raise exception 'Csak szuperadmin';
  end if;
  select jsonb_build_object(
    'top_queries', (select coalesce(jsonb_agg(t),'[]'::jsonb) from (
        select lower(trim(query)) q, count(*) c, round(avg(result_count)) avg_res
        from site_events where event='search' and query is not null and trim(query)<>''
          and created_at > now() - (p_days||' days')::interval
        group by 1 order by c desc limit 20) t),
    'zero_results', (select coalesce(jsonb_agg(t),'[]'::jsonb) from (
        select lower(trim(query)) q, count(*) c
        from site_events where event='search' and result_count = 0 and query is not null and trim(query)<>''
          and created_at > now() - (p_days||' days')::interval
        group by 1 order by c desc limit 15) t),
    'top_specialties', (select coalesce(jsonb_agg(t),'[]'::jsonb) from (
        select specialty_slug, count(*) c from site_events
        where event='search' and specialty_slug is not null
          and created_at > now() - (p_days||' days')::interval
        group by 1 order by c desc limit 12) t),
    'top_cities', (select coalesce(jsonb_agg(t),'[]'::jsonb) from (
        select city, count(*) c from site_events
        where event='search' and city is not null and city<>''
          and created_at > now() - (p_days||' days')::interval
        group by 1 order by c desc limit 12) t),
    'daily_searches', (select coalesce(jsonb_agg(t order by d),'[]'::jsonb) from (
        select date_trunc('day',created_at)::date d, count(*) c
        from site_events where event='search'
          and created_at > now() - (p_days||' days')::interval
        group by 1) t)
  ) into v;
  return v;
end $$;

revoke execute on function public.admin_stats_overview(int) from anon;
revoke execute on function public.admin_search_stats(int) from anon;

-- ──────────────────────────────────────────────────────────────────────────
-- Szakorvos.hu — SEO slug migráció
-- ──────────────────────────────────────────────────────────────────────────
-- Cél: az orvosoknak (és klinikáknak) legyen SEO-barát slug-juk a URL-ekben.
--   Régi:  /orvos.html?id=a1b2c3d4-e5f6-...
--   Új:    /orvos/dr-kiss-janos-kardiologus-budapest
--
-- Lépések:
--   1. immutable hu_slugify() függvény (magyar ékezet → ASCII)
--   2. doctors.slug oszlop + unique index
--   3. clinics.slug oszlop + unique index
--   4. Trigger: új sor INSERT-jénél / név-változásnál auto-generálás
--   5. Egyszeri backfill a meglévő rekordokra
--
-- FUTTATÁS:
--   Supabase Dashboard → SQL Editor → New query → ide bemásolod → RUN
--
--   Az egész script idempotens (újrafuttatható).
-- ──────────────────────────────────────────────────────────────────────────


-- ══════════════════════════════════════════════════════════════════════════
-- 1) MAGYAR SLUGIFY FÜGGVÉNY
-- ══════════════════════════════════════════════════════════════════════════
create or replace function hu_slugify(input text)
returns text
language plpgsql
immutable
as $$
declare
  s text := coalesce(input, '');
begin
  -- Kisbetűsítés
  s := lower(s);

  -- Magyar ékezetes karakterek
  s := translate(s,
    'áàâäãåéèêëíìîïóòôöõőúùûüűýÿñçß',
    'aaaaaaeeeeiiiiooooouuuuuyycss'
  );

  -- Maradék: minden ami nem [a-z0-9] → kötőjel
  s := regexp_replace(s, '[^a-z0-9]+', '-', 'g');

  -- Trim kötőjelek elejéről/végéről
  s := regexp_replace(s, '^-+|-+$', '', 'g');

  -- Két vagy több kötőjel összevonása
  s := regexp_replace(s, '-{2,}', '-', 'g');

  -- Üresség esetén placeholder
  if s = '' then
    s := 'n-a';
  end if;

  return s;
end;
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- 2) DOCTORS TÁBLA — SLUG OSZLOP
-- ══════════════════════════════════════════════════════════════════════════

-- Oszlop felvétele (ha még nincs)
alter table doctors
  add column if not exists slug text;

-- Slug generátor függvény (egyedi slug-ot készít — ütközés esetén -2, -3, …)
create or replace function generate_doctor_slug(p_doctor_id uuid)
returns text
language plpgsql
as $$
declare
  v_name       text;
  v_title      text;
  v_specialty  text;
  v_city       text;
  v_base       text;
  v_slug       text;
  v_counter    int := 1;
begin
  -- Adatok összeszedése
  select d.name, d.title
    into v_name, v_title
    from doctors d
    where d.id = p_doctor_id;

  -- Elsődleges szakterület (ha van)
  select s.name
    into v_specialty
    from doctor_specialties ds
    join specialties s on s.id = ds.specialty_id
    where ds.doctor_id = p_doctor_id
    order by s.name
    limit 1;

  -- Elsődleges klinika városa (ha van)
  select c.name
    into v_city
    from doctor_clinics dc
    join clinics cl on cl.id = dc.clinic_id
    join cities c   on c.id  = cl.city_id
    where dc.doctor_id = p_doctor_id
    order by c.name
    limit 1;

  -- Slug-base felépítése: [title] név [szakterület] [város]
  v_base := concat_ws(' ',
    nullif(v_title, ''),
    v_name,
    nullif(v_specialty, ''),
    nullif(v_city, '')
  );

  v_slug := hu_slugify(v_base);

  -- Maximum hossz 100 — ha hosszabb, levágjuk az utolsó teljes szóig
  if length(v_slug) > 100 then
    v_slug := substring(v_slug from 1 for 100);
    v_slug := regexp_replace(v_slug, '-[^-]*$', '', 'g');
  end if;

  -- Egyediség: ha ütközik, -2, -3, … hozzáfűzése (saját magával nem ütközik)
  while exists (
    select 1 from doctors
     where slug = v_slug
       and id <> p_doctor_id
  ) loop
    v_counter := v_counter + 1;
    v_slug := regexp_replace(v_slug, '-\d+$', '', 'g') || '-' || v_counter::text;
  end loop;

  return v_slug;
end;
$$;


-- Trigger: INSERT-kor és name/title változáskor frissítjük a slug-ot
create or replace function trg_doctor_slug()
returns trigger
language plpgsql
as $$
begin
  -- Csak akkor generálunk újat, ha:
  --   • INSERT (slug üres)
  --   • UPDATE és (a név változott VAGY a title változott VAGY explicit nullra állították)
  if (tg_op = 'INSERT' and (new.slug is null or new.slug = ''))
     or (tg_op = 'UPDATE' and (
       new.name is distinct from old.name
       or new.title is distinct from old.title
       or (new.slug is null and old.slug is not null)
     ))
  then
    -- Az új sor id-jét használjuk; INSERT-nél a NEW már létezik a row-context-ben
    new.slug := generate_doctor_slug(new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists doctors_slug_trigger on doctors;
create trigger doctors_slug_trigger
  before insert or update on doctors
  for each row execute function trg_doctor_slug();


-- ══════════════════════════════════════════════════════════════════════════
-- 3) CLINICS TÁBLA — SLUG OSZLOP
-- ══════════════════════════════════════════════════════════════════════════
alter table clinics
  add column if not exists slug text;

create or replace function generate_clinic_slug(p_clinic_id uuid)
returns text
language plpgsql
as $$
declare
  v_name    text;
  v_city    text;
  v_base    text;
  v_slug    text;
  v_counter int := 1;
begin
  select cl.name, c.name
    into v_name, v_city
    from clinics cl
    left join cities c on c.id = cl.city_id
    where cl.id = p_clinic_id;

  v_base := concat_ws(' ',
    v_name,
    nullif(v_city, '')
  );

  v_slug := hu_slugify(v_base);

  if length(v_slug) > 100 then
    v_slug := substring(v_slug from 1 for 100);
    v_slug := regexp_replace(v_slug, '-[^-]*$', '', 'g');
  end if;

  while exists (
    select 1 from clinics
     where slug = v_slug
       and id <> p_clinic_id
  ) loop
    v_counter := v_counter + 1;
    v_slug := regexp_replace(v_slug, '-\d+$', '', 'g') || '-' || v_counter::text;
  end loop;

  return v_slug;
end;
$$;

create or replace function trg_clinic_slug()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT' and (new.slug is null or new.slug = ''))
     or (tg_op = 'UPDATE' and new.name is distinct from old.name)
  then
    new.slug := generate_clinic_slug(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists clinics_slug_trigger on clinics;
create trigger clinics_slug_trigger
  before insert or update on clinics
  for each row execute function trg_clinic_slug();


-- ══════════════════════════════════════════════════════════════════════════
-- 4) ADMIN_USER_ID UNIQUE CONSTRAINT (race condition védelem DB szinten)
-- ══════════════════════════════════════════════════════════════════════════
-- Korábbi register.html-ben volt egy frontend race condition. A frontend
-- javítás után már megfelelően kezeljük, de DB szinten is jó ha védve van.
-- (Partial index: NULL értékek nem ütköznek egymással.)
do $$
begin
  if not exists (
    select 1 from pg_indexes
     where indexname = 'doctors_admin_user_id_unique_idx'
  ) then
    create unique index doctors_admin_user_id_unique_idx
      on doctors (admin_user_id)
      where admin_user_id is not null;
  end if;
end$$;


-- ══════════════════════════════════════════════════════════════════════════
-- 5) BACKFILL — meglévő rekordok slug-jának generálása
-- ══════════════════════════════════════════════════════════════════════════
-- Az UPDATE-tel automatikusan triggerelődik a slug generálás.
-- Csak azokat töltjük, amelyiknek még nincs slug-ja.

-- Doctors
do $$
declare
  rec record;
begin
  for rec in select id from doctors where slug is null or slug = '' loop
    update doctors
       set slug = generate_doctor_slug(rec.id)
     where id = rec.id;
  end loop;
end$$;

-- Clinics
do $$
declare
  rec record;
begin
  for rec in select id from clinics where slug is null or slug = '' loop
    update clinics
       set slug = generate_clinic_slug(rec.id)
     where id = rec.id;
  end loop;
end$$;


-- ══════════════════════════════════════════════════════════════════════════
-- 6) UNIQUE INDEX a slug-okra (csak miután a backfill lefutott)
-- ══════════════════════════════════════════════════════════════════════════
create unique index if not exists doctors_slug_unique_idx
  on doctors (slug)
  where slug is not null;

create unique index if not exists clinics_slug_unique_idx
  on clinics (slug)
  where slug is not null;


-- ══════════════════════════════════════════════════════════════════════════
-- 7) RATE LIMITS TÁBLA (az ai-chat rate limiterhez)
-- ══════════════════════════════════════════════════════════════════════════
create table if not exists rate_limits (
  id          bigint generated always as identity primary key,
  bucket_key  text not null,
  created_at  timestamptz not null default now()
);

create index if not exists rate_limits_lookup_idx
  on rate_limits (bucket_key, created_at desc);

-- RLS: anon role ne férjen hozzá
alter table rate_limits enable row level security;
-- (alapból zárva, csak a service_role férhet hozzá)


-- ══════════════════════════════════════════════════════════════════════════
-- 8) SANITY ELLENŐRZÉS
-- ══════════════════════════════════════════════════════════════════════════
-- Futtasd ezeket utána a SQL editor-ben hogy lásd: minden rendben?

-- select count(*), count(slug), count(*) - count(slug) as missing_slug
--   from doctors;
--
-- select count(*), count(slug), count(*) - count(slug) as missing_slug
--   from clinics;
--
-- -- Néhány példa slug
-- select id, name, title, slug from doctors order by random() limit 10;
-- select id, name, slug from clinics order by random() limit 10;

-- Categories and subcategories management foundation.
-- Phase 1 keeps the existing public/search compatibility intact:
-- - fresh databases can create categories with uuid ids;
-- - existing production databases keep the current categories.id type so
--   professional_categories and current category_id URLs are not broken.

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'categories'
  ) then
    create table public.categories (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      slug text not null unique,
      description text,
      image_url text,
      icon text,
      sort_order integer not null default 0,
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  end if;
end $$;

alter table public.categories
  add column if not exists description text,
  add column if not exists icon text,
  add column if not exists sort_order integer not null default 0,
  add column if not exists is_active boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists categories_slug_unique_idx
  on public.categories (slug);

create index if not exists categories_is_active_idx
  on public.categories (is_active);

create index if not exists categories_sort_order_idx
  on public.categories (sort_order);

do $$
declare
  category_id_type text;
begin
  select format_type(attribute.atttypid, attribute.atttypmod)
  into category_id_type
  from pg_attribute attribute
  join pg_class class on class.oid = attribute.attrelid
  join pg_namespace namespace on namespace.oid = class.relnamespace
  where namespace.nspname = 'public'
    and class.relname = 'categories'
    and attribute.attname = 'id'
    and attribute.attnum > 0
    and not attribute.attisdropped;

  if category_id_type is null then
    raise exception 'Unable to determine public.categories.id type';
  end if;

  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'subcategories'
  ) then
    execute format(
      'create table public.subcategories (
        id uuid primary key default gen_random_uuid(),
        category_id %s not null references public.categories(id) on delete restrict,
        name text not null,
        slug text not null,
        sort_order integer not null default 0,
        is_active boolean not null default true,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )',
      category_id_type
    );
  end if;
end $$;

alter table public.subcategories
  add column if not exists name text,
  add column if not exists slug text,
  add column if not exists sort_order integer not null default 0,
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  alter table public.subcategories
    alter column name set not null,
    alter column slug set not null,
    alter column sort_order set not null,
    alter column is_active set not null,
    alter column created_at set not null,
    alter column updated_at set not null;
exception
  when not_null_violation then
    raise notice 'Skipped strict subcategories NOT NULL constraints because existing rows need cleanup: %', sqlerrm;
end $$;

create unique index if not exists subcategories_category_slug_unique_idx
  on public.subcategories (category_id, slug);

create index if not exists subcategories_category_id_idx
  on public.subcategories (category_id);

create index if not exists subcategories_is_active_idx
  on public.subcategories (is_active);

create index if not exists subcategories_sort_order_idx
  on public.subcategories (sort_order);

create or replace function public.tg_categories_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_categories_updated_at on public.categories;
create trigger set_categories_updated_at
before update on public.categories
for each row execute function public.tg_categories_set_updated_at();

drop trigger if exists set_subcategories_updated_at on public.subcategories;
create trigger set_subcategories_updated_at
before update on public.subcategories
for each row execute function public.tg_categories_set_updated_at();

alter table public.categories enable row level security;
alter table public.categories force row level security;

alter table public.subcategories enable row level security;
alter table public.subcategories force row level security;

drop policy if exists "Categories are readable" on public.categories;
drop policy if exists "Categories: active read" on public.categories;
create policy "Categories: active read"
on public.categories
for select
to anon, authenticated
using (is_active = true);

drop policy if exists "Categories: admin read all" on public.categories;
create policy "Categories: admin read all"
on public.categories
for select
to authenticated
using ((select public.is_admin()));

drop policy if exists "Categories: admin manage" on public.categories;
drop policy if exists "Categories: admin insert" on public.categories;
create policy "Categories: admin insert"
on public.categories
for insert
to authenticated
with check ((select public.is_admin()));

drop policy if exists "Categories: admin update" on public.categories;
create policy "Categories: admin update"
on public.categories
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists "Categories: admin delete" on public.categories;
create policy "Categories: admin delete"
on public.categories
for delete
to authenticated
using ((select public.is_admin()));

drop policy if exists "Subcategories: active read" on public.subcategories;
create policy "Subcategories: active read"
on public.subcategories
for select
to anon, authenticated
using (
  is_active = true
  and exists (
    select 1
    from public.categories category
    where category.id = subcategories.category_id
      and category.is_active = true
  )
);

drop policy if exists "Subcategories: admin read all" on public.subcategories;
create policy "Subcategories: admin read all"
on public.subcategories
for select
to authenticated
using ((select public.is_admin()));

drop policy if exists "Subcategories: admin insert" on public.subcategories;
create policy "Subcategories: admin insert"
on public.subcategories
for insert
to authenticated
with check ((select public.is_admin()));

drop policy if exists "Subcategories: admin update" on public.subcategories;
create policy "Subcategories: admin update"
on public.subcategories
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists "Subcategories: admin delete" on public.subcategories;
create policy "Subcategories: admin delete"
on public.subcategories
for delete
to authenticated
using ((select public.is_admin()));

grant select on table public.categories to anon, authenticated;
grant select on table public.subcategories to anon, authenticated;
grant insert, update, delete on table public.categories to authenticated;
grant insert, update, delete on table public.subcategories to authenticated;

do $$
begin
  grant usage, select on sequence public.categories_id_seq to authenticated;
exception
  when undefined_table then null;
end $$;

select pg_notify('pgrst', 'reload schema');

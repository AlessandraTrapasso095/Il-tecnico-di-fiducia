-- Professional taxonomy selection.
-- Keeps the existing many-to-many professional_categories relation for category
-- compatibility, and adds one optional dynamic subcategory selected by id.

alter table public.professional_profiles
  add column if not exists subcategory_id uuid references public.subcategories(id) on delete set null;

create index if not exists professional_profiles_subcategory_id_idx
  on public.professional_profiles (subcategory_id);

alter table public.professional_directory
  add column if not exists subcategory_id uuid references public.subcategories(id) on delete set null;

create index if not exists professional_directory_subcategory_id_idx
  on public.professional_directory (subcategory_id);

-- Best-effort, non-destructive compatibility mapping:
-- only exact/slug-equivalent headline matches are linked automatically.
insert into public.professional_categories (professional_id, category_id)
select pp.id, c.id
from public.professional_profiles pp
join public.categories c
  on c.is_active = true
 and (
    lower(trim(coalesce(pp.headline, ''))) = lower(trim(c.name))
    or regexp_replace(lower(trim(coalesce(pp.headline, ''))), '[^a-z0-9]+', '-', 'g') = c.slug
 )
where not exists (
  select 1
  from public.professional_categories pc
  where pc.professional_id = pp.id
)
on conflict do nothing;

-- Best-effort subcategory mapping: only one exact legacy specialization is mapped.
update public.professional_profiles pp
set subcategory_id = sc.id
from public.professional_categories pc
join public.subcategories sc
  on sc.category_id = pc.category_id
where pp.id = pc.professional_id
  and pp.subcategory_id is null
  and sc.is_active = true
  and array_length(pp.specializations, 1) = 1
  and lower(trim(pp.specializations[1])) = lower(trim(sc.name));

update public.professional_directory pd
set subcategory_id = pp.subcategory_id
from public.professional_profiles pp
where pd.id = pp.id
  and pp.subcategory_id is not null
  and pd.subcategory_id is distinct from pp.subcategory_id;

create or replace function public.tg_professional_profiles_sync_directory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.professional_directory (
    id,
    headline,
    bio,
    specializations,
    avatar_url,
    cover_url,
    subcategory_id,
    available_remote,
    available_travel
  )
  values (
    new.id,
    new.headline,
    new.bio,
    new.specializations,
    new.avatar_url,
    new.cover_url,
    new.subcategory_id,
    coalesce(new.available_remote, false),
    coalesce(new.available_travel, false)
  )
  on conflict (id) do update
    set headline = excluded.headline,
        bio = excluded.bio,
        specializations = excluded.specializations,
        avatar_url = excluded.avatar_url,
        cover_url = excluded.cover_url,
        subcategory_id = excluded.subcategory_id,
        available_remote = excluded.available_remote,
        available_travel = excluded.available_travel,
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists professional_profiles_sync_directory on public.professional_profiles;
create trigger professional_profiles_sync_directory
after insert or update of headline, bio, specializations, avatar_url, cover_url, subcategory_id, available_remote, available_travel
on public.professional_profiles
for each row execute function public.tg_professional_profiles_sync_directory();

select pg_notify('pgrst', 'reload schema');

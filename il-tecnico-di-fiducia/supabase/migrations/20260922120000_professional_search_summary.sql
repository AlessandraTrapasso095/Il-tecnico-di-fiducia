-- Short presentation shown in professional search-result cards.
-- It is intentionally separate from the full professional bio.

alter table public.professional_profiles
  add column if not exists search_summary text;

alter table public.professional_directory
  add column if not exists search_summary text;

alter table public.professional_profiles
  drop constraint if exists professional_profiles_search_summary_length_check;

alter table public.professional_profiles
  add constraint professional_profiles_search_summary_length_check
  check (
    search_summary is null
    or char_length(search_summary) <= 180
  );

alter table public.professional_directory
  drop constraint if exists professional_directory_search_summary_length_check;

alter table public.professional_directory
  add constraint professional_directory_search_summary_length_check
  check (
    search_summary is null
    or char_length(search_summary) <= 180
  );

update public.professional_directory pd
set search_summary = pp.search_summary
from public.professional_profiles pp
where pd.id = pp.id
  and pd.search_summary is distinct from pp.search_summary;

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
    search_summary,
    bio,
    specializations,
    avatar_url,
    cover_url,
    subcategory_id,
    available_remote,
    available_travel,
    is_ctu,
    is_ctp
  )
  values (
    new.id,
    new.headline,
    new.search_summary,
    new.bio,
    new.specializations,
    new.avatar_url,
    new.cover_url,
    new.subcategory_id,
    coalesce(new.available_remote, false),
    coalesce(new.available_travel, false),
    coalesce(new.is_ctu, false),
    coalesce(new.is_ctp, false)
  )
  on conflict (id) do update
    set headline = excluded.headline,
        search_summary = excluded.search_summary,
        bio = excluded.bio,
        specializations = excluded.specializations,
        avatar_url = excluded.avatar_url,
        cover_url = excluded.cover_url,
        subcategory_id = excluded.subcategory_id,
        available_remote = excluded.available_remote,
        available_travel = excluded.available_travel,
        is_ctu = excluded.is_ctu,
        is_ctp = excluded.is_ctp,
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists professional_profiles_sync_directory
  on public.professional_profiles;

create trigger professional_profiles_sync_directory
after insert or update of
  headline,
  search_summary,
  bio,
  specializations,
  avatar_url,
  cover_url,
  subcategory_id,
  available_remote,
  available_travel,
  is_ctu,
  is_ctp
on public.professional_profiles
for each row
execute function public.tg_professional_profiles_sync_directory();

select pg_notify('pgrst', 'reload schema');

-- CTU / CTP are professional qualifications, not profession categories.
--
-- Keep them as independent boolean attributes:
-- - a professional can be neither;
-- - CTU only;
-- - CTP only;
-- - both.
--
-- They are mirrored into professional_directory so public search can expose
-- and filter them without reading the private professional profile table.

alter table public.professional_profiles
  add column if not exists is_ctu boolean not null default false,
  add column if not exists is_ctp boolean not null default false;

alter table public.professional_directory
  add column if not exists is_ctu boolean not null default false,
  add column if not exists is_ctp boolean not null default false;

update public.professional_directory pd
set
  is_ctu = pp.is_ctu,
  is_ctp = pp.is_ctp
from public.professional_profiles pp
where pd.id = pp.id
  and (
    pd.is_ctu is distinct from pp.is_ctu
    or pd.is_ctp is distinct from pp.is_ctp
  );

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
    available_travel,
    is_ctu,
    is_ctp
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
    coalesce(new.available_travel, false),
    coalesce(new.is_ctu, false),
    coalesce(new.is_ctp, false)
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

create index if not exists professional_directory_is_ctu_idx
  on public.professional_directory (is_ctu)
  where is_ctu = true;

create index if not exists professional_directory_is_ctp_idx
  on public.professional_directory (is_ctp)
  where is_ctp = true;

select pg_notify('pgrst', 'reload schema');

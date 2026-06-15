-- Complete professional profiles: editable CV sections, review replies, post media.
-- No seed/demo data.

alter table public.professional_profiles
  add column if not exists public_email text,
  add column if not exists education jsonb not null default '[]'::jsonb,
  add column if not exists work_experiences jsonb not null default '[]'::jsonb,
  add column if not exists certifications jsonb not null default '[]'::jsonb,
  add column if not exists services_offered text[] not null default '{}',
  add column if not exists operational_provinces text[] not null default '{}';

alter table public.reviews
  add column if not exists professional_reply text,
  add column if not exists professional_replied_at timestamptz;

create table if not exists public.post_attachments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  file_url text not null,
  file_path text,
  file_type text not null,
  mime_type text,
  file_name text,
  file_size bigint,
  created_at timestamptz not null default now(),
  constraint post_attachments_file_type_check check (file_type in ('image', 'video'))
);

-- Backward-compatible alignment for local/hosted databases that may have received
-- an earlier draft using uploader_id/storage_path/public_url/media_type.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'post_attachments'
      and column_name = 'uploader_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'post_attachments'
      and column_name = 'user_id'
  ) then
    alter table public.post_attachments rename column uploader_id to user_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'post_attachments'
      and column_name = 'storage_path'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'post_attachments'
      and column_name = 'file_path'
  ) then
    alter table public.post_attachments rename column storage_path to file_path;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'post_attachments'
      and column_name = 'public_url'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'post_attachments'
      and column_name = 'file_url'
  ) then
    alter table public.post_attachments rename column public_url to file_url;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'post_attachments'
      and column_name = 'media_type'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'post_attachments'
      and column_name = 'file_type'
  ) then
    alter table public.post_attachments rename column media_type to file_type;
  end if;
end $$;

alter table public.post_attachments
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists file_url text,
  add column if not exists file_path text,
  add column if not exists file_type text,
  add column if not exists mime_type text,
  add column if not exists file_name text,
  add column if not exists file_size bigint,
  add column if not exists created_at timestamptz not null default now();

update public.post_attachments pa
set user_id = p.author_id
from public.posts p
where pa.post_id = p.id
  and pa.user_id is null;

do $$
begin
  alter table public.post_attachments
    alter column user_id set not null,
    alter column file_url set not null,
    alter column file_type set not null;
exception
  when check_violation or not_null_violation then
    raise notice 'Skipped strict post_attachments NOT NULL constraints because existing rows need cleanup: %', sqlerrm;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'post_attachments_file_type_check'
      and conrelid = 'public.post_attachments'::regclass
  ) then
    alter table public.post_attachments
      add constraint post_attachments_file_type_check
      check (file_type in ('image', 'video'));
  end if;
exception
  when check_violation then
    raise notice 'Skipped post_attachments file_type check because existing rows need cleanup: %', sqlerrm;
end $$;

drop index if exists post_attachments_post_idx;
create index if not exists post_attachments_post_id_idx
on public.post_attachments (post_id, created_at);

create index if not exists post_attachments_user_id_idx
on public.post_attachments (user_id, created_at);

alter table public.post_attachments enable row level security;
alter table public.post_attachments force row level security;

drop policy if exists "Post attachments: readable with post" on public.post_attachments;
create policy "Post attachments: readable with post"
on public.post_attachments
for select
to authenticated
using (
  exists (
    select 1
    from public.posts p
    where p.id = public.post_attachments.post_id
      and (select public.can_view_post(p.id))
  )
);

drop policy if exists "Post attachments: owner insert" on public.post_attachments;
create policy "Post attachments: owner insert"
on public.post_attachments
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.posts p
    where p.id = public.post_attachments.post_id
      and p.author_id = (select auth.uid())
  )
);

drop policy if exists "Post attachments: owner delete" on public.post_attachments;
create policy "Post attachments: owner delete"
on public.post_attachments
for delete
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.posts p
    where p.id = public.post_attachments.post_id
      and p.author_id = (select auth.uid())
  )
);

drop policy if exists "Post attachments: owner update" on public.post_attachments;
create policy "Post attachments: owner update"
on public.post_attachments
for update
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.posts p
    where p.id = public.post_attachments.post_id
      and p.author_id = (select auth.uid())
  )
)
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.posts p
    where p.id = public.post_attachments.post_id
      and p.author_id = (select auth.uid())
  )
);

do $$
begin
  -- Existing project bucket for non-sensitive public media:
  -- avatars, covers and post attachments use <uid>/posts/<post_id>/<file>.
  update storage.buckets
  set public = true
  where id = 'public-media';

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'storage'
      and table_name = 'buckets'
      and column_name = 'allowed_mime_types'
  ) then
    update storage.buckets
    set allowed_mime_types = array[
      'image/jpeg', 'image/png', 'image/webp',
      'video/mp4', 'video/quicktime'
    ]
    where id = 'public-media';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'storage'
      and table_name = 'buckets'
      and column_name = 'file_size_limit'
  ) then
    update storage.buckets
    set file_size_limit = 52428800
    where id = 'public-media';
  end if;
exception when others then
  raise notice 'Skipped public-media bucket update for post attachments: %', sqlerrm;
end $$;

-- Keep the public read model current for the newly editable public fields.
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
    coalesce(new.available_remote, false),
    coalesce(new.available_travel, false)
  )
  on conflict (id) do update
    set headline = excluded.headline,
        bio = excluded.bio,
        specializations = excluded.specializations,
        avatar_url = excluded.avatar_url,
        cover_url = excluded.cover_url,
        available_remote = excluded.available_remote,
        available_travel = excluded.available_travel,
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists professional_profiles_sync_directory on public.professional_profiles;
create trigger professional_profiles_sync_directory
after insert or update of headline, bio, specializations, avatar_url, cover_url, available_remote, available_travel
on public.professional_profiles
for each row execute function public.tg_professional_profiles_sync_directory();

-- Review visibility aligned with profile access:
-- - customer: visible professionals or own reviews
-- - professional: own profile or followed professionals
-- - admin: all
drop policy if exists "Reviews: readable by viewers" on public.reviews;
create policy "Reviews: readable by viewers"
on public.reviews
for select
to authenticated
using (
  (select public.is_admin())
  or customer_id = (select auth.uid())
  or professional_id = (select auth.uid())
  or (
    (select public.is_customer())
    and (select public.customer_can_view_professional(professional_id))
  )
  or (
    (select public.is_professional())
    and exists (
      select 1
      from public.professional_follows f
      where f.follower_id = (select auth.uid())
        and f.followed_id = public.reviews.professional_id
    )
  )
);

drop policy if exists "Reviews: professional reply own" on public.reviews;
create policy "Reviews: professional reply own"
on public.reviews
for update
to authenticated
using (
  (select public.is_professional())
  and professional_id = (select auth.uid())
)
with check (
  (select public.is_professional())
  and professional_id = (select auth.uid())
);

create or replace function public.tg_reviews_guard_mutations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid;
begin
  caller := auth.uid();

  if caller is null then
    return new;
  end if;

  if (select public.is_admin()) then
    return new;
  end if;

  if old.id is distinct from new.id then
    raise exception 'reviews.id is immutable';
  end if;
  if old.request_id is distinct from new.request_id then
    raise exception 'reviews.request_id is immutable';
  end if;
  if old.professional_id is distinct from new.professional_id then
    raise exception 'reviews.professional_id is immutable';
  end if;
  if old.customer_id is distinct from new.customer_id then
    raise exception 'reviews.customer_id is immutable';
  end if;
  if old.created_at is distinct from new.created_at then
    raise exception 'reviews.created_at is immutable';
  end if;

  if (select public.is_professional()) then
    if old.rating is distinct from new.rating
      or old.body is distinct from new.body
      or old.updated_at is distinct from new.updated_at then
      raise exception 'professionals can only reply to reviews';
    end if;
    if old.professional_reply is not null
      and old.professional_reply is distinct from new.professional_reply then
      raise exception 'review reply can only be created once';
    end if;
    if old.professional_replied_at is not null
      and old.professional_replied_at is distinct from new.professional_replied_at then
      raise exception 'review reply timestamp can only be created once';
    end if;
    return new;
  end if;

  if (select public.is_customer()) then
    if old.professional_reply is distinct from new.professional_reply
      or old.professional_replied_at is distinct from new.professional_replied_at then
      raise exception 'customers cannot edit professional replies';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists a_reviews_guard_mutations on public.reviews;
create trigger a_reviews_guard_mutations
before update on public.reviews
for each row execute function public.tg_reviews_guard_mutations();

grant select, insert, update, delete on table public.post_attachments to authenticated;

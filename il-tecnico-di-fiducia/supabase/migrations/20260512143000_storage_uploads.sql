-- Storage buckets + RLS policies for uploads
-- Buckets:
-- - public-media  (public read): avatars/covers/post media (non-sensitive)
-- - private-media (private): CVs + contact-request attachments
--
-- Path conventions (DRY: everything starts with uploader uid):
-- - public-media:  <uid>/avatar/<file>, <uid>/cover/<file>, <uid>/posts/<post_id>/<file>
-- - private-media: <uid>/cvs/<file>, <uid>/requests/<request_id>/<file>
--
-- Notes:
-- - No fake data inserted.
-- - service_role bypasses policies; these are for anon/authenticated clients.

-- Ensure helper functions exist for storage policies.
create or replace function public.can_access_request(req_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.contact_requests r
    where r.id = req_id
      and (
        r.customer_id = auth.uid()
        or r.professional_id = auth.uid()
        or (select public.is_admin())
      )
  );
$$;

create or replace function public.can_access_professional_cv(pro_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select public.is_admin())
    or auth.uid() = pro_id
    or exists (
      select 1
      from public.contact_requests r
      where r.professional_id = pro_id
        and r.customer_id = auth.uid()
        and r.status = 'accepted'
    );
$$;

create or replace function public.get_professional_cv_path(pro_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select pp.cv_storage_path
  from public.professional_profiles pp
  where pp.id = pro_id
    and pp.cv_storage_path is not null
    and pp.cv_storage_path <> ''
    and (select public.can_access_professional_cv(pro_id));
$$;

-- Create buckets if they don't exist.
-- NOTE (Hosted Supabase):
-- Some hosted projects prevent running DDL against `storage.objects` from migrations/SQL Editor
-- (e.g. "must be owner of table objects"). In that case, create buckets + policies from:
-- Storage -> Buckets -> (bucket) -> Policies (UI), and keep these helper functions (above).
do $$
begin
  begin
    insert into storage.buckets (id, name, public)
    values ('public-media', 'public-media', true)
    on conflict (id) do nothing;
  exception when others then
    raise notice 'Skipped creating bucket public-media: %', sqlerrm;
  end;

  begin
    insert into storage.buckets (id, name, public)
    values ('private-media', 'private-media', false)
    on conflict (id) do nothing;
  exception when others then
    raise notice 'Skipped creating bucket private-media: %', sqlerrm;
  end;

  begin
    -- Ensure RLS is enabled (Storage defaults to enabled, but keep explicit).
    alter table storage.objects enable row level security;
    alter table storage.objects force row level security;
  exception when others then
    raise notice 'Skipped altering storage.objects RLS: %', sqlerrm;
  end;

  begin
    -- PUBLIC MEDIA
    drop policy if exists "Public media: public read" on storage.objects;
    create policy "Public media: public read"
    on storage.objects
    for select
    to public
    using (bucket_id = 'public-media');
  exception when others then
    raise notice 'Skipped policy Public media: public read: %', sqlerrm;
  end;

  begin
    drop policy if exists "Public media: owner write" on storage.objects;
    create policy "Public media: owner write"
    on storage.objects
    for all
    to authenticated
    using (
      bucket_id = 'public-media'
      and (storage.foldername(name))[1] = (select auth.uid()::text)
    )
    with check (
      bucket_id = 'public-media'
      and (storage.foldername(name))[1] = (select auth.uid()::text)
    );
  exception when others then
    raise notice 'Skipped policy Public media: owner write: %', sqlerrm;
  end;

  begin
    -- PRIVATE MEDIA
    drop policy if exists "Private media: owner read/write" on storage.objects;
    create policy "Private media: owner read/write"
    on storage.objects
    for all
    to authenticated
    using (
      bucket_id = 'private-media'
      and (storage.foldername(name))[1] = (select auth.uid()::text)
    )
    with check (
      bucket_id = 'private-media'
      and (storage.foldername(name))[1] = (select auth.uid()::text)
    );
  exception when others then
    raise notice 'Skipped policy Private media: owner read/write: %', sqlerrm;
  end;

  begin
    drop policy if exists "Private media: request participants read" on storage.objects;
    create policy "Private media: request participants read"
    on storage.objects
    for select
    to authenticated
    using (
      bucket_id = 'private-media'
      and (storage.foldername(name))[2] = 'requests'
      and (select public.can_access_request(((storage.foldername(name))[3])::uuid))
    );
  exception when others then
    raise notice 'Skipped policy Private media: request participants read: %', sqlerrm;
  end;

  begin
    drop policy if exists "Private media: request participants upload" on storage.objects;
    create policy "Private media: request participants upload"
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'private-media'
      and (storage.foldername(name))[1] = (select auth.uid()::text)
      and (storage.foldername(name))[2] = 'requests'
      and (select public.can_access_request(((storage.foldername(name))[3])::uuid))
    );
  exception when others then
    raise notice 'Skipped policy Private media: request participants upload: %', sqlerrm;
  end;

  begin
    drop policy if exists "Private media: cv access" on storage.objects;
    create policy "Private media: cv access"
    on storage.objects
    for select
    to authenticated
    using (
      bucket_id = 'private-media'
      and (storage.foldername(name))[2] = 'cvs'
      and (select public.can_access_professional_cv(((storage.foldername(name))[1])::uuid))
    );
  exception when others then
    raise notice 'Skipped policy Private media: cv access: %', sqlerrm;
  end;
end $$;

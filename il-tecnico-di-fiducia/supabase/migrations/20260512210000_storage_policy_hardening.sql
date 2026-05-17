-- Storage policy hardening (private-media)
-- Goals:
-- - Prevent users from uploading request attachments to requests they are not part of.
-- - Keep CV uploads working (professional manages own CV files only).
-- - Allow users to delete only their own request uploads (no deleting other participant files).
--
-- Notes:
-- - Policies are evaluated permissively (OR) per command; remove broad policies to avoid bypass.

-- NOTE (Hosted Supabase):
-- Some hosted projects prevent running DDL against `storage.objects` from migrations/SQL Editor
-- (e.g. "must be owner of table objects"). In that case, apply these in:
-- Storage -> Buckets -> private-media -> Policies (UI).
do $$
begin
  begin
    -- Remove the overly broad policy that allowed inserting arbitrary objects under <uid>/...
    drop policy if exists "Private media: owner read/write" on storage.objects;
  exception when others then
    raise notice 'Skipped dropping policy Private media: owner read/write: %', sqlerrm;
  end;

  begin
    -- CVs: the owner can manage only their own CV objects.
    drop policy if exists "Private media: owner manage cvs" on storage.objects;
    create policy "Private media: owner manage cvs"
    on storage.objects
    for all
    to authenticated
    using (
      bucket_id = 'private-media'
      and (storage.foldername(name))[1] = (select auth.uid()::text)
      and (storage.foldername(name))[2] = 'cvs'
    )
    with check (
      bucket_id = 'private-media'
      and (storage.foldername(name))[1] = (select auth.uid()::text)
      and (storage.foldername(name))[2] = 'cvs'
    );
  exception when others then
    raise notice 'Skipped policy Private media: owner manage cvs: %', sqlerrm;
  end;

  begin
    -- Request uploads: participants may upload (existing INSERT policy) and may delete only their own files.
    drop policy if exists "Private media: request uploader delete" on storage.objects;
    create policy "Private media: request uploader delete"
    on storage.objects
    for delete
    to authenticated
    using (
      bucket_id = 'private-media'
      and (storage.foldername(name))[1] = (select auth.uid()::text)
      and (storage.foldername(name))[2] = 'requests'
      and (select public.can_access_request(((storage.foldername(name))[3])::uuid))
    );
  exception when others then
    raise notice 'Skipped policy Private media: request uploader delete: %', sqlerrm;
  end;
end $$;

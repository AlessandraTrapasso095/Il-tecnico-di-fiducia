-- Storage hardening: bucket-level restrictions (MIME types + file size)
-- Goal: enforce coarse restrictions server-side even if a client attempts direct uploads.
-- Notes:
-- - Hosted Supabase typically allows updating `storage.buckets` via SQL Editor/migrations.
-- - These settings affect uploads only (existing objects are not modified).

do $$
begin
  if not exists (select 1 from storage.buckets where id in ('public-media', 'private-media')) then
    raise notice 'Buckets not found (public-media/private-media). Skipping bucket restrictions.';
    return;
  end if;

  -- Ensure access model.
  update storage.buckets set public = true where id = 'public-media';
  update storage.buckets set public = false where id = 'private-media';

  -- Restrict MIME types if supported by this Storage version.
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'storage'
      and table_name = 'buckets'
      and column_name = 'allowed_mime_types'
  ) then
    -- Public media: avatars/covers/post media (images only).
    update storage.buckets
    set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
    where id = 'public-media';

    -- Private media: CV PDFs + contact-request attachments (images/videos).
    update storage.buckets
    set allowed_mime_types = array[
      'application/pdf',
      'image/jpeg', 'image/png', 'image/webp',
      'video/mp4', 'video/quicktime'
    ]
    where id = 'private-media';
  else
    raise notice 'storage.buckets.allowed_mime_types column not present; skipping MIME restrictions.';
  end if;

  -- Restrict file sizes if supported.
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'storage'
      and table_name = 'buckets'
      and column_name = 'file_size_limit'
  ) then
    -- 10 MB for public images (avatar/cover; future post images).
    update storage.buckets
    set file_size_limit = 10485760
    where id = 'public-media';

    -- 50 MB for private uploads (matches contact-request attachment spec).
    update storage.buckets
    set file_size_limit = 52428800
    where id = 'private-media';
  else
    raise notice 'storage.buckets.file_size_limit column not present; skipping size limits.';
  end if;
end $$;


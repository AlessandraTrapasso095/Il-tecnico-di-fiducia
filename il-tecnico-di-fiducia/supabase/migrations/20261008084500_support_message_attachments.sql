-- Support ticket attachments.
-- Files remain private in Supabase Storage and are exposed only through
-- server-generated signed URLs after ticket authorization.

create table if not exists public.support_message_attachments (
  id uuid primary key default gen_random_uuid(),

  ticket_id uuid not null
    references public.support_tickets(id)
    on delete cascade,

  support_message_id uuid not null
    references public.support_messages(id)
    on delete cascade,

  uploader_id uuid
    references public.profiles(id)
    on delete set null,

  uploader_role text not null
    check (
      uploader_role in ('customer', 'professional', 'admin', 'guest')
    ),

  bucket_id text not null default 'private-media',

  file_path text not null,

  file_type text not null
    check (file_type in ('image', 'video')),

  mime_type text not null,

  file_name text not null,

  file_size bigint not null
    check (file_size > 0),

  created_at timestamptz not null default now(),

  constraint support_message_attachments_guest_uploader_check
    check (
      (
        uploader_role = 'guest'
        and uploader_id is null
      )
      or
      (
        uploader_role <> 'guest'
        and uploader_id is not null
      )
    ),

  unique (bucket_id, file_path)
);

create index if not exists support_message_attachments_ticket_idx
  on public.support_message_attachments (
    ticket_id,
    created_at
  );

create index if not exists support_message_attachments_message_idx
  on public.support_message_attachments (
    support_message_id,
    created_at
  );

alter table public.support_message_attachments
  enable row level security;

alter table public.support_message_attachments
  force row level security;

-- Guest users never access this table directly.
-- Guest APIs use the service role only after validating the secure ticket token.
revoke all
  on table public.support_message_attachments
  from anon;

-- Also avoid accidental direct authenticated mutations.
-- Support attachment access will be mediated by application API routes.
revoke insert, update, delete
  on table public.support_message_attachments
  from authenticated;

notify pgrst, 'reload schema';

-- Repair chat message schema for hosted databases where the prior chat migration
-- was marked as applied but PostgREST cannot see one or more chat support objects.

alter table public.messages
  add column if not exists read_at timestamptz;

create index if not exists messages_read_receipts_idx
on public.messages (conversation_id, sender_id, read_at);

create table if not exists public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  bucket_id text not null default 'private-media',
  file_path text not null,
  file_type text not null check (file_type in ('image', 'video', 'document')),
  mime_type text,
  file_name text,
  file_size bigint,
  created_at timestamptz not null default now(),
  unique (bucket_id, file_path)
);

create index if not exists message_attachments_message_idx
on public.message_attachments (message_id, created_at);

create index if not exists message_attachments_conversation_idx
on public.message_attachments (conversation_id);

create index if not exists message_attachments_uploader_idx
on public.message_attachments (uploader_id);

alter table public.message_attachments enable row level security;
alter table public.message_attachments force row level security;

drop policy if exists "Message attachments: participants read" on public.message_attachments;
create policy "Message attachments: participants read"
on public.message_attachments
for select
to authenticated
using ((select public.can_access_conversation(conversation_id)));

drop policy if exists "Message attachments: participants insert own" on public.message_attachments;
create policy "Message attachments: participants insert own"
on public.message_attachments
for insert
to authenticated
with check (
  uploader_id = (select auth.uid())
  and (select public.can_access_conversation(conversation_id))
);

drop policy if exists "Message attachments: uploader delete own" on public.message_attachments;
create policy "Message attachments: uploader delete own"
on public.message_attachments
for delete
to authenticated
using (
  uploader_id = (select auth.uid())
  and (select public.can_access_conversation(conversation_id))
);

grant select, insert, delete on table public.message_attachments to authenticated;

create table if not exists public.conversation_active_presence (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  active_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index if not exists conversation_active_presence_user_idx
on public.conversation_active_presence (user_id, active_at desc);

alter table public.conversation_active_presence enable row level security;
alter table public.conversation_active_presence force row level security;

drop policy if exists "Conversation active presence: participant read" on public.conversation_active_presence;
create policy "Conversation active presence: participant read"
on public.conversation_active_presence
for select
to authenticated
using ((select public.can_access_conversation(conversation_id)));

drop policy if exists "Conversation active presence: owner upsert" on public.conversation_active_presence;
create policy "Conversation active presence: owner upsert"
on public.conversation_active_presence
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (select public.can_access_conversation(conversation_id))
);

drop policy if exists "Conversation active presence: owner update" on public.conversation_active_presence;
create policy "Conversation active presence: owner update"
on public.conversation_active_presence
for update
to authenticated
using (
  user_id = (select auth.uid())
  and (select public.can_access_conversation(conversation_id))
)
with check (
  user_id = (select auth.uid())
  and (select public.can_access_conversation(conversation_id))
);

grant select, insert, update on table public.conversation_active_presence to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'message_attachments'
    ) then
      alter publication supabase_realtime add table public.message_attachments;
    end if;
  end if;
end $$;

notify pgrst, 'reload schema';

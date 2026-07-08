-- Idempotent repair for hosted projects where chat attachments migrations were
-- marked/applied inconsistently and PostgREST cannot see message_attachments.

alter table public.messages
  add column if not exists read_at timestamptz;

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

alter table public.message_attachments
  add column if not exists message_id uuid references public.messages(id) on delete cascade,
  add column if not exists conversation_id uuid references public.conversations(id) on delete cascade,
  add column if not exists uploader_id uuid references public.profiles(id) on delete cascade,
  add column if not exists bucket_id text default 'private-media',
  add column if not exists file_path text,
  add column if not exists file_type text,
  add column if not exists mime_type text,
  add column if not exists file_name text,
  add column if not exists file_size bigint,
  add column if not exists created_at timestamptz default now();

create index if not exists message_attachments_message_idx
on public.message_attachments (message_id, created_at);

create index if not exists message_attachments_conversation_idx
on public.message_attachments (conversation_id);

create index if not exists message_attachments_uploader_idx
on public.message_attachments (uploader_id);

create or replace function public.can_read_conversation_messages(conv_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversations c
    where c.id = conv_id
      and (
        (select public.is_admin())
        or (
          (select public.is_professional())
          and c.professional_id = auth.uid()
        )
        or (
          (select public.is_customer())
          and c.customer_id = auth.uid()
          and (select public.professional_is_active_subscriber(c.professional_id))
        )
      )
  );
$$;

create or replace function public.can_insert_conversation_message(
  conv_id uuid,
  sender_uuid uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversations c
    where c.id = conv_id
      and c.status = 'accepted'
      and sender_uuid = auth.uid()
      and (
        c.customer_id = auth.uid()
        or c.professional_id = auth.uid()
      )
      and (select public.professional_is_active_subscriber(c.professional_id))
  );
$$;

alter table public.message_attachments enable row level security;
alter table public.message_attachments force row level security;

drop policy if exists "Message attachments: participants read" on public.message_attachments;
create policy "Message attachments: participants read"
on public.message_attachments
for select
to authenticated
using ((select public.can_read_conversation_messages(conversation_id)));

drop policy if exists "Message attachments: participants insert own" on public.message_attachments;
create policy "Message attachments: participants insert own"
on public.message_attachments
for insert
to authenticated
with check (
  uploader_id = (select auth.uid())
  and (select public.can_insert_conversation_message(conversation_id, uploader_id))
);

drop policy if exists "Message attachments: uploader delete own" on public.message_attachments;
create policy "Message attachments: uploader delete own"
on public.message_attachments
for delete
to authenticated
using (
  uploader_id = (select auth.uid())
  and (select public.can_read_conversation_messages(conversation_id))
);

grant select, insert, delete on table public.message_attachments to authenticated;
grant execute on function public.can_read_conversation_messages(uuid) to authenticated;
grant execute on function public.can_insert_conversation_message(uuid, uuid) to authenticated;

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

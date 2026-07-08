-- Realtime repair for chat, attachments, read receipts, presence and notifications.
-- Idempotent by design: safe for hosted projects with incomplete migration history.

alter table public.messages
  add column if not exists read_at timestamptz;

create index if not exists messages_read_receipts_idx
on public.messages (conversation_id, sender_id, read_at);

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

drop policy if exists "Conversation active presence: owner insert" on public.conversation_active_presence;
create policy "Conversation active presence: owner insert"
on public.conversation_active_presence
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (select public.can_access_conversation(conversation_id))
);

drop policy if exists "Conversation active presence: owner upsert" on public.conversation_active_presence;

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
declare
  realtime_tables text[] := array[
    'messages',
    'message_attachments',
    'conversations',
    'notifications',
    'quotes',
    'conversation_active_presence',
    'user_activity'
  ];
  table_name text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;

  foreach table_name in array realtime_tables loop
    if to_regclass(format('public.%I', table_name)) is not null
       and not exists (
         select 1
         from pg_publication_tables
         where pubname = 'supabase_realtime'
           and schemaname = 'public'
           and tablename = table_name
       ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;

do $$
declare
  has_realtime_messages boolean;
begin
  has_realtime_messages := exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'realtime'
      and c.relname = 'messages'
      and c.relkind = 'r'
  );

  if not has_realtime_messages then
    return;
  end if;

  execute 'alter table realtime.messages enable row level security';
  execute 'alter table realtime.messages force row level security';

  execute 'drop policy if exists "Chat realtime: member can read (permissive)" on realtime.messages';
  execute $sql$
    create policy "Chat realtime: member can read (permissive)"
    on realtime.messages
    as permissive
    for select
    to authenticated
    using (
      realtime.messages.private = true
      and realtime.messages.topic = (select realtime.topic())
      and realtime.messages.extension in ('broadcast', 'presence')
      and (select realtime.topic()) like 'conversation:%'
      and split_part((select realtime.topic()), ':', 2) ~ '^[0-9a-fA-F-]{36}$'
      and (
        select public.can_access_conversation(
          split_part((select realtime.topic()), ':', 2)::uuid
        )
      )
    )
  $sql$;

  execute 'drop policy if exists "Chat realtime: member can read (restrictive)" on realtime.messages';
  execute $sql$
    create policy "Chat realtime: member can read (restrictive)"
    on realtime.messages
    as restrictive
    for select
    to authenticated
    using (
      realtime.messages.private = true
      and realtime.messages.topic = (select realtime.topic())
      and realtime.messages.extension in ('broadcast', 'presence')
      and (select realtime.topic()) like 'conversation:%'
      and split_part((select realtime.topic()), ':', 2) ~ '^[0-9a-fA-F-]{36}$'
      and (
        select public.can_access_conversation(
          split_part((select realtime.topic()), ':', 2)::uuid
        )
      )
    )
  $sql$;

  execute 'drop policy if exists "Chat realtime: member can write (permissive)" on realtime.messages';
  execute $sql$
    create policy "Chat realtime: member can write (permissive)"
    on realtime.messages
    as permissive
    for insert
    to authenticated
    with check (
      realtime.messages.private = true
      and realtime.messages.topic = (select realtime.topic())
      and realtime.messages.extension in ('broadcast', 'presence')
      and (select realtime.topic()) like 'conversation:%'
      and split_part((select realtime.topic()), ':', 2) ~ '^[0-9a-fA-F-]{36}$'
      and (
        select public.can_access_conversation(
          split_part((select realtime.topic()), ':', 2)::uuid
        )
      )
    )
  $sql$;

  execute 'drop policy if exists "Chat realtime: member can write (restrictive)" on realtime.messages';
  execute $sql$
    create policy "Chat realtime: member can write (restrictive)"
    on realtime.messages
    as restrictive
    for insert
    to authenticated
    with check (
      realtime.messages.private = true
      and realtime.messages.topic = (select realtime.topic())
      and realtime.messages.extension in ('broadcast', 'presence')
      and (select realtime.topic()) like 'conversation:%'
      and split_part((select realtime.topic()), ':', 2) ~ '^[0-9a-fA-F-]{36}$'
      and (
        select public.can_access_conversation(
          split_part((select realtime.topic()), ':', 2)::uuid
        )
      )
    )
  $sql$;
end $$;

notify pgrst, 'reload schema';

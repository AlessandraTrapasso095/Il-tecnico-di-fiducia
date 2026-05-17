-- Realtime Authorization (Broadcast + Presence) for chat
-- Goal:
-- - Support secure "online" and "typing" indicators over private Realtime channels.
--
-- Channel topic convention:
-- - conversation:<conversation_id>

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
    -- Realtime is not installed (or not available in this environment).
    return;
  end if;

  execute 'alter table realtime.messages enable row level security';
  execute 'alter table realtime.messages force row level security';

  -- Require a private channel topic of the form: conversation:<uuid>
  -- We implement both PERMISSIVE and RESTRICTIVE policies so that:
  -- - Access works even if there were no existing permissive policies.
  -- - Access is still constrained even if other permissive policies exist.

  execute $sql$
    drop policy if exists "Chat realtime: member can read (permissive)" on realtime.messages;
  $sql$;
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
    );
  $sql$;

  execute $sql$
    drop policy if exists "Chat realtime: member can read (restrictive)" on realtime.messages;
  $sql$;
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
    );
  $sql$;

  execute $sql$
    drop policy if exists "Chat realtime: member can write (permissive)" on realtime.messages;
  $sql$;
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
    );
  $sql$;

  execute $sql$
    drop policy if exists "Chat realtime: member can write (restrictive)" on realtime.messages;
  $sql$;
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
    );
  $sql$;
end $$;


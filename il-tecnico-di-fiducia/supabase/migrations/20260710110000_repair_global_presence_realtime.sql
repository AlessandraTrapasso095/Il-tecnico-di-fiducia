-- Allow one authenticated global presence channel for app-wide online/offline state.
-- The chat only uses private per-conversation broadcast channels for typing indicators.

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

  execute 'drop policy if exists "Global presence: authenticated read (permissive)" on realtime.messages';
  execute $sql$
    create policy "Global presence: authenticated read (permissive)"
    on realtime.messages
    as permissive
    for select
    to authenticated
    using (
      realtime.messages.topic = 'presence:authenticated-users'
      and realtime.messages.extension in ('presence', 'broadcast')
    )
  $sql$;

  execute 'drop policy if exists "Global presence: authenticated write (permissive)" on realtime.messages';
  execute $sql$
    create policy "Global presence: authenticated write (permissive)"
    on realtime.messages
    as permissive
    for insert
    to authenticated
    with check (
      realtime.messages.topic = 'presence:authenticated-users'
      and realtime.messages.extension in ('presence', 'broadcast')
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
      (
        realtime.messages.topic = 'presence:authenticated-users'
        and realtime.messages.extension in ('presence', 'broadcast')
      )
      or (
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
      (
        realtime.messages.topic = 'presence:authenticated-users'
        and realtime.messages.extension in ('presence', 'broadcast')
      )
      or (
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
    )
  $sql$;
end $$;

select pg_notify('pgrst', 'reload schema');

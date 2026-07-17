create table if not exists public.conversation_active_presence (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  active_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

alter table public.conversation_active_presence enable row level security;
alter table public.conversation_active_presence force row level security;

drop policy if exists "Conversation active presence: owner delete" on public.conversation_active_presence;
create policy "Conversation active presence: owner delete"
on public.conversation_active_presence
for delete
to authenticated
using (user_id = (select auth.uid()));

grant select, insert, update, delete on table public.conversation_active_presence to authenticated;

select pg_notify('pgrst', 'reload schema');

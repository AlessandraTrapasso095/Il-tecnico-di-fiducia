-- Conversation user state (per-user hide/delete for chats)
-- Goal:
-- - Allow each participant to "delete" a chat from their own UI without deleting the underlying request.
-- - Preserve audit/history for the other participant and for admin.

create table if not exists public.conversation_user_state (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index if not exists conversation_user_state_user_hidden_idx
on public.conversation_user_state (user_id)
where hidden_at is not null;

alter table public.conversation_user_state enable row level security;
alter table public.conversation_user_state force row level security;

-- Policies: user can manage their own state only (and must not be banned).
drop policy if exists "Conversation user state: self read" on public.conversation_user_state;
create policy "Conversation user state: self read"
on public.conversation_user_state
for select
to authenticated
using (
  user_id = (select auth.uid())
  and (select public.is_active_user())
  and (select public.can_access_conversation(conversation_id))
);

drop policy if exists "Conversation user state: self insert" on public.conversation_user_state;
create policy "Conversation user state: self insert"
on public.conversation_user_state
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (select public.is_active_user())
  and (select public.can_access_conversation(conversation_id))
);

drop policy if exists "Conversation user state: self update" on public.conversation_user_state;
create policy "Conversation user state: self update"
on public.conversation_user_state
for update
to authenticated
using (
  user_id = (select auth.uid())
  and (select public.is_active_user())
  and (select public.can_access_conversation(conversation_id))
)
with check (
  user_id = (select auth.uid())
  and (select public.is_active_user())
  and (select public.can_access_conversation(conversation_id))
);

-- Keep updated_at fresh
drop trigger if exists set_conversation_user_state_updated_at on public.conversation_user_state;
create trigger set_conversation_user_state_updated_at
before update on public.conversation_user_state
for each row execute function public.tg_set_updated_at();

-- Explicit grants
grant select, insert, update on table public.conversation_user_state to authenticated;

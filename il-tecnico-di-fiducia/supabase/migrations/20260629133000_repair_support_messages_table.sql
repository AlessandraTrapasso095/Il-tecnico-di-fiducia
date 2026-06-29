-- Repair migration for hosted databases where the historical support_messages
-- migration was marked as applied but the table is missing or incomplete.

alter type public.ticket_status add value if not exists 'waiting';

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  sender_role text not null check (sender_role in ('customer', 'professional', 'admin')),
  body text not null,
  created_at timestamptz not null default now(),
  constraint support_messages_body_not_empty check (length(btrim(body)) > 0)
);

alter table public.support_messages
  add column if not exists sender_role text;

update public.support_messages sm
set sender_role = p.role::text
from public.profiles p
where sm.sender_id = p.id
  and sm.sender_role is null;

update public.support_messages
set sender_role = 'admin'
where sender_role is null;

alter table public.support_messages
  alter column sender_role set not null;

alter table public.support_messages
  drop constraint if exists support_messages_sender_role_check;

alter table public.support_messages
  add constraint support_messages_sender_role_check
  check (sender_role in ('customer', 'professional', 'admin'));

alter table public.support_messages
  alter column sender_id drop not null;

alter table public.support_messages
  drop constraint if exists support_messages_sender_id_fkey;

alter table public.support_messages
  add constraint support_messages_sender_id_fkey
  foreign key (sender_id) references auth.users(id) on delete set null;

create index if not exists support_messages_ticket_id_idx
  on public.support_messages (ticket_id);

create index if not exists support_messages_sender_id_idx
  on public.support_messages (sender_id);

create index if not exists support_messages_created_at_idx
  on public.support_messages (created_at);

create index if not exists support_messages_ticket_created_at_idx
  on public.support_messages (ticket_id, created_at);

alter table public.support_messages enable row level security;
alter table public.support_messages force row level security;

drop policy if exists "Support messages: admin read all" on public.support_messages;
create policy "Support messages: admin read all"
on public.support_messages
for select
to authenticated
using ((select public.is_admin()));

drop policy if exists "Support messages: author read own tickets" on public.support_messages;
create policy "Support messages: author read own tickets"
on public.support_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.support_tickets t
    where t.id = support_messages.ticket_id
      and t.author_id = (select auth.uid())
  )
);

drop policy if exists "Support messages: admin insert replies" on public.support_messages;
create policy "Support messages: admin insert replies"
on public.support_messages
for insert
to authenticated
with check (
  (select public.is_admin())
  and sender_id = (select auth.uid())
  and sender_role = 'admin'
);

drop policy if exists "Support messages: author insert own tickets" on public.support_messages;
create policy "Support messages: author insert own tickets"
on public.support_messages
for insert
to authenticated
with check (
  sender_id = (select auth.uid())
  and sender_role in ('customer', 'professional')
  and exists (
    select 1
    from public.support_tickets t
    where t.id = support_messages.ticket_id
      and t.author_id = (select auth.uid())
      and t.status <> 'closed'
  )
);

drop policy if exists "Support messages: participants read" on public.support_messages;
drop policy if exists "Support messages: participants insert" on public.support_messages;

grant select, insert on table public.support_messages to authenticated;

-- Keep ticket mutation guards compatible with the support workflow:
-- admins can manage status, non-admin users cannot change immutable identity fields.
create or replace function public.tg_support_tickets_guard_mutations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid;
begin
  caller := auth.uid();

  if caller is null then
    return new;
  end if;

  if (select public.is_admin()) then
    return new;
  end if;

  if old.id is distinct from new.id then
    raise exception 'support_tickets.id is immutable';
  end if;

  if old.author_id is distinct from new.author_id then
    raise exception 'support_tickets.author_id is immutable';
  end if;

  if old.created_at is distinct from new.created_at then
    raise exception 'support_tickets.created_at is immutable';
  end if;

  return new;
end;
$$;

drop trigger if exists a_support_tickets_guard_mutations on public.support_tickets;
create trigger a_support_tickets_guard_mutations
before update on public.support_tickets
for each row execute function public.tg_support_tickets_guard_mutations();

notify pgrst, 'reload schema';

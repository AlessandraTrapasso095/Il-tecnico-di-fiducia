create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_actor_idx on public.audit_logs (actor_id);
create index if not exists audit_logs_target_idx on public.audit_logs (target_type, target_id);
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);

alter table public.audit_logs enable row level security;
alter table public.audit_logs force row level security;

drop policy if exists "Audit logs: admin read" on public.audit_logs;
create policy "Audit logs: admin read"
on public.audit_logs
for select
to authenticated
using ((select public.is_admin()));

drop policy if exists "Audit logs: admin insert" on public.audit_logs;
create policy "Audit logs: admin insert"
on public.audit_logs
for insert
to authenticated
with check ((select public.is_admin()) and actor_id = auth.uid());

grant select, insert on table public.audit_logs to authenticated;

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint support_messages_body_not_empty check (length(btrim(body)) > 0)
);

create index if not exists support_messages_ticket_idx on public.support_messages (ticket_id, created_at);
create index if not exists support_messages_sender_idx on public.support_messages (sender_id);

alter table public.support_messages enable row level security;
alter table public.support_messages force row level security;

drop policy if exists "Support messages: participants read" on public.support_messages;
create policy "Support messages: participants read"
on public.support_messages
for select
to authenticated
using (
  (select public.is_admin())
  or sender_id = auth.uid()
  or exists (
    select 1
    from public.support_tickets t
    where t.id = support_messages.ticket_id
      and t.author_id = auth.uid()
  )
);

drop policy if exists "Support messages: participants insert" on public.support_messages;
create policy "Support messages: participants insert"
on public.support_messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and (
    (select public.is_admin())
    or exists (
      select 1
      from public.support_tickets t
      where t.id = support_messages.ticket_id
        and t.author_id = auth.uid()
        and t.status = 'open'
    )
  )
);

grant select, insert on table public.support_messages to authenticated;

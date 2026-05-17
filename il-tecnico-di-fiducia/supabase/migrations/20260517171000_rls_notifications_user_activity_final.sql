-- RLS audit: notifications + user activity (presence) final hardening
-- Goals:
-- - Notifications: readable/updatable only by recipient (active) + admin read.
-- - User activity: least privilege (no DELETE), active users only; admin can read all.
-- - Keep this safe to run even if prior migrations were applied out of order.

-- NOTIFICATIONS
drop policy if exists "Notifications: recipient read own" on public.notifications;
create policy "Notifications: recipient read own"
on public.notifications
for select
to authenticated
using (
  recipient_id = (select auth.uid())
  and (select public.is_active_user())
);

drop policy if exists "Notifications: recipient update own" on public.notifications;
create policy "Notifications: recipient update own"
on public.notifications
for update
to authenticated
using (
  recipient_id = (select auth.uid())
  and (select public.is_active_user())
)
with check (
  recipient_id = (select auth.uid())
  and (select public.is_active_user())
);

drop policy if exists "Notifications: admin read" on public.notifications;
create policy "Notifications: admin read"
on public.notifications
for select
to authenticated
using ((select public.is_admin()));

-- USER ACTIVITY (presence)
create table if not exists public.user_activity (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  last_seen_at timestamptz not null default now()
);

alter table public.user_activity enable row level security;
alter table public.user_activity force row level security;

drop policy if exists "User activity: self read" on public.user_activity;
create policy "User activity: self read"
on public.user_activity
for select
to authenticated
using (
  user_id = (select auth.uid())
  and (select public.is_active_user())
);

-- Remove any overly broad self upsert policy if it exists.
drop policy if exists "User activity: self upsert" on public.user_activity;

drop policy if exists "User activity: self insert" on public.user_activity;
create policy "User activity: self insert"
on public.user_activity
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (select public.is_active_user())
);

drop policy if exists "User activity: self update" on public.user_activity;
create policy "User activity: self update"
on public.user_activity
for update
to authenticated
using (
  user_id = (select auth.uid())
  and (select public.is_active_user())
)
with check (
  user_id = (select auth.uid())
  and (select public.is_active_user())
);

drop policy if exists "User activity: admin read" on public.user_activity;
create policy "User activity: admin read"
on public.user_activity
for select
to authenticated
using ((select public.is_admin()));

-- Explicit GRANTs (future-proof projects where auto-grants are disabled).
grant select, insert, update on table public.user_activity to authenticated;

-- Presence touch should not be callable by anon.
revoke execute on function public.touch_user_activity() from public, anon;
grant execute on function public.touch_user_activity() to authenticated;


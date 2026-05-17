-- RLS hardening: notifications must not be readable/mutable by banned users
-- Rationale:
-- - App routes already sign out banned users, but JWTs can still be used directly against PostgREST.
-- - Keep DB as the source of truth: banned users get no access to private app data.

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


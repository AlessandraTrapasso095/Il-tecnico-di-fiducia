-- RLS final audit hardening
-- Goals:
-- - Ensure banned users cannot read or mutate any private app data.
-- - Remove overly-broad "FOR ALL" policies where not needed (least privilege).
-- - Keep explicit GRANTs aligned with newly-added tables (future-proof).

-- PROFESSIONAL SUBSCRIPTIONS: professional can read own only while active (not banned).
drop policy if exists "Subscriptions: pro read own" on public.professional_subscriptions;
create policy "Subscriptions: pro read own"
on public.professional_subscriptions
for select
to authenticated
using (
  (select auth.uid()) = professional_id
  and (select public.is_professional())
);

-- SAVED PROFESSIONALS: customer can read/delete own only while active.
drop policy if exists "Saved professionals: customer read own" on public.saved_professionals;
create policy "Saved professionals: customer read own"
on public.saved_professionals
for select
to authenticated
using (
  (select public.is_customer())
  and customer_id = (select auth.uid())
);

drop policy if exists "Saved professionals: customer delete own" on public.saved_professionals;
create policy "Saved professionals: customer delete own"
on public.saved_professionals
for delete
to authenticated
using (
  (select public.is_customer())
  and customer_id = (select auth.uid())
);

-- CUSTOMER DIRECTORY: customer can read own only while active (not banned).
drop policy if exists "Customer directory: self read" on public.customer_directory;
create policy "Customer directory: self read"
on public.customer_directory
for select
to authenticated
using (
  id = (select auth.uid())
  and (select public.is_active_user())
);

-- SUPPORT TICKETS: author can read own only while active (not banned).
drop policy if exists "Tickets: author read own" on public.support_tickets;
create policy "Tickets: author read own"
on public.support_tickets
for select
to authenticated
using (
  author_id = (select auth.uid())
  and (select public.is_active_user())
);

-- USER ACTIVITY: only active users can read/write their own last_seen.
-- Replace the overly broad "FOR ALL" policy with INSERT + UPDATE only (no DELETE).
drop policy if exists "User activity: self read" on public.user_activity;
create policy "User activity: self read"
on public.user_activity
for select
to authenticated
using (
  user_id = (select auth.uid())
  and (select public.is_active_user())
);

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

-- Explicit GRANTs (future-proof projects where auto-grants are disabled).
grant select, insert, update on table public.user_activity to authenticated;

-- Lock down execution: presence touch should not be callable by anon.
revoke execute on function public.touch_user_activity() from public, anon;
grant execute on function public.touch_user_activity() to authenticated;

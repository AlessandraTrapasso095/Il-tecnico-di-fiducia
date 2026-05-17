-- RLS fix: allow admins to upsert professional_subscriptions
-- Context:
-- - The admin endpoint uses `upsert(..., { onConflict: "professional_id" })`.
-- - Postgres checks INSERT policies even when an UPSERT hits a conflict and turns into UPDATE.
-- - Without an INSERT policy for admins, the statement fails with:
--   "new row violates row-level security policy for table professional_subscriptions".

drop policy if exists "Subscriptions: admin insert" on public.professional_subscriptions;
create policy "Subscriptions: admin insert"
on public.professional_subscriptions
for insert
to authenticated
with check ((select public.is_admin()));


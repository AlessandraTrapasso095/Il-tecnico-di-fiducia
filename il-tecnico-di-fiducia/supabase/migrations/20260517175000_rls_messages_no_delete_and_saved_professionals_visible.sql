-- RLS hardening:
-- - Messages: disallow physical DELETE via Data API (chat "deletion" is a per-user hide via conversation_user_state).
-- - Saved professionals: allow bookmark only if the customer can view the professional (active OR already interacted).

-- 1) Messages: remove DELETE policy (no physical deletes from clients/admin panel)
drop policy if exists "Messages: sender delete own" on public.messages;

-- 2) Saved professionals: customers can bookmark professionals they can view
drop policy if exists "Saved professionals: customer insert own" on public.saved_professionals;
create policy "Saved professionals: customer insert own"
on public.saved_professionals
for insert
to authenticated
with check (
  (select public.is_customer())
  and customer_id = (select auth.uid())
  and (select public.customer_can_view_professional(professional_id))
);

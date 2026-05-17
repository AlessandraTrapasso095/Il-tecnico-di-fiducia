-- RLS audit: harden reviews, support tickets, and professional follows
-- Goals:
-- - Avoid overly-permissive SELECT policies (e.g. reviews visible to everyone).
-- - Prevent non-admin tampering with immutable relationship fields (reviews) and ticket lifecycle (status).
-- - Keep logic DRY via existing helper functions (is_admin/is_customer/is_professional/customer_can_view_professional).

-- REVIEWS
-- 1) Only allow reading reviews when they are relevant to the viewer.
--    - Admins: all
--    - Professionals: can view reviews about any professional (profile view parity with customers)
--    - Customers: only for professionals they can view (active subscribers OR prior interaction)
--    - Authors: always see their own review rows
drop policy if exists "Reviews: readable by authenticated" on public.reviews;
drop policy if exists "Reviews: admin read" on public.reviews;
drop policy if exists "Reviews: professional read own" on public.reviews;
drop policy if exists "Reviews: customer read own or visible pros" on public.reviews;
drop policy if exists "Reviews: readable by viewers" on public.reviews;
create policy "Reviews: readable by viewers"
on public.reviews
for select
to authenticated
using (
  (select public.is_admin())
  or (select public.is_professional())
  or (
    (select public.is_customer())
    and (select public.customer_can_view_professional(professional_id))
  )
  or customer_id = (select auth.uid())
);

-- 2) Guard immutable relationship fields on UPDATE (defense-in-depth against direct PostgREST updates).
create or replace function public.tg_reviews_guard_mutations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid;
begin
  caller := auth.uid();

  -- System/trigger-originated updates (no JWT context) should not be blocked.
  if caller is null then
    return new;
  end if;

  -- Admins are allowed to manage all review fields (moderation).
  if (select public.is_admin()) then
    return new;
  end if;

  -- Immutable relationship/identity fields.
  if old.id is distinct from new.id then
    raise exception 'reviews.id is immutable';
  end if;
  if old.request_id is distinct from new.request_id then
    raise exception 'reviews.request_id is immutable';
  end if;
  if old.professional_id is distinct from new.professional_id then
    raise exception 'reviews.professional_id is immutable';
  end if;
  if old.customer_id is distinct from new.customer_id then
    raise exception 'reviews.customer_id is immutable';
  end if;
  if old.created_at is distinct from new.created_at then
    raise exception 'reviews.created_at is immutable';
  end if;

  return new;
end;
$$;

drop trigger if exists a_reviews_guard_mutations on public.reviews;
create trigger a_reviews_guard_mutations
before update on public.reviews
for each row execute function public.tg_reviews_guard_mutations();

-- SUPPORT TICKETS
-- Author may only edit tickets while they are open, and cannot close them (admin handles lifecycle).
drop policy if exists "Tickets: author update own" on public.support_tickets;
create policy "Tickets: author update own (open only)"
on public.support_tickets
for update
to authenticated
using (
  author_id = (select auth.uid())
  and status = 'open'
  and (select public.is_active_user())
)
with check (
  author_id = (select auth.uid())
  and status = 'open'
  and (select public.is_active_user())
);

-- PROFESSIONAL FOLLOWS
-- Restrict reading the social graph to only relationships involving the current professional.
drop policy if exists "Follows: pro read" on public.professional_follows;
create policy "Follows: pro read own graph"
on public.professional_follows
for select
to authenticated
using (
  (select public.is_admin())
  or (
    (select public.is_professional())
    and (follower_id = (select auth.uid()) or followed_id = (select auth.uid()))
  )
);

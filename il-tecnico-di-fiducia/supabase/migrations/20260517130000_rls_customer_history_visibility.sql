-- RLS audit: customer "history" visibility
-- Goal:
-- - If a customer already interacted with a professional (contact request / chat),
--   they must keep seeing that professional in their UI even if the subscription
--   becomes inactive later.
-- - Keep browsing rules unchanged: customers can discover/search only active subscribers.
--
-- This is intentionally narrow: it unlocks visibility only when there is an existing
-- `contact_requests` row linking the customer to the professional.

-- Helper: can the current customer view a professional's public directory info?
create or replace function public.customer_can_view_professional(pro_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select public.is_customer())
    and (
      (select public.professional_is_active_subscriber(pro_id))
      or exists (
        select 1
        from public.contact_requests r
        where r.customer_id = auth.uid()
          and r.professional_id = pro_id
      )
    );
$$;

-- Posts visibility: extend customer access to professionals they've already contacted.
create or replace function public.can_view_professional_posts(pro_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select public.is_admin())
    or (select public.customer_can_view_professional(pro_id))
    or (
      (select public.is_professional())
      and (
        auth.uid() = pro_id
        or exists (
          select 1
          from public.professional_follows f
          where f.follower_id = auth.uid()
            and f.followed_id = pro_id
        )
      )
    );
$$;

-- Professional directory: customers can read (active OR already interacted).
drop policy if exists "Professional directory: customers read active only" on public.professional_directory;
drop policy if exists "Professional directory: customers read visible" on public.professional_directory;
create policy "Professional directory: customers read visible"
on public.professional_directory
for select
to authenticated
using ((select public.customer_can_view_professional(public.professional_directory.id)));

-- Professional categories: customers can read only for professionals they can view.
drop policy if exists "Professional categories: readable by customers (active only)" on public.professional_categories;
drop policy if exists "Professional categories: readable by customers (visible pros)" on public.professional_categories;
create policy "Professional categories: readable by customers (visible pros)"
on public.professional_categories
for select
to authenticated
using ((select public.customer_can_view_professional(professional_id)));


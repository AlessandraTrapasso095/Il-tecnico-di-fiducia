-- Professional profile posts are visible to professional viewers
-- independently from follow state.
--
-- Following remains a social/feed preference only.
--
-- Customer visibility rules remain unchanged:
-- customers may view posts only for professionals they are allowed
-- to see through customer_can_view_professional().
--
-- Admin visibility remains unchanged.
--
-- can_view_post() is intentionally preserved because it delegates
-- visibility to can_view_professional_posts(), so likes/comments
-- inherit the same corrected access rule.

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
    or (select public.is_professional());
$$;

revoke all on function public.can_view_professional_posts(uuid) from public;
grant execute on function public.can_view_professional_posts(uuid) to authenticated;
grant execute on function public.can_view_professional_posts(uuid) to service_role;

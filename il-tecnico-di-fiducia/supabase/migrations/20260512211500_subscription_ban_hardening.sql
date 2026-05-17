-- Subscription visibility hardening
-- Goal:
-- - A banned professional must never be treated as "active" for directory/post visibility,
--   even if a subscription row still exists.

create or replace function public.professional_is_active_subscriber(pro_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.professional_subscriptions s
    join public.profiles p on p.id = s.professional_id
    where s.professional_id = pro_id
      and p.is_banned = false
      and s.status in ('stripe_active', 'admin_forced_active')
      and (s.current_period_end is null or s.current_period_end > now())
  );
$$;


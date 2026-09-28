-- Stripe production hardening.
--
-- Goals:
-- - Prevent stale/out-of-order Stripe subscription events from overwriting
--   a newer subscription state.
-- - Accept distinct Stripe events created in the same second, because
--   Stripe event.created has second-level precision.
-- - Keep the Stripe event that last changed a subscription.
-- - Prevent the same Stripe subscription/customer from being attached to
--   multiple professional rows.
--
-- No seed/demo data.

alter table public.professional_subscriptions
  add column if not exists stripe_last_event_id text,
  add column if not exists stripe_last_event_created bigint;

create unique index if not exists professional_subscriptions_stripe_subscription_uidx
  on public.professional_subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

create unique index if not exists professional_subscriptions_stripe_customer_uidx
  on public.professional_subscriptions (stripe_customer_id)
  where stripe_customer_id is not null;

create index if not exists professional_subscriptions_stripe_event_created_idx
  on public.professional_subscriptions (stripe_last_event_created)
  where stripe_last_event_created is not null;

create or replace function public.apply_stripe_subscription_event(
  target_professional_id uuid,
  target_status public.subscription_status,
  target_stripe_customer_id text,
  target_stripe_subscription_id text,
  target_current_period_end timestamptz,
  target_stripe_event_id text,
  target_stripe_event_created bigint
)
returns table (
  applied boolean,
  professional_id uuid,
  status public.subscription_status,
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  stripe_last_event_id text,
  stripe_last_event_created bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer := 0;
begin
  if target_professional_id is null then
    raise exception 'target_professional_id is required';
  end if;

  if target_stripe_event_id is null or btrim(target_stripe_event_id) = '' then
    raise exception 'target_stripe_event_id is required';
  end if;

  if target_stripe_event_created is null or target_stripe_event_created <= 0 then
    raise exception 'target_stripe_event_created must be positive';
  end if;

  insert into public.professional_subscriptions (
    professional_id,
    status,
    stripe_customer_id,
    stripe_subscription_id,
    current_period_end,
    stripe_last_event_id,
    stripe_last_event_created
  )
  values (
    target_professional_id,
    target_status,
    target_stripe_customer_id,
    target_stripe_subscription_id,
    target_current_period_end,
    target_stripe_event_id,
    target_stripe_event_created
  )
  on conflict (professional_id) do update
  set
    status = excluded.status,
    stripe_customer_id = excluded.stripe_customer_id,
    stripe_subscription_id = excluded.stripe_subscription_id,
    current_period_end = excluded.current_period_end,
    stripe_last_event_id = excluded.stripe_last_event_id,
    stripe_last_event_created = excluded.stripe_last_event_created
  where
    public.professional_subscriptions.stripe_last_event_created is null
    or excluded.stripe_last_event_created >
      public.professional_subscriptions.stripe_last_event_created
    or (
      excluded.stripe_last_event_created =
        public.professional_subscriptions.stripe_last_event_created
      and excluded.stripe_last_event_id is distinct from
        public.professional_subscriptions.stripe_last_event_id
    );

  get diagnostics affected = row_count;

  return query
  select
    affected > 0,
    s.professional_id,
    s.status,
    s.stripe_customer_id,
    s.stripe_subscription_id,
    s.current_period_end,
    s.stripe_last_event_id,
    s.stripe_last_event_created
  from public.professional_subscriptions s
  where s.professional_id = target_professional_id;
end;
$$;

revoke all on function public.apply_stripe_subscription_event(
  uuid,
  public.subscription_status,
  text,
  text,
  timestamptz,
  text,
  bigint
) from public, anon, authenticated;

grant execute on function public.apply_stripe_subscription_event(
  uuid,
  public.subscription_status,
  text,
  text,
  timestamptz,
  text,
  bigint
) to service_role;

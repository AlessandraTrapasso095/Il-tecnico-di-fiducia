-- Subscription + Realtime hardening
-- Goals:
-- - Treat expired Stripe periods as not active for directory visibility.
-- - Keep subscription timestamps updated.
-- - Ensure realtime works out-of-the-box for chat and notifications by adding tables to publication.

-- 1) Subscription: active means (status is active) AND (period not expired, if known)
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
    where s.professional_id = pro_id
      and s.status in ('stripe_active', 'admin_forced_active')
      and (s.current_period_end is null or s.current_period_end > now())
  );
$$;

-- 2) Keep updated_at fresh for subscription rows
drop trigger if exists set_professional_subscriptions_updated_at on public.professional_subscriptions;
create trigger set_professional_subscriptions_updated_at
before update on public.professional_subscriptions
for each row execute function public.tg_set_updated_at();

-- 3) Realtime publication: add tables if publication exists and they're not yet included
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
    ) then
      alter publication supabase_realtime add table public.messages;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversations'
    ) then
      alter publication supabase_realtime add table public.conversations;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
    ) then
      alter publication supabase_realtime add table public.notifications;
    end if;
  end if;
end $$;


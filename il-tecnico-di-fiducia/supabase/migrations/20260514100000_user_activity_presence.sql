-- User activity / presence (for admin "online/offline" indicators)
-- Goal:
-- - Track lightweight last_seen_at for each user without mutating profiles.updated_at.
-- - Keep this safe: users can only touch their own row; admins can read all.

create table if not exists public.user_activity (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  last_seen_at timestamptz not null default now()
);

alter table public.user_activity enable row level security;
alter table public.user_activity force row level security;

drop policy if exists "User activity: self read" on public.user_activity;
create policy "User activity: self read"
on public.user_activity
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "User activity: self upsert" on public.user_activity;
create policy "User activity: self upsert"
on public.user_activity
for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "User activity: admin read" on public.user_activity;
create policy "User activity: admin read"
on public.user_activity
for select
to authenticated
using ((select public.is_admin()));

-- Keep updates low: only update if older than 30s.
create or replace function public.touch_user_activity()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  if not (select public.is_active_user()) then
    return;
  end if;

  insert into public.user_activity (user_id, last_seen_at)
  values (auth.uid(), now())
  on conflict (user_id) do update
    set last_seen_at = excluded.last_seen_at
    where public.user_activity.last_seen_at < now() - interval '30 seconds';
end;
$$;


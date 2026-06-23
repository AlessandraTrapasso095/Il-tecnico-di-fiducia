create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  new_requests boolean not null default true,
  messages boolean not null default true,
  reviews boolean not null default true,
  email boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;
alter table public.notification_preferences force row level security;

drop trigger if exists set_notification_preferences_updated_at on public.notification_preferences;
create trigger set_notification_preferences_updated_at
before update on public.notification_preferences
for each row execute function public.set_updated_at();

drop policy if exists "Notification preferences: owner read" on public.notification_preferences;
create policy "Notification preferences: owner read"
on public.notification_preferences
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Notification preferences: owner insert" on public.notification_preferences;
create policy "Notification preferences: owner insert"
on public.notification_preferences
for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "Notification preferences: owner update" on public.notification_preferences;
create policy "Notification preferences: owner update"
on public.notification_preferences
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Notification preferences: admin read" on public.notification_preferences;
create policy "Notification preferences: admin read"
on public.notification_preferences
for select
to authenticated
using ((select public.is_admin()));

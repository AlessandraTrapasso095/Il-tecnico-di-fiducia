-- Initial schema for "Il Tecnico di Fiducia"
-- Notes:
-- - No fake data (no seeded users/professionals/reviews).
-- - Designed for Supabase Postgres with RLS enabled.

-- Extensions
create extension if not exists "pgcrypto";

-- Types
do $$ begin
  create type public.user_role as enum ('customer', 'professional', 'admin');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.subscription_status as enum (
    'none',
    'stripe_active',
    'admin_forced_active',
    'suspended'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.request_status as enum ('pending', 'accepted', 'rejected');
exception
  when duplicate_object then null;
end $$;

-- Lookup: Italian provinces (sigle)
create table if not exists public.provinces (
  code text primary key,
  name text not null
);

alter table public.provinces enable row level security;
alter table public.provinces force row level security;

-- Public read (needed for signup dropdowns)
drop policy if exists "Provinces are readable" on public.provinces;
create policy "Provinces are readable"
on public.provinces
for select
to anon, authenticated
using (true);

-- Core user profile (1:1 with auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null,
  email text not null,
  first_name text not null default '',
  last_name text not null default '',
  province_code text references public.provinces(code),
  phone text,
  must_change_password boolean not null default false,
  is_banned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_email_unique on public.profiles (email);
create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_province_idx on public.profiles (province_code);

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

-- Professional details (separate table to keep profiles lean)
create table if not exists public.professional_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  headline text,
  bio text,
  specializations text[] not null default '{}',
  avatar_url text,
  cover_url text,
  cv_storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.professional_profiles enable row level security;
alter table public.professional_profiles force row level security;

-- Subscription state (Stripe + admin override)
create table if not exists public.professional_subscriptions (
  professional_id uuid primary key references public.professional_profiles(id) on delete cascade,
  status public.subscription_status not null default 'none',
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists professional_subscriptions_status_idx on public.professional_subscriptions (status);

alter table public.professional_subscriptions enable row level security;
alter table public.professional_subscriptions force row level security;

-- Follow relationship between professionals
create table if not exists public.professional_follows (
  follower_id uuid not null references public.professional_profiles(id) on delete cascade,
  followed_id uuid not null references public.professional_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  constraint professional_follows_no_self_follow check (follower_id <> followed_id)
);

create index if not exists professional_follows_followed_idx on public.professional_follows (followed_id);

alter table public.professional_follows enable row level security;
alter table public.professional_follows force row level security;

-- Contact requests (Customer -> Professional)
create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  subject text not null,
  message text not null,
  privacy_accepted boolean not null default false,
  status public.request_status not null default 'pending',
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contact_requests_privacy_required check (privacy_accepted = true)
);

create index if not exists contact_requests_customer_idx on public.contact_requests (customer_id);
create index if not exists contact_requests_professional_idx on public.contact_requests (professional_id);
create index if not exists contact_requests_status_idx on public.contact_requests (status);

alter table public.contact_requests enable row level security;
alter table public.contact_requests force row level security;

-- Chat (one conversation per request)
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.contact_requests(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  status public.request_status not null default 'pending',
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversations_customer_idx on public.conversations (customer_id);
create index if not exists conversations_professional_idx on public.conversations (professional_id);
create index if not exists conversations_status_idx on public.conversations (status);

alter table public.conversations enable row level security;
alter table public.conversations force row level security;

-- Messages
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text,
  created_at timestamptz not null default now(),
  constraint messages_body_or_attachment check (body is not null and length(trim(body)) > 0)
);

create index if not exists messages_conversation_created_idx on public.messages (conversation_id, created_at);
create index if not exists messages_sender_idx on public.messages (sender_id);

alter table public.messages enable row level security;
alter table public.messages force row level security;

-- Posts (professional content)
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.professional_profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists posts_author_created_idx on public.posts (author_id, created_at desc);

alter table public.posts enable row level security;
alter table public.posts force row level security;

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists post_likes_user_idx on public.post_likes (user_id);

alter table public.post_likes enable row level security;
alter table public.post_likes force row level security;

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists post_comments_post_created_idx on public.post_comments (post_id, created_at);
create index if not exists post_comments_author_idx on public.post_comments (author_id);

alter table public.post_comments enable row level security;
alter table public.post_comments force row level security;

-- Reviews (Customer -> Professional, only after accepted request)
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.contact_requests(id) on delete cascade,
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  rating int not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_rating_range check (rating between 1 and 5)
);

create index if not exists reviews_professional_created_idx on public.reviews (professional_id, created_at desc);
create index if not exists reviews_customer_created_idx on public.reviews (customer_id, created_at desc);

alter table public.reviews enable row level security;
alter table public.reviews force row level security;

-- Support tickets (customer/professional -> admin)
do $$ begin
  create type public.ticket_status as enum ('open', 'closed');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null,
  body text not null,
  status public.ticket_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_tickets_status_idx on public.support_tickets (status);
create index if not exists support_tickets_author_idx on public.support_tickets (author_id);

alter table public.support_tickets enable row level security;
alter table public.support_tickets force row level security;

-- Notifications (follow started, request received, review received, etc.)
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null,
  entity_type text,
  entity_id uuid,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists notifications_recipient_created_idx on public.notifications (recipient_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (recipient_id) where read_at is null;

alter table public.notifications enable row level security;
alter table public.notifications force row level security;

-- Helpers (security definer) for RLS
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.is_banned = false
  );
$$;

create or replace function public.is_professional()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'professional'
      and p.is_banned = false
  );
$$;

create or replace function public.is_customer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'customer'
      and p.is_banned = false
  );
$$;

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
  );
$$;

-- Auth triggers: create profile rows on signup (minimal + robust)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  desired_role text;
begin
  desired_role := coalesce(new.raw_user_meta_data->>'role', 'customer');

  insert into public.profiles (id, role, email, first_name, last_name, province_code, phone)
  values (
    new.id,
    case
      when desired_role in ('customer', 'professional', 'admin') then desired_role::public.user_role
      else 'customer'::public.user_role
    end,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    nullif(new.raw_user_meta_data->>'province_code', ''),
    nullif(new.raw_user_meta_data->>'phone', '')
  )
  on conflict (id) do nothing;

  -- Create the companion rows for professionals (safe upsert).
  if desired_role = 'professional' then
    insert into public.professional_profiles (id)
    values (new.id)
    on conflict (id) do nothing;

    insert into public.professional_subscriptions (professional_id, status)
    values (new.id, 'none')
    on conflict (professional_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.handle_user_email_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set email = new.email,
      updated_at = now()
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated_email on auth.users;
create trigger on_auth_user_updated_email
after update of email on auth.users
for each row execute function public.handle_user_email_update();

-- Timestamps
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_schema = 'public' and tg_table_name = 'contact_requests' then
    if old.status = 'pending' and new.status in ('accepted', 'rejected') and new.responded_at is null then
      new.responded_at = now();
    end if;
  end if;

  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.tg_set_updated_at();

drop trigger if exists set_professional_profiles_updated_at on public.professional_profiles;
create trigger set_professional_profiles_updated_at
before update on public.professional_profiles
for each row execute function public.tg_set_updated_at();

drop trigger if exists set_contact_requests_updated_at on public.contact_requests;
create trigger set_contact_requests_updated_at
before update on public.contact_requests
for each row execute function public.tg_set_updated_at();

drop trigger if exists set_conversations_updated_at on public.conversations;
create trigger set_conversations_updated_at
before update on public.conversations
for each row execute function public.tg_set_updated_at();

drop trigger if exists set_posts_updated_at on public.posts;
create trigger set_posts_updated_at
before update on public.posts
for each row execute function public.tg_set_updated_at();

drop trigger if exists set_post_comments_updated_at on public.post_comments;
create trigger set_post_comments_updated_at
before update on public.post_comments
for each row execute function public.tg_set_updated_at();

drop trigger if exists set_reviews_updated_at on public.reviews;
create trigger set_reviews_updated_at
before update on public.reviews
for each row execute function public.tg_set_updated_at();

drop trigger if exists set_support_tickets_updated_at on public.support_tickets;
create trigger set_support_tickets_updated_at
before update on public.support_tickets
for each row execute function public.tg_set_updated_at();

-- Contact request <-> conversation sync (chat exists from the first request message)
create or replace function public.tg_contact_request_create_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.conversations (request_id, customer_id, professional_id, status)
  values (new.id, new.customer_id, new.professional_id, new.status)
  on conflict (request_id) do nothing;

  return new;
end;
$$;

drop trigger if exists contact_request_create_conversation on public.contact_requests;
create trigger contact_request_create_conversation
after insert on public.contact_requests
for each row execute function public.tg_contact_request_create_conversation();

create or replace function public.tg_contact_request_sync_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations
  set status = new.status
  where request_id = new.id;

  return new;
end;
$$;

drop trigger if exists contact_request_sync_conversation on public.contact_requests;
create trigger contact_request_sync_conversation
after update of status on public.contact_requests
for each row execute function public.tg_contact_request_sync_conversation();

create or replace function public.tg_message_set_last_message_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations
  set last_message_at = new.created_at
  where id = new.conversation_id;

  return new;
end;
$$;

drop trigger if exists messages_set_last_message_at on public.messages;
create trigger messages_set_last_message_at
after insert on public.messages
for each row execute function public.tg_message_set_last_message_at();

-- RLS policies

-- PROFILES
drop policy if exists "Profiles: self read" on public.profiles;
create policy "Profiles: self read"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "Profiles: self update" on public.profiles;
create policy "Profiles: self update"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "Profiles: admin read all" on public.profiles;
create policy "Profiles: admin read all"
on public.profiles
for select
to authenticated
using ((select public.is_admin()));

drop policy if exists "Profiles: admin update all" on public.profiles;
create policy "Profiles: admin update all"
on public.profiles
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- PROFESSIONAL PROFILES
drop policy if exists "Professional profiles: owner read" on public.professional_profiles;
create policy "Professional profiles: owner read"
on public.professional_profiles
for select
to authenticated
using ((select auth.uid()) = id);

-- Professionals can browse professionals (subscribed or not)
drop policy if exists "Professional profiles: professionals read all" on public.professional_profiles;
create policy "Professional profiles: professionals read all"
on public.professional_profiles
for select
to authenticated
using ((select public.is_professional()));

-- Customers can browse only active-subscriber professionals
drop policy if exists "Professional profiles: customers read active only" on public.professional_profiles;
create policy "Professional profiles: customers read active only"
on public.professional_profiles
for select
to authenticated
using (
  (select public.is_customer())
  and (select public.professional_is_active_subscriber(public.professional_profiles.id))
);

drop policy if exists "Professional profiles: admin read all" on public.professional_profiles;
create policy "Professional profiles: admin read all"
on public.professional_profiles
for select
to authenticated
using ((select public.is_admin()));

drop policy if exists "Professional profiles: owner update" on public.professional_profiles;
create policy "Professional profiles: owner update"
on public.professional_profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "Professional profiles: admin update" on public.professional_profiles;
create policy "Professional profiles: admin update"
on public.professional_profiles
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- SUBSCRIPTIONS (admin manages + professional reads own)
drop policy if exists "Subscriptions: pro read own" on public.professional_subscriptions;
create policy "Subscriptions: pro read own"
on public.professional_subscriptions
for select
to authenticated
using ((select auth.uid()) = professional_id);

drop policy if exists "Subscriptions: admin read" on public.professional_subscriptions;
create policy "Subscriptions: admin read"
on public.professional_subscriptions
for select
to authenticated
using ((select public.is_admin()));

drop policy if exists "Subscriptions: admin update" on public.professional_subscriptions;
create policy "Subscriptions: admin update"
on public.professional_subscriptions
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- FOLLOWS (professional only)
drop policy if exists "Follows: pro read" on public.professional_follows;
create policy "Follows: pro read"
on public.professional_follows
for select
to authenticated
using ((select public.is_professional()));

drop policy if exists "Follows: pro insert own" on public.professional_follows;
create policy "Follows: pro insert own"
on public.professional_follows
for insert
to authenticated
with check (
  (select public.is_professional())
  and follower_id = (select auth.uid())
);

drop policy if exists "Follows: pro delete own" on public.professional_follows;
create policy "Follows: pro delete own"
on public.professional_follows
for delete
to authenticated
using (
  (select public.is_professional())
  and follower_id = (select auth.uid())
);

-- CONTACT REQUESTS
drop policy if exists "Requests: customer insert" on public.contact_requests;
create policy "Requests: customer insert"
on public.contact_requests
for insert
to authenticated
with check (
  (select public.is_customer())
  and customer_id = (select auth.uid())
  and (select public.professional_is_active_subscriber(professional_id))
  and privacy_accepted = true
);

drop policy if exists "Requests: participants read" on public.contact_requests;
create policy "Requests: participants read"
on public.contact_requests
for select
to authenticated
using (
  customer_id = (select auth.uid())
  or professional_id = (select auth.uid())
  or (select public.is_admin())
);

drop policy if exists "Requests: professional update status" on public.contact_requests;
create policy "Requests: professional update status"
on public.contact_requests
for update
to authenticated
using (
  (select public.is_professional())
  and professional_id = (select auth.uid())
)
with check (
  (select public.is_professional())
  and professional_id = (select auth.uid())
);

-- CONVERSATIONS
drop policy if exists "Conversations: participants read" on public.conversations;
create policy "Conversations: participants read"
on public.conversations
for select
to authenticated
using (
  customer_id = (select auth.uid())
  or professional_id = (select auth.uid())
  or (select public.is_admin())
);

drop policy if exists "Conversations: participants update" on public.conversations;
create policy "Conversations: participants update"
on public.conversations
for update
to authenticated
using (
  customer_id = (select auth.uid())
  or professional_id = (select auth.uid())
  or (select public.is_admin())
)
with check (
  customer_id = (select auth.uid())
  or professional_id = (select auth.uid())
  or (select public.is_admin())
);

-- MESSAGES
create or replace function public.can_access_conversation(conv_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversations c
    where c.id = conv_id
      and (
        c.customer_id = auth.uid()
        or c.professional_id = auth.uid()
        or (select public.is_admin())
      )
  );
$$;

drop policy if exists "Messages: participants read" on public.messages;
create policy "Messages: participants read"
on public.messages
for select
to authenticated
using ((select public.can_access_conversation(conversation_id)));

drop policy if exists "Messages: participants insert" on public.messages;
create policy "Messages: participants insert"
on public.messages
for insert
to authenticated
with check (
  (select public.can_access_conversation(conversation_id))
  and sender_id = (select auth.uid())
);

drop policy if exists "Messages: sender delete own" on public.messages;
create policy "Messages: sender delete own"
on public.messages
for delete
to authenticated
using (sender_id = (select auth.uid()));

-- POSTS
drop policy if exists "Posts: readable by authenticated" on public.posts;
create policy "Posts: readable by authenticated"
on public.posts
for select
to authenticated
using (true);

drop policy if exists "Posts: professional insert own" on public.posts;
create policy "Posts: professional insert own"
on public.posts
for insert
to authenticated
with check (
  (select public.is_professional())
  and author_id = (select auth.uid())
);

drop policy if exists "Posts: professional update own" on public.posts;
create policy "Posts: professional update own"
on public.posts
for update
to authenticated
using (author_id = (select auth.uid()))
with check (author_id = (select auth.uid()));

drop policy if exists "Posts: professional delete own" on public.posts;
create policy "Posts: professional delete own"
on public.posts
for delete
to authenticated
using (author_id = (select auth.uid()));

-- POST LIKES
drop policy if exists "Post likes: readable by authenticated" on public.post_likes;
create policy "Post likes: readable by authenticated"
on public.post_likes
for select
to authenticated
using (true);

drop policy if exists "Post likes: insert own" on public.post_likes;
create policy "Post likes: insert own"
on public.post_likes
for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "Post likes: delete own" on public.post_likes;
create policy "Post likes: delete own"
on public.post_likes
for delete
to authenticated
using (user_id = (select auth.uid()));

-- COMMENTS
drop policy if exists "Post comments: readable by authenticated" on public.post_comments;
create policy "Post comments: readable by authenticated"
on public.post_comments
for select
to authenticated
using (true);

drop policy if exists "Post comments: insert own" on public.post_comments;
create policy "Post comments: insert own"
on public.post_comments
for insert
to authenticated
with check (author_id = (select auth.uid()));

drop policy if exists "Post comments: update own" on public.post_comments;
create policy "Post comments: update own"
on public.post_comments
for update
to authenticated
using (author_id = (select auth.uid()))
with check (author_id = (select auth.uid()));

drop policy if exists "Post comments: delete own" on public.post_comments;
create policy "Post comments: delete own"
on public.post_comments
for delete
to authenticated
using (author_id = (select auth.uid()));

-- REVIEWS
create or replace function public.can_review_request(req_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.contact_requests r
    where r.id = req_id
      and r.customer_id = auth.uid()
      and r.status = 'accepted'
  );
$$;

drop policy if exists "Reviews: readable by authenticated" on public.reviews;
create policy "Reviews: readable by authenticated"
on public.reviews
for select
to authenticated
using (true);

drop policy if exists "Reviews: customer insert for accepted request" on public.reviews;
create policy "Reviews: customer insert for accepted request"
on public.reviews
for insert
to authenticated
with check (
  (select public.is_customer())
  and customer_id = (select auth.uid())
  and (select public.can_review_request(request_id))
);

-- Editable only for 30 days from creation
drop policy if exists "Reviews: customer update within 30 days" on public.reviews;
create policy "Reviews: customer update within 30 days"
on public.reviews
for update
to authenticated
using (
  customer_id = (select auth.uid())
  and now() <= (created_at + interval '30 days')
)
with check (
  customer_id = (select auth.uid())
  and now() <= (created_at + interval '30 days')
);

drop policy if exists "Reviews: admin delete" on public.reviews;
create policy "Reviews: admin delete"
on public.reviews
for delete
to authenticated
using ((select public.is_admin()));

-- SUPPORT TICKETS
drop policy if exists "Tickets: author read own" on public.support_tickets;
create policy "Tickets: author read own"
on public.support_tickets
for select
to authenticated
using (author_id = (select auth.uid()));

drop policy if exists "Tickets: author insert" on public.support_tickets;
create policy "Tickets: author insert"
on public.support_tickets
for insert
to authenticated
with check (author_id = (select auth.uid()));

drop policy if exists "Tickets: author update own" on public.support_tickets;
create policy "Tickets: author update own"
on public.support_tickets
for update
to authenticated
using (author_id = (select auth.uid()))
with check (author_id = (select auth.uid()));

drop policy if exists "Tickets: admin read all" on public.support_tickets;
create policy "Tickets: admin read all"
on public.support_tickets
for select
to authenticated
using ((select public.is_admin()));

drop policy if exists "Tickets: admin update all" on public.support_tickets;
create policy "Tickets: admin update all"
on public.support_tickets
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- NOTIFICATIONS
drop policy if exists "Notifications: recipient read own" on public.notifications;
create policy "Notifications: recipient read own"
on public.notifications
for select
to authenticated
using (recipient_id = (select auth.uid()));

drop policy if exists "Notifications: recipient update own" on public.notifications;
create policy "Notifications: recipient update own"
on public.notifications
for update
to authenticated
using (recipient_id = (select auth.uid()))
with check (recipient_id = (select auth.uid()));

drop policy if exists "Notifications: admin read" on public.notifications;
create policy "Notifications: admin read"
on public.notifications
for select
to authenticated
using ((select public.is_admin()));

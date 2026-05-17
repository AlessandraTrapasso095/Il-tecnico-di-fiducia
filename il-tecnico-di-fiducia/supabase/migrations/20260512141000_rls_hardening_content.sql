-- RLS hardening: restrict mutable fields + enforce content visibility
-- Goals:
-- - Prevent unauthorized field mutation via overly broad UPDATE policies.
-- - Enforce "follow-to-see-posts" for professionals and "active subscriber" visibility for customers at DB level.
-- - Keep system-managed rows (e.g. conversations) from being user-mutable.

-- 1) Content visibility helpers
create or replace function public.can_view_professional_posts(pro_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select public.is_admin())
    or (
      (select public.is_customer())
      and (select public.professional_is_active_subscriber(pro_id))
    )
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

create or replace function public.can_view_post(post_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.posts p
    where p.id = post_uuid
      and (select public.can_view_professional_posts(p.author_id))
  );
$$;

-- POSTS (enforce visibility)
drop policy if exists "Posts: readable by authenticated" on public.posts;
create policy "Posts: readable by viewers"
on public.posts
for select
to authenticated
using ((select public.can_view_professional_posts(author_id)));

-- POST LIKES (visibility + insert guard)
drop policy if exists "Post likes: readable by authenticated" on public.post_likes;
create policy "Post likes: readable by viewers"
on public.post_likes
for select
to authenticated
using ((select public.can_view_post(post_id)));

drop policy if exists "Post likes: insert own" on public.post_likes;
create policy "Post likes: insert own"
on public.post_likes
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (select public.can_view_post(post_id))
);

-- COMMENTS (visibility + insert guard)
drop policy if exists "Post comments: readable by authenticated" on public.post_comments;
create policy "Post comments: readable by viewers"
on public.post_comments
for select
to authenticated
using ((select public.can_view_post(post_id)));

drop policy if exists "Post comments: insert own" on public.post_comments;
create policy "Post comments: insert own"
on public.post_comments
for insert
to authenticated
with check (
  author_id = (select auth.uid())
  and (select public.can_view_post(post_id))
);

-- 2) Stop user-mutation of system-managed conversations
drop policy if exists "Conversations: participants update" on public.conversations;
drop policy if exists "Conversations: admin update" on public.conversations;
create policy "Conversations: admin update"
on public.conversations
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- 3) Guard triggers for UPDATE-able tables (least privilege)

-- CONTACT REQUESTS: professionals may only change status (pending -> accepted/rejected).
create or replace function public.tg_contact_requests_guard_mutations()
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

  -- Admins are allowed to manage all fields.
  if (select public.is_admin()) then
    return new;
  end if;

  -- Immutable identity fields
  if old.id is distinct from new.id then
    raise exception 'contact_requests.id is immutable';
  end if;
  if old.customer_id is distinct from new.customer_id then
    raise exception 'contact_requests.customer_id is immutable';
  end if;
  if old.professional_id is distinct from new.professional_id then
    raise exception 'contact_requests.professional_id is immutable';
  end if;
  if old.subject is distinct from new.subject then
    raise exception 'contact_requests.subject is immutable after creation';
  end if;
  if old.message is distinct from new.message then
    raise exception 'contact_requests.message is immutable after creation';
  end if;
  if old.privacy_accepted is distinct from new.privacy_accepted then
    raise exception 'contact_requests.privacy_accepted is immutable';
  end if;
  if old.created_at is distinct from new.created_at then
    raise exception 'contact_requests.created_at is immutable';
  end if;

  -- Only status transitions are allowed for non-admins.
  if old.status is distinct from new.status then
    if old.status <> 'pending' then
      raise exception 'contact_requests.status can only transition from pending';
    end if;
    if new.status not in ('accepted', 'rejected') then
      raise exception 'contact_requests.status invalid transition';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists a_contact_requests_guard_mutations on public.contact_requests;
create trigger a_contact_requests_guard_mutations
before update on public.contact_requests
for each row execute function public.tg_contact_requests_guard_mutations();

-- REVIEWS: customers may only edit rating/body (within policy window); identity fields immutable.
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
  if caller is null then
    return new;
  end if;

  if (select public.is_admin()) then
    return new;
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

-- SUPPORT TICKETS: authors can edit subject/body while open, and close once; cannot reopen.
create or replace function public.tg_support_tickets_guard_mutations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid;
begin
  caller := auth.uid();
  if caller is null then
    return new;
  end if;

  if (select public.is_admin()) then
    return new;
  end if;

  if old.author_id is distinct from new.author_id then
    raise exception 'support_tickets.author_id is immutable';
  end if;
  if old.created_at is distinct from new.created_at then
    raise exception 'support_tickets.created_at is immutable';
  end if;

  if old.status = 'closed' and new.status <> 'closed' then
    raise exception 'support_tickets cannot be reopened';
  end if;

  if old.status is distinct from new.status then
    if old.status <> 'open' or new.status <> 'closed' then
      raise exception 'support_tickets.status can only transition open -> closed';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists a_support_tickets_guard_mutations on public.support_tickets;
create trigger a_support_tickets_guard_mutations
before update on public.support_tickets
for each row execute function public.tg_support_tickets_guard_mutations();

-- NOTIFICATIONS: recipients may only set/clear read_at; identity fields immutable.
create or replace function public.tg_notifications_guard_mutations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid;
begin
  caller := auth.uid();
  if caller is null then
    return new;
  end if;

  if (select public.is_admin()) then
    return new;
  end if;

  if old.recipient_id is distinct from new.recipient_id then
    raise exception 'notifications.recipient_id is immutable';
  end if;
  if old.actor_id is distinct from new.actor_id then
    raise exception 'notifications.actor_id is immutable';
  end if;
  if old.type is distinct from new.type then
    raise exception 'notifications.type is immutable';
  end if;
  if old.entity_type is distinct from new.entity_type then
    raise exception 'notifications.entity_type is immutable';
  end if;
  if old.entity_id is distinct from new.entity_id then
    raise exception 'notifications.entity_id is immutable';
  end if;
  if old.created_at is distinct from new.created_at then
    raise exception 'notifications.created_at is immutable';
  end if;

  return new;
end;
$$;

drop trigger if exists a_notifications_guard_mutations on public.notifications;
create trigger a_notifications_guard_mutations
before update on public.notifications
for each row execute function public.tg_notifications_guard_mutations();


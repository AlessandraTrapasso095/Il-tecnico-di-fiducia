-- RLS hardening: block banned users from mutating data
-- Rationale:
-- - Some earlier "owner-only" policies did not check ban state.
-- - We want a ban to immediately stop all app writes (except admins, which are already gated by is_admin()).
--
-- Note: We keep SELECT policies mostly as-is (for clearer UX you can also block reads),
-- but we *must* block UPDATE/DELETE for banned users to prevent post-ban tampering.

-- PROFILES: prevent banned users from reading/updating their own profile via Data API
drop policy if exists "Profiles: self read" on public.profiles;
create policy "Profiles: self read"
on public.profiles
for select
to authenticated
using (
  (select auth.uid()) = id
  and is_banned = false
);

drop policy if exists "Profiles: self update" on public.profiles;
create policy "Profiles: self update"
on public.profiles
for update
to authenticated
using (
  (select auth.uid()) = id
  and is_banned = false
)
with check (
  (select auth.uid()) = id
  and is_banned = false
);

-- PROFESSIONAL PROFILES: owner can update only while active (not banned)
drop policy if exists "Professional profiles: owner read" on public.professional_profiles;
create policy "Professional profiles: owner read"
on public.professional_profiles
for select
to authenticated
using (
  (select auth.uid()) = id
  and (select public.is_active_user())
);

drop policy if exists "Professional profiles: owner update" on public.professional_profiles;
create policy "Professional profiles: owner update"
on public.professional_profiles
for update
to authenticated
using (
  (select auth.uid()) = id
  and (select public.is_active_user())
)
with check (
  (select auth.uid()) = id
  and (select public.is_active_user())
);

-- POSTS: only active professionals can update/delete their posts; admins can moderate
drop policy if exists "Posts: professional update own" on public.posts;
create policy "Posts: professional update own"
on public.posts
for update
to authenticated
using (
  (select public.is_admin())
  or (
    (select public.is_professional())
    and author_id = (select auth.uid())
  )
)
with check (
  (select public.is_admin())
  or (
    (select public.is_professional())
    and author_id = (select auth.uid())
  )
);

drop policy if exists "Posts: professional delete own" on public.posts;
create policy "Posts: professional delete own"
on public.posts
for delete
to authenticated
using (
  (select public.is_admin())
  or (
    (select public.is_professional())
    and author_id = (select auth.uid())
  )
);

-- POST LIKES: users may remove likes only while active
drop policy if exists "Post likes: delete own" on public.post_likes;
create policy "Post likes: delete own"
on public.post_likes
for delete
to authenticated
using (
  user_id = (select auth.uid())
  and (select public.is_active_user())
);

-- COMMENTS: users may edit/delete their comments only while active
drop policy if exists "Post comments: update own" on public.post_comments;
create policy "Post comments: update own"
on public.post_comments
for update
to authenticated
using (
  author_id = (select auth.uid())
  and (select public.is_active_user())
)
with check (
  author_id = (select auth.uid())
  and (select public.is_active_user())
);

drop policy if exists "Post comments: delete own" on public.post_comments;
create policy "Post comments: delete own"
on public.post_comments
for delete
to authenticated
using (
  (select public.is_admin())
  or (
    author_id = (select auth.uid())
    and (select public.is_active_user())
  )
);

-- MESSAGES: sender may delete only while active; admins can moderate
drop policy if exists "Messages: sender delete own" on public.messages;
create policy "Messages: sender delete own"
on public.messages
for delete
to authenticated
using (
  (select public.is_admin())
  or (
    sender_id = (select auth.uid())
    and (select public.is_active_user())
  )
);

-- REVIEWS: customer may edit only while active and within 30 days
drop policy if exists "Reviews: customer update within 30 days" on public.reviews;
create policy "Reviews: customer update within 30 days"
on public.reviews
for update
to authenticated
using (
  (select public.is_customer())
  and customer_id = (select auth.uid())
  and now() <= (created_at + interval '30 days')
)
with check (
  (select public.is_customer())
  and customer_id = (select auth.uid())
  and now() <= (created_at + interval '30 days')
);

-- SUPPORT TICKETS: authors can create/update only while active
drop policy if exists "Tickets: author insert" on public.support_tickets;
create policy "Tickets: author insert"
on public.support_tickets
for insert
to authenticated
with check (
  author_id = (select auth.uid())
  and (select public.is_active_user())
);

drop policy if exists "Tickets: author update own" on public.support_tickets;
create policy "Tickets: author update own"
on public.support_tickets
for update
to authenticated
using (
  author_id = (select auth.uid())
  and (select public.is_active_user())
)
with check (
  author_id = (select auth.uid())
  and (select public.is_active_user())
);


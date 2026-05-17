-- RLS hardening (privacy + bans)
-- Goals:
-- - Prevent banned users from accessing private app data.
-- - Avoid overly broad review visibility.

-- Active user helper (not banned)
create or replace function public.is_active_user()
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
      and p.is_banned = false
  );
$$;

-- Tighten access helpers to require an active user
create or replace function public.can_access_conversation(conv_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select public.is_active_user()) and exists (
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

create or replace function public.can_access_request(req_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select public.is_active_user()) and exists (
    select 1
    from public.contact_requests r
    where r.id = req_id
      and (
        r.customer_id = auth.uid()
        or r.professional_id = auth.uid()
        or (select public.is_admin())
      )
  );
$$;

create or replace function public.can_access_professional_cv(pro_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select public.is_active_user())
    and (
      (select public.is_admin())
      or auth.uid() = pro_id
      or exists (
        select 1
        from public.contact_requests r
        where r.professional_id = pro_id
          and r.customer_id = auth.uid()
          and r.status = 'accepted'
      )
    );
$$;

-- Customer directory visibility: only active professionals (participant) or admin
create or replace function public.professional_can_view_customer_dir(customer_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select public.is_admin())
    or (
      (select public.is_professional())
      and exists (
        select 1
        from public.conversations c
        where c.professional_id = auth.uid()
          and c.customer_id = customer_uuid
      )
    );
$$;

-- CONTACT REQUESTS: participants read only if active
drop policy if exists "Requests: participants read" on public.contact_requests;
create policy "Requests: participants read"
on public.contact_requests
for select
to authenticated
using (
  (select public.is_admin())
  or (
    (select public.is_active_user())
    and (
      customer_id = (select auth.uid())
      or professional_id = (select auth.uid())
    )
  )
);

-- CONVERSATIONS: participants read only if active
drop policy if exists "Conversations: participants read" on public.conversations;
create policy "Conversations: participants read"
on public.conversations
for select
to authenticated
using (
  (select public.is_admin())
  or (
    (select public.is_active_user())
    and (
      customer_id = (select auth.uid())
      or professional_id = (select auth.uid())
    )
  )
);

-- REVIEWS: restrict visibility (avoid leaking full history to all users)
drop policy if exists "Reviews: readable by authenticated" on public.reviews;
create policy "Reviews: admin read"
on public.reviews
for select
to authenticated
using ((select public.is_admin()));

create policy "Reviews: professional read own"
on public.reviews
for select
to authenticated
using (
  (select public.is_professional())
  and professional_id = (select auth.uid())
);

create policy "Reviews: customer read own or visible pros"
on public.reviews
for select
to authenticated
using (
  (select public.is_customer())
  and (
    customer_id = (select auth.uid())
    or (select public.professional_is_active_subscriber(professional_id))
  )
);


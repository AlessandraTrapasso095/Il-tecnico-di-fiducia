-- Customer visibility must always require an active professional subscription.
-- No "already contacted" exception is allowed for search, favorites, posts, or chat access.

create or replace function public.customer_can_view_professional(pro_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select public.is_customer())
    and (select public.professional_is_active_subscriber(pro_id));
$$;

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

drop policy if exists "Professional directory: customers read active only" on public.professional_directory;
drop policy if exists "Professional directory: customers read visible" on public.professional_directory;
create policy "Professional directory: customers read active only"
on public.professional_directory
for select
to authenticated
using (
  (select public.is_customer())
  and (select public.professional_is_active_subscriber(public.professional_directory.id))
);

drop policy if exists "Professional categories: readable by customers (active only)" on public.professional_categories;
drop policy if exists "Professional categories: readable by customers (visible pros)" on public.professional_categories;
create policy "Professional categories: readable by customers (active only)"
on public.professional_categories
for select
to authenticated
using (
  (select public.is_customer())
  and (select public.professional_is_active_subscriber(professional_id))
);

drop policy if exists "Saved professionals: customer insert own" on public.saved_professionals;
create policy "Saved professionals: customer insert own"
on public.saved_professionals
for insert
to authenticated
with check (
  customer_id = (select auth.uid())
  and (select public.is_customer())
  and (select public.professional_is_active_subscriber(professional_id))
);

create or replace function public.can_read_conversation_messages(conv_id uuid)
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
        (select public.is_admin())
        or (
          (select public.is_professional())
          and c.professional_id = auth.uid()
        )
        or (
          (select public.is_customer())
          and c.customer_id = auth.uid()
          and (select public.professional_is_active_subscriber(c.professional_id))
        )
      )
  );
$$;

create or replace function public.can_insert_conversation_message(
  conv_id uuid,
  sender_uuid uuid
)
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
      and c.status = 'accepted'
      and sender_uuid = auth.uid()
      and (
        c.customer_id = auth.uid()
        or c.professional_id = auth.uid()
      )
      and (select public.professional_is_active_subscriber(c.professional_id))
  );
$$;

drop policy if exists "Messages: participants read" on public.messages;
create policy "Messages: participants read"
on public.messages
for select
to authenticated
using ((select public.can_read_conversation_messages(conversation_id)));

drop policy if exists "Messages: participants insert" on public.messages;
create policy "Messages: participants insert"
on public.messages
for insert
to authenticated
with check ((select public.can_insert_conversation_message(conversation_id, sender_id)));

drop policy if exists "Message attachments: participants read" on public.message_attachments;
create policy "Message attachments: participants read"
on public.message_attachments
for select
to authenticated
using ((select public.can_read_conversation_messages(conversation_id)));

drop policy if exists "Message attachments: participants insert own" on public.message_attachments;
create policy "Message attachments: participants insert own"
on public.message_attachments
for insert
to authenticated
with check (
  uploader_id = (select auth.uid())
  and (select public.can_insert_conversation_message(conversation_id, uploader_id))
);

drop policy if exists "Message attachments: uploader delete own" on public.message_attachments;
create policy "Message attachments: uploader delete own"
on public.message_attachments
for delete
to authenticated
using (
  uploader_id = (select auth.uid())
  and (select public.can_read_conversation_messages(conversation_id))
);

drop policy if exists "Quotes: participants read" on public.quotes;
create policy "Quotes: participants read"
on public.quotes
for select
to authenticated
using (
  (select public.is_admin())
  or (
    (select public.is_professional())
    and professional_id = (select auth.uid())
  )
  or (
    (select public.is_customer())
    and client_id = (select auth.uid())
    and (select public.professional_is_active_subscriber(professional_id))
  )
);

drop policy if exists "Quotes: professional insert accepted conversation" on public.quotes;
create policy "Quotes: professional insert accepted conversation"
on public.quotes
for insert
to authenticated
with check (
  (select public.is_professional())
  and professional_id = (select auth.uid())
  and status = 'pending'
  and (select public.professional_is_active_subscriber(professional_id))
  and exists (
    select 1
    from public.conversations c
    where c.id = conversation_id
      and c.professional_id = (select auth.uid())
      and c.customer_id = client_id
      and c.status = 'accepted'
  )
);

drop policy if exists "Quotes: client decide pending" on public.quotes;
create policy "Quotes: client decide pending"
on public.quotes
for update
to authenticated
using (
  client_id = (select auth.uid())
  and status = 'pending'
  and (select public.professional_is_active_subscriber(professional_id))
  and exists (
    select 1
    from public.conversations c
    where c.id = conversation_id
      and c.customer_id = (select auth.uid())
      and c.professional_id = professional_id
      and c.status = 'accepted'
  )
)
with check (
  client_id = (select auth.uid())
  and status in ('accepted', 'rejected')
  and (select public.professional_is_active_subscriber(professional_id))
  and exists (
    select 1
    from public.conversations c
    where c.id = conversation_id
      and c.customer_id = (select auth.uid())
      and c.professional_id = professional_id
      and c.status = 'accepted'
  )
);

grant execute on function public.can_read_conversation_messages(uuid) to authenticated;
grant execute on function public.can_insert_conversation_message(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';

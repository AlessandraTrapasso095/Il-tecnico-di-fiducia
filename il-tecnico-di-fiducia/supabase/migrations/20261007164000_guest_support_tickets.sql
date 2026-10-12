-- Guest/public support tickets.
--
-- Registered tickets continue to use author_id.
-- Public tickets use guest identity fields and a one-way hash of a
-- cryptographically-random bearer token.
--
-- Anonymous clients never receive direct table access. Public ticket
-- access is mediated by server-side API routes using the service client
-- only after the supplied bearer token has been hashed and verified.

alter table public.support_tickets
  alter column author_id drop not null;

alter table public.support_tickets
  add column if not exists guest_first_name text,
  add column if not exists guest_last_name text,
  add column if not exists guest_email text,
  add column if not exists guest_access_token_hash text,
  add column if not exists guest_access_created_at timestamptz;

create unique index if not exists support_tickets_guest_access_token_hash_idx
  on public.support_tickets (guest_access_token_hash)
  where guest_access_token_hash is not null;

create index if not exists support_tickets_guest_email_idx
  on public.support_tickets (lower(guest_email))
  where guest_email is not null;

alter table public.support_tickets
  drop constraint if exists support_tickets_guest_identity_check;

alter table public.support_tickets
  add constraint support_tickets_guest_identity_check
  check (
    (
      author_id is not null
      and guest_first_name is null
      and guest_last_name is null
      and guest_email is null
      and guest_access_token_hash is null
      and guest_access_created_at is null
    )
    or
    (
      author_id is null
      and length(btrim(coalesce(guest_first_name, ''))) > 0
      and length(btrim(coalesce(guest_last_name, ''))) > 0
      and length(btrim(coalesce(guest_email, ''))) > 0
      and length(btrim(coalesce(guest_access_token_hash, ''))) > 0
      and guest_access_created_at is not null
    )
  );

alter table public.support_messages
  drop constraint if exists support_messages_sender_role_check;

alter table public.support_messages
  add constraint support_messages_sender_role_check
  check (sender_role in ('customer', 'professional', 'admin', 'guest'));

-- Keep direct DB access restricted to authenticated application users.
-- Guest access will be performed only through server-side API routes.
revoke all on table public.support_tickets from anon;
revoke all on table public.support_messages from anon;

notify pgrst, 'reload schema';

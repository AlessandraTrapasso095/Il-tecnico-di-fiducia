-- Guard triggers (least privilege)
-- Goals:
-- - Prevent recipients from tampering with notification payload fields (only mark as read).
-- - Prevent non-admin users from mutating immutable support ticket identity fields.

-- NOTIFICATIONS: recipients may only set read_at; payload fields are immutable.
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

  -- System/trigger-originated updates (no JWT context) should not be blocked.
  if caller is null then
    return new;
  end if;

  -- Admins are allowed to manage all notification fields.
  if (select public.is_admin()) then
    return new;
  end if;

  -- Immutable identity/payload fields.
  if old.id is distinct from new.id then
    raise exception 'notifications.id is immutable';
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

  -- Only allow setting/refreshing read_at; never allow clearing it.
  if old.read_at is not null and new.read_at is null then
    raise exception 'notifications.read_at cannot be cleared';
  end if;

  return new;
end;
$$;

drop trigger if exists a_notifications_guard_mutations on public.notifications;
create trigger a_notifications_guard_mutations
before update on public.notifications
for each row execute function public.tg_notifications_guard_mutations();

-- SUPPORT TICKETS: non-admins cannot mutate immutable identity fields.
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

  -- System/trigger-originated updates (no JWT context) should not be blocked.
  if caller is null then
    return new;
  end if;

  -- Admins are allowed to manage all ticket fields.
  if (select public.is_admin()) then
    return new;
  end if;

  if old.id is distinct from new.id then
    raise exception 'support_tickets.id is immutable';
  end if;
  if old.author_id is distinct from new.author_id then
    raise exception 'support_tickets.author_id is immutable';
  end if;
  if old.created_at is distinct from new.created_at then
    raise exception 'support_tickets.created_at is immutable';
  end if;

  return new;
end;
$$;

drop trigger if exists a_support_tickets_guard_mutations on public.support_tickets;
create trigger a_support_tickets_guard_mutations
before update on public.support_tickets
for each row execute function public.tg_support_tickets_guard_mutations();


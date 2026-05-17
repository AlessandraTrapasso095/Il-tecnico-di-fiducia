-- Notifications triggers (no fake data, real events only)

-- Helper: insert a notification (dedupe optional by (recipient, type, entity_id, actor_id) within a short window)
create or replace function public.insert_notification(
  recipient uuid,
  actor uuid,
  notification_type text,
  entity_type text,
  entity uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (recipient_id, actor_id, type, entity_type, entity_id)
  values (recipient, actor, notification_type, entity_type, entity);
end;
$$;

-- Follow started: notify followed professional
create or replace function public.tg_notify_follow_started()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.insert_notification(
    new.followed_id,
    new.follower_id,
    'follow_started',
    'professional',
    new.followed_id
  );

  return new;
end;
$$;

drop trigger if exists notify_follow_started on public.professional_follows;
create trigger notify_follow_started
after insert on public.professional_follows
for each row execute function public.tg_notify_follow_started();

-- Contact request created: notify professional
create or replace function public.tg_notify_contact_request_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.insert_notification(
    new.professional_id,
    new.customer_id,
    'contact_request_created',
    'contact_request',
    new.id
  );

  return new;
end;
$$;

drop trigger if exists notify_contact_request_created on public.contact_requests;
create trigger notify_contact_request_created
after insert on public.contact_requests
for each row execute function public.tg_notify_contact_request_created();

-- Contact request status change: notify customer (accepted/rejected)
create or replace function public.tg_notify_contact_request_status_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is distinct from new.status then
    if new.status = 'accepted' then
      perform public.insert_notification(
        new.customer_id,
        new.professional_id,
        'contact_request_accepted',
        'contact_request',
        new.id
      );
    elsif new.status = 'rejected' then
      perform public.insert_notification(
        new.customer_id,
        new.professional_id,
        'contact_request_rejected',
        'contact_request',
        new.id
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists notify_contact_request_status_changed on public.contact_requests;
create trigger notify_contact_request_status_changed
after update of status on public.contact_requests
for each row execute function public.tg_notify_contact_request_status_changed();

-- Review created: notify professional
create or replace function public.tg_notify_review_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.insert_notification(
    new.professional_id,
    new.customer_id,
    'review_created',
    'review',
    new.id
  );

  return new;
end;
$$;

drop trigger if exists notify_review_created on public.reviews;
create trigger notify_review_created
after insert on public.reviews
for each row execute function public.tg_notify_review_created();


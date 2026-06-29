-- Social notifications for professional follow/like/comment events.
-- Uses real actors and real post/follow rows; no demo data.

create or replace function public.insert_notification(
  recipient uuid,
  actor uuid,
  notification_type text,
  entity_type text,
  entity uuid,
  dedupe boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if recipient is null then
    return;
  end if;

  if dedupe and exists (
    select 1
    from public.notifications n
    where n.recipient_id = recipient
      and n.actor_id is not distinct from actor
      and n.type = notification_type
      and n.entity_type is not distinct from entity_type
      and n.entity_id is not distinct from entity
  ) then
    return;
  end if;

  insert into public.notifications (recipient_id, actor_id, type, entity_type, entity_id)
  values (recipient, actor, notification_type, entity_type, entity);
end;
$$;

revoke execute on function public.insert_notification(uuid, uuid, text, text, uuid, boolean)
from public, anon, authenticated;

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
    new.follower_id,
    true
  );

  return new;
end;
$$;

drop trigger if exists notify_follow_started on public.professional_follows;
create trigger notify_follow_started
after insert on public.professional_follows
for each row execute function public.tg_notify_follow_started();

create or replace function public.tg_notify_post_liked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  post_owner uuid;
begin
  select p.author_id
  into post_owner
  from public.posts p
  where p.id = new.post_id;

  if post_owner is not null and post_owner <> new.user_id then
    perform public.insert_notification(
      post_owner,
      new.user_id,
      'post_liked',
      'post',
      new.post_id,
      true
    );
  end if;

  return new;
end;
$$;

drop trigger if exists notify_post_liked on public.post_likes;
create trigger notify_post_liked
after insert on public.post_likes
for each row execute function public.tg_notify_post_liked();

create or replace function public.tg_notify_post_commented()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  post_owner uuid;
begin
  select p.author_id
  into post_owner
  from public.posts p
  where p.id = new.post_id;

  if post_owner is not null and post_owner <> new.author_id then
    perform public.insert_notification(
      post_owner,
      new.author_id,
      'post_commented',
      'post',
      new.post_id,
      false
    );
  end if;

  return new;
end;
$$;

drop trigger if exists notify_post_commented on public.post_comments;
create trigger notify_post_commented
after insert on public.post_comments
for each row execute function public.tg_notify_post_commented();

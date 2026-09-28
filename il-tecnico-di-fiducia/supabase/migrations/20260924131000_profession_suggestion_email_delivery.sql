alter table public.profession_suggestions
  add column if not exists admin_email_sent_at timestamptz,
  add column if not exists admin_email_claim_token text,
  add column if not exists admin_email_claimed_at timestamptz,
  add column if not exists user_email_sent_at timestamptz,
  add column if not exists user_email_claim_token text,
  add column if not exists user_email_claimed_at timestamptz;

create or replace function public.claim_profession_suggestion_email(
  target_suggestion_id uuid,
  target_recipient text,
  target_claim_token text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer := 0;
begin
  if target_suggestion_id is null then
    raise exception 'target_suggestion_id is required';
  end if;

  if target_claim_token is null or btrim(target_claim_token) = '' then
    raise exception 'target_claim_token is required';
  end if;

  if target_recipient = 'admin' then
    update public.profession_suggestions
    set
      admin_email_claim_token = target_claim_token,
      admin_email_claimed_at = now(),
      updated_at = now()
    where id = target_suggestion_id
      and admin_email_sent_at is null
      and (
        admin_email_claim_token is null
        or admin_email_claimed_at is null
        or admin_email_claimed_at < now() - interval '10 minutes'
      );

  elsif target_recipient = 'user' then
    update public.profession_suggestions
    set
      user_email_claim_token = target_claim_token,
      user_email_claimed_at = now(),
      updated_at = now()
    where id = target_suggestion_id
      and user_email_sent_at is null
      and (
        user_email_claim_token is null
        or user_email_claimed_at is null
        or user_email_claimed_at < now() - interval '10 minutes'
      );

  else
    raise exception 'target_recipient must be admin or user';
  end if;

  get diagnostics affected = row_count;

  return affected > 0;
end;
$$;

create or replace function public.complete_profession_suggestion_email(
  target_suggestion_id uuid,
  target_recipient text,
  target_claim_token text,
  target_delivered boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer := 0;
begin
  if target_suggestion_id is null then
    raise exception 'target_suggestion_id is required';
  end if;

  if target_claim_token is null or btrim(target_claim_token) = '' then
    raise exception 'target_claim_token is required';
  end if;

  if target_delivered is null then
    raise exception 'target_delivered is required';
  end if;

  if target_recipient = 'admin' then
    if target_delivered then
      update public.profession_suggestions
      set
        admin_email_sent_at = coalesce(admin_email_sent_at, now()),
        admin_email_claim_token = null,
        admin_email_claimed_at = null,
        updated_at = now()
      where id = target_suggestion_id
        and admin_email_claim_token = target_claim_token;
    else
      update public.profession_suggestions
      set
        admin_email_claim_token = null,
        admin_email_claimed_at = null,
        updated_at = now()
      where id = target_suggestion_id
        and admin_email_sent_at is null
        and admin_email_claim_token = target_claim_token;
    end if;

  elsif target_recipient = 'user' then
    if target_delivered then
      update public.profession_suggestions
      set
        user_email_sent_at = coalesce(user_email_sent_at, now()),
        user_email_claim_token = null,
        user_email_claimed_at = null,
        updated_at = now()
      where id = target_suggestion_id
        and user_email_claim_token = target_claim_token;
    else
      update public.profession_suggestions
      set
        user_email_claim_token = null,
        user_email_claimed_at = null,
        updated_at = now()
      where id = target_suggestion_id
        and user_email_sent_at is null
        and user_email_claim_token = target_claim_token;
    end if;

  else
    raise exception 'target_recipient must be admin or user';
  end if;

  get diagnostics affected = row_count;

  return affected > 0;
end;
$$;

revoke all on function public.claim_profession_suggestion_email(
  uuid,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.claim_profession_suggestion_email(
  uuid,
  text,
  text
) to service_role;

revoke all on function public.complete_profession_suggestion_email(
  uuid,
  text,
  text,
  boolean
) from public, anon, authenticated;

grant execute on function public.complete_profession_suggestion_email(
  uuid,
  text,
  text,
  boolean
) to service_role;

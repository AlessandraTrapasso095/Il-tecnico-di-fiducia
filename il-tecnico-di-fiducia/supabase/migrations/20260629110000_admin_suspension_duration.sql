alter table public.profiles
add column if not exists suspended_until timestamptz;

create index if not exists profiles_suspended_until_idx
on public.profiles (suspended_until);

create or replace function public.profile_is_active(profile_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = profile_uuid
      and (
        p.is_banned = false
        or (
          p.suspended_until is not null
          and p.suspended_until <= now()
        )
      )
  );
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.profile_is_active(auth.uid());
$$;

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
      and public.profile_is_active(p.id)
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
      and public.profile_is_active(p.id)
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
      and public.profile_is_active(p.id)
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
    join public.profiles p on p.id = s.professional_id
    where s.professional_id = pro_id
      and public.profile_is_active(p.id)
      and s.status in ('stripe_active', 'admin_forced_active')
      and (s.current_period_end is null or s.current_period_end > now())
  );
$$;

create or replace function public.tg_profiles_guard_mutations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'authentication required';
  end if;

  if old.id is distinct from new.id then
    raise exception 'profiles.id is immutable';
  end if;

  if (select public.is_admin()) then
    return new;
  end if;

  if caller = new.id then
    if old.role is distinct from new.role then
      raise exception 'profiles.role is immutable';
    end if;

    if old.email is distinct from new.email then
      raise exception 'profiles.email is managed by auth and cannot be updated directly';
    end if;

    if old.must_change_password is distinct from new.must_change_password then
      raise exception 'profiles.must_change_password is admin-only';
    end if;

    if old.is_banned is distinct from new.is_banned then
      raise exception 'profiles.is_banned is admin-only';
    end if;

    if old.suspended_until is distinct from new.suspended_until then
      raise exception 'profiles.suspended_until is admin-only';
    end if;

    if old.created_at is distinct from new.created_at then
      raise exception 'profiles.created_at is immutable';
    end if;
  end if;

  return new;
end;
$$;

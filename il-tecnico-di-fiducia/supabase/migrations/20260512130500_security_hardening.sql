-- Security hardening (roles, profile integrity, least exposure)
-- Purpose:
-- - Prevent privilege escalation via user-controlled metadata or profile updates.
-- - Avoid leaking sensitive professional fields (e.g. CV storage path) through overly broad SELECT policies.
-- - Keep directory tables as derived/read models (write via source tables only).
-- Notes:
-- - No fake data inserted.
-- - Designed for Supabase Postgres with RLS enabled and Auth triggers in place.

-- 1) Harden signup role assignment: allow only customer/professional from user_metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  desired_role text;
begin
  desired_role := lower(coalesce(new.raw_user_meta_data->>'role', 'customer'));

  -- Never allow 'admin' (or any other value) from user-controlled metadata.
  if desired_role not in ('customer', 'professional') then
    desired_role := 'customer';
  end if;

  insert into public.profiles (id, role, email, first_name, last_name, province_code, phone)
  values (
    new.id,
    desired_role::public.user_role,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    nullif(new.raw_user_meta_data->>'province_code', ''),
    nullif(new.raw_user_meta_data->>'phone', '')
  )
  on conflict (id) do nothing;

  -- Create the companion rows for professionals (safe upsert).
  if desired_role = 'professional' then
    insert into public.professional_profiles (id)
    values (new.id)
    on conflict (id) do nothing;

    insert into public.professional_subscriptions (professional_id, status)
    values (new.id, 'none')
    on conflict (professional_id) do nothing;
  end if;

  return new;
end;
$$;

-- 2) Guard mutable columns on profiles: users can update their own personal data
-- but cannot self-escalate roles / unban themselves / mutate admin-managed flags.
create or replace function public.tg_profiles_guard_mutations()
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

  -- Admins are allowed to manage all profile fields.
  if (select public.is_admin()) then
    return new;
  end if;

  -- Non-admins:
  -- - may only update their own row (RLS already enforces this)
  -- - cannot change role/email/flags.
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

    if old.created_at is distinct from new.created_at then
      raise exception 'profiles.created_at is immutable';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists a_profiles_guard_mutations on public.profiles;
create trigger a_profiles_guard_mutations
before update on public.profiles
for each row execute function public.tg_profiles_guard_mutations();

-- 3) Reduce exposure of professional_profiles:
-- Use professional_directory for browsing. professional_profiles is private (owner/admin).
drop policy if exists "Professional profiles: professionals read all" on public.professional_profiles;
drop policy if exists "Professional profiles: customers read active only" on public.professional_profiles;

-- 4) Keep directory tables derived: write through source tables (profiles/professional_profiles).
drop policy if exists "Professional directory: owner update" on public.professional_directory;
drop policy if exists "Customer directory: self update" on public.customer_directory;

-- 5) Prevent client-side RPC calls to notification insert helper (trigger-only).
revoke execute on function public.insert_notification(uuid, uuid, text, text, uuid) from public, anon, authenticated;

-- 6) Explicit grants (future-proof for Supabase projects that do not auto-expose new tables).
-- Public reference data
grant select on table public.provinces to anon, authenticated;
grant select on table public.categories to anon, authenticated;

-- Authenticated app access (row access still enforced by RLS)
grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.professional_profiles to authenticated;
grant select, insert, update, delete on table public.professional_subscriptions to authenticated;
grant select, insert, update, delete on table public.professional_follows to authenticated;
grant select, insert, update, delete on table public.contact_requests to authenticated;
grant select, insert, update, delete on table public.conversations to authenticated;
grant select, insert, update, delete on table public.messages to authenticated;
grant select, insert, update, delete on table public.posts to authenticated;
grant select, insert, update, delete on table public.post_likes to authenticated;
grant select, insert, update, delete on table public.post_comments to authenticated;
grant select, insert, update, delete on table public.reviews to authenticated;
grant select, insert, update, delete on table public.support_tickets to authenticated;
grant select, insert, update, delete on table public.notifications to authenticated;
grant select, insert, update, delete on table public.professional_directory to authenticated;
grant select, insert, update, delete on table public.customer_directory to authenticated;
grant select, insert, update, delete on table public.saved_professionals to authenticated;
grant select, insert, update, delete on table public.categories to authenticated;
grant select, insert, update, delete on table public.professional_categories to authenticated;


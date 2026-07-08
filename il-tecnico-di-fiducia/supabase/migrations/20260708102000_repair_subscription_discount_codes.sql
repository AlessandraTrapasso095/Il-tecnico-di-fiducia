-- Repair migration: make subscription discount codes resilient on databases where
-- the first migration was marked as applied but table/columns were missing.

create table if not exists public.subscription_discount_codes (
  id uuid primary key default gen_random_uuid()
);

alter table public.subscription_discount_codes
  add column if not exists id uuid,
  add column if not exists stripe_coupon_id text,
  add column if not exists stripe_promotion_code_id text,
  add column if not exists code text,
  add column if not exists title text,
  add column if not exists percent_off integer,
  add column if not exists starts_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists applies_to_all boolean,
  add column if not exists professional_id uuid references public.profiles(id) on delete cascade,
  add column if not exists professional_email text,
  add column if not exists is_active boolean,
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

update public.subscription_discount_codes
set
  id = coalesce(id, gen_random_uuid()),
  stripe_coupon_id = coalesce(stripe_coupon_id, 'repair_coupon_' || coalesce(id::text, gen_random_uuid()::text)),
  stripe_promotion_code_id = coalesce(stripe_promotion_code_id, 'repair_promotion_' || coalesce(id::text, gen_random_uuid()::text)),
  code = coalesce(nullif(code, ''), 'REPAIR_' || upper(left(coalesce(id::text, gen_random_uuid()::text), 8))),
  title = coalesce(nullif(title, ''), 'Codice sconto importato'),
  percent_off = coalesce(percent_off, 10),
  applies_to_all = coalesce(applies_to_all, true),
  is_active = coalesce(is_active, false),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

alter table public.subscription_discount_codes
  alter column id set default gen_random_uuid(),
  alter column id set not null,
  alter column stripe_coupon_id set not null,
  alter column stripe_promotion_code_id set not null,
  alter column code set not null,
  alter column title set not null,
  alter column percent_off set not null,
  alter column applies_to_all set default true,
  alter column applies_to_all set not null,
  alter column is_active set default true,
  alter column is_active set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.subscription_discount_codes'::regclass
      and contype = 'p'
  ) then
    alter table public.subscription_discount_codes
      add constraint subscription_discount_codes_pkey primary key (id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'subscription_discount_codes_percent_off_check'
      and conrelid = 'public.subscription_discount_codes'::regclass
  ) then
    alter table public.subscription_discount_codes
      add constraint subscription_discount_codes_percent_off_check
      check (percent_off > 0 and percent_off <= 100);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'subscription_discount_codes_target_check'
      and conrelid = 'public.subscription_discount_codes'::regclass
  ) then
    alter table public.subscription_discount_codes
      add constraint subscription_discount_codes_target_check
      check (
        applies_to_all
        or professional_id is not null
        or professional_email is not null
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'subscription_discount_codes_validity_check'
      and conrelid = 'public.subscription_discount_codes'::regclass
  ) then
    alter table public.subscription_discount_codes
      add constraint subscription_discount_codes_validity_check
      check (expires_at is null or starts_at is null or expires_at > starts_at);
  end if;
end;
$$;

create unique index if not exists subscription_discount_codes_code_lower_uidx
on public.subscription_discount_codes (lower(code));

create index if not exists subscription_discount_codes_active_idx
on public.subscription_discount_codes (is_active, starts_at, expires_at);

create index if not exists subscription_discount_codes_professional_idx
on public.subscription_discount_codes (professional_id);

create index if not exists subscription_discount_codes_professional_email_idx
on public.subscription_discount_codes (lower(professional_email));

drop trigger if exists set_subscription_discount_codes_updated_at
on public.subscription_discount_codes;
create trigger set_subscription_discount_codes_updated_at
before update on public.subscription_discount_codes
for each row execute function public.tg_set_updated_at();

alter table public.subscription_discount_codes enable row level security;
alter table public.subscription_discount_codes force row level security;

drop policy if exists "Discount codes: admin read" on public.subscription_discount_codes;
create policy "Discount codes: admin read"
on public.subscription_discount_codes
for select
to authenticated
using ((select public.is_admin()));

drop policy if exists "Discount codes: admin insert" on public.subscription_discount_codes;
create policy "Discount codes: admin insert"
on public.subscription_discount_codes
for insert
to authenticated
with check ((select public.is_admin()));

drop policy if exists "Discount codes: admin update" on public.subscription_discount_codes;
create policy "Discount codes: admin update"
on public.subscription_discount_codes
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists "Discount codes: admin delete" on public.subscription_discount_codes;
create policy "Discount codes: admin delete"
on public.subscription_discount_codes
for delete
to authenticated
using ((select public.is_admin()));

drop policy if exists "Discount codes: professional read valid own" on public.subscription_discount_codes;
create policy "Discount codes: professional read valid own"
on public.subscription_discount_codes
for select
to authenticated
using (
  (select public.is_professional())
  and is_active
  and (starts_at is null or starts_at <= now())
  and (expires_at is null or expires_at > now())
  and (
    applies_to_all
    or professional_id = (select auth.uid())
    or lower(coalesce(professional_email, '')) = lower(
      coalesce((select p.email from public.profiles p where p.id = (select auth.uid())), '')
    )
  )
);

grant select, insert, update, delete on table public.subscription_discount_codes to authenticated;

notify pgrst, 'reload schema';

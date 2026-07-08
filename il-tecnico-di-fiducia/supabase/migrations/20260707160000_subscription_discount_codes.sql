-- Admin-managed Stripe promotion codes for professional subscriptions.

create table if not exists public.subscription_discount_codes (
  id uuid primary key default gen_random_uuid(),
  stripe_coupon_id text not null,
  stripe_promotion_code_id text not null,
  code text not null,
  title text not null,
  percent_off integer not null check (percent_off > 0 and percent_off <= 100),
  starts_at timestamptz,
  expires_at timestamptz,
  applies_to_all boolean not null default true,
  professional_id uuid references public.profiles(id) on delete cascade,
  professional_email text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_discount_codes_target_check check (
    applies_to_all
    or professional_id is not null
    or professional_email is not null
  ),
  constraint subscription_discount_codes_validity_check check (
    expires_at is null
    or starts_at is null
    or expires_at > starts_at
  )
);

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

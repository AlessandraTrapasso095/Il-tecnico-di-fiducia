create table if not exists public.profession_suggestions (
  id uuid primary key default gen_random_uuid(),
  profession_name text not null,
  proposer_first_name text not null,
  proposer_last_name text not null,
  proposer_email text not null,
  motivation text not null,
  suggested_subcategories text,
  status text not null default 'pending',
  payment_status text not null default 'paid',
  stripe_checkout_session_id text not null,
  stripe_payment_intent_id text,
  stripe_customer_id text,
  stripe_event_id text,
  amount_total integer,
  currency text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profession_suggestions_status_check
    check (status in ('pending', 'approved', 'rejected')),
  constraint profession_suggestions_payment_status_check
    check (payment_status in ('paid', 'refunded'))
);

alter table public.profession_suggestions
  add column if not exists profession_name text,
  add column if not exists proposer_first_name text,
  add column if not exists proposer_last_name text,
  add column if not exists proposer_email text,
  add column if not exists motivation text,
  add column if not exists suggested_subcategories text,
  add column if not exists status text default 'pending',
  add column if not exists payment_status text default 'paid',
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_event_id text,
  add column if not exists amount_total integer,
  add column if not exists currency text,
  add column if not exists paid_at timestamptz,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table public.profession_suggestions
  alter column profession_name set not null,
  alter column proposer_first_name set not null,
  alter column proposer_last_name set not null,
  alter column proposer_email set not null,
  alter column motivation set not null,
  alter column status set default 'pending',
  alter column status set not null,
  alter column payment_status set default 'paid',
  alter column payment_status set not null,
  alter column stripe_checkout_session_id set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

alter table public.profession_suggestions
  drop constraint if exists profession_suggestions_status_check,
  add constraint profession_suggestions_status_check
    check (status in ('pending', 'approved', 'rejected'));

alter table public.profession_suggestions
  drop constraint if exists profession_suggestions_payment_status_check,
  add constraint profession_suggestions_payment_status_check
    check (payment_status in ('paid', 'refunded'));

create unique index if not exists profession_suggestions_stripe_session_unique
  on public.profession_suggestions (stripe_checkout_session_id);

create unique index if not exists profession_suggestions_stripe_event_unique
  on public.profession_suggestions (stripe_event_id)
  where stripe_event_id is not null;

create index if not exists profession_suggestions_status_created_idx
  on public.profession_suggestions (status, created_at desc);

create index if not exists profession_suggestions_email_created_idx
  on public.profession_suggestions (proposer_email, created_at desc);

alter table public.profession_suggestions enable row level security;
alter table public.profession_suggestions force row level security;

drop policy if exists "Profession suggestions: admin read" on public.profession_suggestions;
create policy "Profession suggestions: admin read"
on public.profession_suggestions
for select
to authenticated
using ((select public.is_admin()));

drop policy if exists "Profession suggestions: admin update" on public.profession_suggestions;
create policy "Profession suggestions: admin update"
on public.profession_suggestions
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

grant select, update on table public.profession_suggestions to authenticated;

notify pgrst, 'reload schema';

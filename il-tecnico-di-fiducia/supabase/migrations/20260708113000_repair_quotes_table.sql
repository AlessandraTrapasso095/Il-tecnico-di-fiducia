-- Repair migration: ensure chat quotes/preventivi exist even when the original
-- migration was marked as applied but PostgREST cannot see the table.

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid()
);

alter table public.quotes
  add column if not exists conversation_id uuid,
  add column if not exists professional_id uuid,
  add column if not exists client_id uuid,
  add column if not exists customer_id uuid,
  add column if not exists description text,
  add column if not exists amount numeric(12, 2),
  add column if not exists discount_percentage integer,
  add column if not exists final_amount numeric(12, 2),
  add column if not exists status text,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz,
  add column if not exists accepted_at timestamptz,
  add column if not exists rejected_at timestamptz;

update public.quotes q
set
  professional_id = coalesce(q.professional_id, c.professional_id),
  client_id = coalesce(q.client_id, q.customer_id, c.customer_id),
  customer_id = coalesce(q.customer_id, q.client_id, c.customer_id)
from public.conversations c
where q.conversation_id = c.id;

update public.quotes
set
  id = coalesce(id, gen_random_uuid()),
  customer_id = coalesce(customer_id, client_id),
  client_id = coalesce(client_id, customer_id),
  description = coalesce(nullif(btrim(description), ''), 'Preventivo senza descrizione'),
  amount = coalesce(amount, 0),
  discount_percentage = coalesce(discount_percentage, 0),
  final_amount = coalesce(final_amount, coalesce(amount, 0)),
  status = coalesce(nullif(status, ''), 'pending'),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

alter table public.quotes
  alter column id set default gen_random_uuid(),
  alter column id set not null,
  alter column discount_percentage set default 0,
  alter column discount_percentage set not null,
  alter column status set default 'pending',
  alter column status set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

do $$
begin
  if not exists (select 1 from public.quotes where conversation_id is null) then
    alter table public.quotes alter column conversation_id set not null;
  end if;

  if not exists (select 1 from public.quotes where professional_id is null) then
    alter table public.quotes alter column professional_id set not null;
  end if;

  if not exists (select 1 from public.quotes where client_id is null) then
    alter table public.quotes alter column client_id set not null;
  end if;

  if not exists (select 1 from public.quotes where customer_id is null) then
    alter table public.quotes alter column customer_id set not null;
  end if;

  if not exists (select 1 from public.quotes where description is null) then
    alter table public.quotes alter column description set not null;
  end if;

  if not exists (select 1 from public.quotes where amount is null) then
    alter table public.quotes alter column amount set not null;
  end if;

  if not exists (select 1 from public.quotes where final_amount is null) then
    alter table public.quotes alter column final_amount set not null;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.quotes'::regclass
      and contype = 'p'
  ) then
    alter table public.quotes
      add constraint quotes_pkey primary key (id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'quotes_conversation_id_fkey'
      and conrelid = 'public.quotes'::regclass
  ) then
    alter table public.quotes
      add constraint quotes_conversation_id_fkey
      foreign key (conversation_id) references public.conversations(id)
      on delete cascade not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'quotes_professional_id_fkey'
      and conrelid = 'public.quotes'::regclass
  ) then
    alter table public.quotes
      add constraint quotes_professional_id_fkey
      foreign key (professional_id) references public.professional_profiles(id)
      on delete cascade not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'quotes_client_id_fkey'
      and conrelid = 'public.quotes'::regclass
  ) then
    alter table public.quotes
      add constraint quotes_client_id_fkey
      foreign key (client_id) references public.profiles(id)
      on delete cascade not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'quotes_customer_id_fkey'
      and conrelid = 'public.quotes'::regclass
  ) then
    alter table public.quotes
      add constraint quotes_customer_id_fkey
      foreign key (customer_id) references public.profiles(id)
      on delete cascade not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'quotes_description_not_empty'
      and conrelid = 'public.quotes'::regclass
  ) then
    alter table public.quotes
      add constraint quotes_description_not_empty
      check (length(btrim(description)) > 0) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'quotes_amount_positive'
      and conrelid = 'public.quotes'::regclass
  ) then
    alter table public.quotes
      add constraint quotes_amount_positive
      check (amount >= 0) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'quotes_discount_allowed'
      and conrelid = 'public.quotes'::regclass
  ) then
    alter table public.quotes
      add constraint quotes_discount_allowed
      check (discount_percentage in (0, 10, 20, 30, 40, 50)) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'quotes_final_amount_positive'
      and conrelid = 'public.quotes'::regclass
  ) then
    alter table public.quotes
      add constraint quotes_final_amount_positive
      check (final_amount >= 0) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'quotes_status_check'
      and conrelid = 'public.quotes'::regclass
  ) then
    alter table public.quotes
      add constraint quotes_status_check
      check (status in ('pending', 'accepted', 'rejected')) not valid;
  end if;
end;
$$;

create index if not exists quotes_conversation_created_idx
on public.quotes (conversation_id, created_at desc);

create index if not exists quotes_professional_created_idx
on public.quotes (professional_id, created_at desc);

create index if not exists quotes_client_created_idx
on public.quotes (client_id, created_at desc);

create index if not exists quotes_customer_created_idx
on public.quotes (customer_id, created_at desc);

create index if not exists quotes_status_idx
on public.quotes (status);

create or replace function public.tg_quotes_sync_customer_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.client_id is null then
    new.client_id := new.customer_id;
  end if;

  if new.customer_id is null then
    new.customer_id := new.client_id;
  end if;

  return new;
end;
$$;

drop trigger if exists a_quotes_sync_customer_columns on public.quotes;
create trigger a_quotes_sync_customer_columns
before insert or update on public.quotes
for each row execute function public.tg_quotes_sync_customer_columns();

drop trigger if exists set_quotes_updated_at on public.quotes;
create trigger set_quotes_updated_at
before update on public.quotes
for each row execute function public.tg_set_updated_at();

create or replace function public.tg_quotes_guard_mutations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid;
begin
  caller := auth.uid();

  if new.status = 'accepted' then
    new.accepted_at := coalesce(new.accepted_at, now());
    new.rejected_at := null;
  elsif new.status = 'rejected' then
    new.rejected_at := coalesce(new.rejected_at, now());
    new.accepted_at := null;
  else
    new.accepted_at := null;
    new.rejected_at := null;
  end if;

  if caller is null then
    return new;
  end if;

  if (select public.is_admin()) then
    return new;
  end if;

  if old.id is distinct from new.id then
    raise exception 'quotes.id is immutable';
  end if;
  if old.conversation_id is distinct from new.conversation_id then
    raise exception 'quotes.conversation_id is immutable';
  end if;
  if old.professional_id is distinct from new.professional_id then
    raise exception 'quotes.professional_id is immutable';
  end if;
  if old.client_id is distinct from new.client_id then
    raise exception 'quotes.client_id is immutable';
  end if;
  if old.customer_id is distinct from new.customer_id then
    raise exception 'quotes.customer_id is immutable';
  end if;
  if old.description is distinct from new.description then
    raise exception 'quotes.description is immutable after send';
  end if;
  if old.amount is distinct from new.amount then
    raise exception 'quotes.amount is immutable after send';
  end if;
  if old.discount_percentage is distinct from new.discount_percentage then
    raise exception 'quotes.discount_percentage is immutable after send';
  end if;
  if old.final_amount is distinct from new.final_amount then
    raise exception 'quotes.final_amount is immutable after send';
  end if;
  if old.created_at is distinct from new.created_at then
    raise exception 'quotes.created_at is immutable';
  end if;
  if old.status <> 'pending' and old.status is distinct from new.status then
    raise exception 'quotes already decided';
  end if;

  return new;
end;
$$;

drop trigger if exists b_quotes_guard_mutations on public.quotes;
drop trigger if exists a_quotes_guard_mutations on public.quotes;
create trigger b_quotes_guard_mutations
before update on public.quotes
for each row execute function public.tg_quotes_guard_mutations();

alter table public.quotes enable row level security;
alter table public.quotes force row level security;

drop policy if exists "Quotes: participants read" on public.quotes;
create policy "Quotes: participants read"
on public.quotes
for select
to authenticated
using (
  (select public.is_admin())
  or professional_id = (select auth.uid())
  or coalesce(client_id, customer_id) = (select auth.uid())
);

drop policy if exists "Quotes: professional insert accepted conversation" on public.quotes;
create policy "Quotes: professional insert accepted conversation"
on public.quotes
for insert
to authenticated
with check (
  (select public.is_professional())
  and professional_id = (select auth.uid())
  and status = 'pending'
  and exists (
    select 1
    from public.conversations c
    where c.id = conversation_id
      and c.professional_id = (select auth.uid())
      and c.customer_id = coalesce(client_id, customer_id)
      and c.status = 'accepted'
  )
);

drop policy if exists "Quotes: client decide pending" on public.quotes;
create policy "Quotes: client decide pending"
on public.quotes
for update
to authenticated
using (
  coalesce(client_id, customer_id) = (select auth.uid())
  and status = 'pending'
  and exists (
    select 1
    from public.conversations c
    where c.id = conversation_id
      and c.customer_id = (select auth.uid())
      and c.professional_id = professional_id
      and c.status = 'accepted'
  )
)
with check (
  coalesce(client_id, customer_id) = (select auth.uid())
  and status in ('accepted', 'rejected')
  and exists (
    select 1
    from public.conversations c
    where c.id = conversation_id
      and c.customer_id = (select auth.uid())
      and c.professional_id = professional_id
      and c.status = 'accepted'
  )
);

drop policy if exists "Quotes: admin update" on public.quotes;
create policy "Quotes: admin update"
on public.quotes
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

grant select, insert, update on table public.quotes to authenticated;

notify pgrst, 'reload schema';

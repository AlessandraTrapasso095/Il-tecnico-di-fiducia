-- Chat quotes/preventivi and review media.
-- No seed/demo data; every row is tied to real conversations, requests and users.

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  description text not null,
  amount numeric(12, 2) not null,
  discount_percentage int not null default 0,
  final_amount numeric(12, 2) not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  accepted_at timestamptz,
  rejected_at timestamptz,
  constraint quotes_description_not_empty check (length(btrim(description)) > 0),
  constraint quotes_amount_positive check (amount >= 0),
  constraint quotes_discount_allowed check (discount_percentage in (0, 10, 20, 30, 40, 50)),
  constraint quotes_final_amount_positive check (final_amount >= 0),
  constraint quotes_status_check check (status in ('pending', 'accepted', 'rejected'))
);

create index if not exists quotes_conversation_created_idx
on public.quotes (conversation_id, created_at desc);

create index if not exists quotes_professional_created_idx
on public.quotes (professional_id, created_at desc);

create index if not exists quotes_client_created_idx
on public.quotes (client_id, created_at desc);

create index if not exists quotes_status_idx
on public.quotes (status);

alter table public.quotes enable row level security;
alter table public.quotes force row level security;

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

drop trigger if exists a_quotes_guard_mutations on public.quotes;
create trigger a_quotes_guard_mutations
before update on public.quotes
for each row execute function public.tg_quotes_guard_mutations();

drop policy if exists "Quotes: participants read" on public.quotes;
create policy "Quotes: participants read"
on public.quotes
for select
to authenticated
using (
  (select public.is_admin())
  or professional_id = (select auth.uid())
  or client_id = (select auth.uid())
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
      and c.customer_id = client_id
      and c.status = 'accepted'
  )
);

drop policy if exists "Quotes: client decide pending" on public.quotes;
create policy "Quotes: client decide pending"
on public.quotes
for update
to authenticated
using (
  client_id = (select auth.uid())
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
  client_id = (select auth.uid())
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

alter table public.reviews
  add column if not exists title text not null default '';

create table if not exists public.review_attachments (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  bucket_id text not null default 'public-media',
  file_url text not null,
  file_path text,
  file_type text not null,
  mime_type text,
  file_name text,
  file_size bigint,
  created_at timestamptz not null default now(),
  constraint review_attachments_file_type_check check (file_type in ('image', 'video')),
  unique (bucket_id, file_path)
);

create index if not exists review_attachments_review_created_idx
on public.review_attachments (review_id, created_at);

create index if not exists review_attachments_customer_created_idx
on public.review_attachments (customer_id, created_at desc);

alter table public.review_attachments enable row level security;
alter table public.review_attachments force row level security;

drop policy if exists "Review attachments: readable with review" on public.review_attachments;
create policy "Review attachments: readable with review"
on public.review_attachments
for select
to authenticated
using (
  exists (
    select 1
    from public.reviews r
    where r.id = review_id
      and (
        (select public.is_admin())
        or r.customer_id = (select auth.uid())
        or r.professional_id = (select auth.uid())
        or (
          (select public.is_customer())
          and (select public.customer_can_view_professional(r.professional_id))
        )
        or (
          (select public.is_professional())
          and exists (
            select 1
            from public.professional_follows f
            where f.follower_id = (select auth.uid())
              and f.followed_id = r.professional_id
          )
        )
      )
  )
);

drop policy if exists "Review attachments: customer insert own review" on public.review_attachments;
create policy "Review attachments: customer insert own review"
on public.review_attachments
for insert
to authenticated
with check (
  customer_id = (select auth.uid())
  and exists (
    select 1
    from public.reviews r
    where r.id = review_id
      and r.customer_id = (select auth.uid())
  )
);

drop policy if exists "Review attachments: customer delete own review" on public.review_attachments;
create policy "Review attachments: customer delete own review"
on public.review_attachments
for delete
to authenticated
using (
  customer_id = (select auth.uid())
  and exists (
    select 1
    from public.reviews r
    where r.id = review_id
      and r.customer_id = (select auth.uid())
  )
);

grant select, insert, delete on table public.review_attachments to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'quotes'
    ) then
      alter publication supabase_realtime add table public.quotes;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'review_attachments'
    ) then
      alter publication supabase_realtime add table public.review_attachments;
    end if;
  end if;
end $$;

notify pgrst, 'reload schema';

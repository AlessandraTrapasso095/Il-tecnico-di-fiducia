alter table public.reviews
  add column if not exists request_id uuid,
  add column if not exists professional_id uuid,
  add column if not exists customer_id uuid,
  add column if not exists rating integer,
  add column if not exists title text,
  add column if not exists body text,
  add column if not exists professional_reply text,
  add column if not exists professional_replied_at timestamptz,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

update public.reviews
set title = coalesce(title, ''),
    body = coalesce(body, ''),
    created_at = coalesce(created_at, now()),
    updated_at = coalesce(updated_at, coalesce(created_at, now()));

alter table public.reviews
  alter column title set default '',
  alter column title set not null,
  alter column body set default '',
  alter column body set not null,
  alter column created_at set default now(),
  alter column updated_at set default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'reviews_rating_range'
      and conrelid = 'public.reviews'::regclass
  ) then
    alter table public.reviews
      add constraint reviews_rating_range check (rating between 1 and 5);
  end if;

  if not exists (
    select 1
    from pg_index i
    join pg_attribute a
      on a.attrelid = i.indrelid
     and a.attnum = any(i.indkey)
    where i.indrelid = 'public.reviews'::regclass
      and i.indisunique
      and a.attname = 'request_id'
  ) then
    alter table public.reviews
      add constraint reviews_request_unique unique (request_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'reviews_request_id_fkey'
      and conrelid = 'public.reviews'::regclass
  ) then
    alter table public.reviews
      add constraint reviews_request_id_fkey
      foreign key (request_id) references public.contact_requests(id)
      on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'reviews_professional_id_fkey'
      and conrelid = 'public.reviews'::regclass
  ) then
    alter table public.reviews
      add constraint reviews_professional_id_fkey
      foreign key (professional_id) references public.professional_profiles(id)
      on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'reviews_customer_id_fkey'
      and conrelid = 'public.reviews'::regclass
  ) then
    alter table public.reviews
      add constraint reviews_customer_id_fkey
      foreign key (customer_id) references public.profiles(id)
      on delete cascade;
  end if;
end $$;

create index if not exists reviews_professional_created_idx
on public.reviews (professional_id, created_at desc);

create index if not exists reviews_customer_created_idx
on public.reviews (customer_id, created_at desc);

create index if not exists reviews_request_idx
on public.reviews (request_id);

alter table public.reviews enable row level security;
alter table public.reviews force row level security;

grant select, insert, update, delete on table public.reviews to authenticated;

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
  created_at timestamptz not null default now()
);

alter table public.review_attachments
  add column if not exists review_id uuid,
  add column if not exists customer_id uuid,
  add column if not exists bucket_id text default 'public-media',
  add column if not exists file_url text,
  add column if not exists file_path text,
  add column if not exists file_type text,
  add column if not exists mime_type text,
  add column if not exists file_name text,
  add column if not exists file_size bigint,
  add column if not exists created_at timestamptz default now();

update public.review_attachments
set bucket_id = coalesce(bucket_id, 'public-media'),
    created_at = coalesce(created_at, now());

alter table public.review_attachments
  alter column review_id set not null,
  alter column customer_id set not null,
  alter column bucket_id set not null,
  alter column file_url set not null,
  alter column file_type set not null,
  alter column created_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'review_attachments_review_id_fkey'
      and conrelid = 'public.review_attachments'::regclass
  ) then
    alter table public.review_attachments
      add constraint review_attachments_review_id_fkey
      foreign key (review_id) references public.reviews(id)
      on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'review_attachments_customer_id_fkey'
      and conrelid = 'public.review_attachments'::regclass
  ) then
    alter table public.review_attachments
      add constraint review_attachments_customer_id_fkey
      foreign key (customer_id) references public.profiles(id)
      on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'review_attachments_file_type_check'
      and conrelid = 'public.review_attachments'::regclass
  ) then
    alter table public.review_attachments
      add constraint review_attachments_file_type_check
      check (file_type in ('image', 'video'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'review_attachments_bucket_path_key'
      and conrelid = 'public.review_attachments'::regclass
  ) then
    alter table public.review_attachments
      add constraint review_attachments_bucket_path_key
      unique (bucket_id, file_path);
  end if;
end $$;

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
        and tablename = 'review_attachments'
    ) then
      alter publication supabase_realtime add table public.review_attachments;
    end if;
  end if;
end $$;

select pg_notify('pgrst', 'reload schema');

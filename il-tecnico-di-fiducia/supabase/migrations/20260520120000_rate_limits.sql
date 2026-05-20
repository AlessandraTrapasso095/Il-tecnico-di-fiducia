-- Rate limiting primitives (DB-backed)
-- Goals:
-- - Provide a simple, DRY primitive that API routes can call to throttle abuse.
-- - Work without external services (Redis), suitable for early production.
-- - Keep the table private; access only through a SECURITY DEFINER function.

create table if not exists public.rate_limits (
  key text primary key,
  hits int not null,
  reset_at timestamptz not null,
  updated_at timestamptz not null default now()
);

-- Keep it private: no direct access for anon/authenticated.
revoke all on table public.rate_limits from public, anon, authenticated;

alter table public.rate_limits enable row level security;
alter table public.rate_limits force row level security;

-- No policies on purpose (table is internal).

create or replace function public.rate_limit_check(
  p_key text,
  p_max_hits int,
  p_window_seconds int
)
returns table(allowed boolean, remaining int, reset_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  now_ts timestamptz := now();
  new_hits int;
  new_reset timestamptz;
begin
  if p_key is null or length(p_key) < 3 then
    allowed := true;
    remaining := p_max_hits;
    reset_at := now_ts;
    return next;
    return;
  end if;

  if p_max_hits is null or p_max_hits < 1 or p_window_seconds is null or p_window_seconds < 1 then
    allowed := true;
    remaining := p_max_hits;
    reset_at := now_ts;
    return next;
    return;
  end if;

  insert into public.rate_limits (key, hits, reset_at, updated_at)
  values (p_key, 1, now_ts + make_interval(secs => p_window_seconds), now_ts)
  on conflict (key) do update
  set hits = case
      when public.rate_limits.reset_at <= now_ts then 1
      else public.rate_limits.hits + 1
    end,
    reset_at = case
      when public.rate_limits.reset_at <= now_ts then now_ts + make_interval(secs => p_window_seconds)
      else public.rate_limits.reset_at
    end,
    updated_at = now_ts
  returning public.rate_limits.hits, public.rate_limits.reset_at
  into new_hits, new_reset;

  allowed := (new_hits <= p_max_hits);
  remaining := greatest(p_max_hits - new_hits, 0);
  reset_at := new_reset;
  return next;
end;
$$;

-- Allow clients to call the function (it does not expose the underlying table).
grant execute on function public.rate_limit_check(text, int, int) to anon, authenticated;


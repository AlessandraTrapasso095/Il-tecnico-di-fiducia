-- Harden the internal DB-backed rate limiter.
--
-- rate_limit_check is an implementation detail of server API routes.
-- Clients must not be able to invoke it directly because callers can
-- supply the counter key, maximum hits and window duration.
--
-- The service role is used exclusively by the server-side helper.

revoke execute
on function public.rate_limit_check(text, int, int)
from public, anon, authenticated;

grant execute
on function public.rate_limit_check(text, int, int)
to service_role;

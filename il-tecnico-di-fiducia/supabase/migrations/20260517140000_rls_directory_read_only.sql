-- RLS audit: make directory tables read-only for non-admins
-- Rationale:
-- - `professional_directory` and `customer_directory` are derived "read models".
-- - They are kept in sync via security definer triggers from `profiles` / `professional_profiles`.
-- - Allowing users to UPDATE these tables directly would bypass that single source of truth and
--   can create inconsistent data.

-- Professional directory: remove owner update (keep admin update).
drop policy if exists "Professional directory: owner update" on public.professional_directory;

-- Customer directory: remove self update (keep admin update).
drop policy if exists "Customer directory: self update" on public.customer_directory;


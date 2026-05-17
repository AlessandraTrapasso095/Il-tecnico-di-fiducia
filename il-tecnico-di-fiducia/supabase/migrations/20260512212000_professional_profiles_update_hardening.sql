-- Professional profile hardening
-- Goal:
-- - Banned professionals must not be able to update their professional profile fields
--   (avatar/cover/bio/etc.) via direct API calls.

drop policy if exists "Professional profiles: owner update" on public.professional_profiles;
create policy "Professional profiles: owner update"
on public.professional_profiles
for update
to authenticated
using (
  (select public.is_professional())
  and id = (select auth.uid())
)
with check (
  (select public.is_professional())
  and id = (select auth.uid())
);


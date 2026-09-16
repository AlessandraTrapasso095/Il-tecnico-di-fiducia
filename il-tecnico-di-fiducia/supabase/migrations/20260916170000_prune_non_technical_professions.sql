-- Restrict the public profession taxonomy to technical professions.
--
-- Historical rows are intentionally preserved and only deactivated.
-- No currently assigned professional belongs to these categories as of
-- the migration impact audit performed before this migration.

do $$
declare
  removal_slugs text[] := array[
    'avvocati',
    'commercialisti',
    'consulenti-del-lavoro',
    'notai',
    'psicologi',
    'dietologi',
    'ctu-ctp'
  ];
begin
  update public.subcategories
  set
    is_active = false,
    updated_at = now()
  where category_id in (
    select id
    from public.categories
    where slug = any(removal_slugs)
  )
  and is_active = true;

  update public.categories
  set
    is_active = false,
    updated_at = now()
  where slug = any(removal_slugs)
    and is_active = true;
end
$$;

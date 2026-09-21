-- Canonical taxonomy for the eight active technical professions.
-- Non destructive:
-- - preserve/reuse existing rows whenever possible
-- - reassign linked profiles before deactivating duplicate rows
-- - never delete historical taxonomy rows

do $$
declare
  engineer_id categories.id%type;
  informatics_id categories.id%type;

  canonical_id uuid;
  legacy_id uuid;

  next_sort integer;
begin
  select id
  into engineer_id
  from public.categories
  where slug = 'ingegneri'
  limit 1;

  select id
  into informatics_id
  from public.categories
  where slug = 'informatici'
  limit 1;

  if engineer_id is null then
    raise exception 'Categoria ingegneri non trovata';
  end if;

  if informatics_id is null then
    raise exception 'Categoria informatici non trovata';
  end if;

  -------------------------------------------------------------------
  -- INGEGNERI
  -- Strutturista -> Ingegneria civile e strutturale
  -------------------------------------------------------------------

  select id
  into canonical_id
  from public.subcategories
  where category_id = engineer_id
    and slug = 'ingegneria-civile-e-strutturale'
  limit 1;

  select id
  into legacy_id
  from public.subcategories
  where category_id = engineer_id
    and slug = 'strutturista'
  limit 1;

  if canonical_id is null and legacy_id is not null then
    update public.subcategories
    set
      name = 'Ingegneria civile e strutturale',
      slug = 'ingegneria-civile-e-strutturale',
      is_active = true
    where id = legacy_id;

    canonical_id := legacy_id;

  elsif canonical_id is not null and legacy_id is not null then
    update public.professional_profiles
    set subcategory_id = canonical_id
    where subcategory_id = legacy_id;

    update public.professional_directory
    set subcategory_id = canonical_id
    where subcategory_id = legacy_id;

    update public.subcategories
    set is_active = false
    where id = legacy_id;
  end if;

  if canonical_id is null then
    select coalesce(max(sort_order), 0) + 10
    into next_sort
    from public.subcategories
    where category_id = engineer_id;

    insert into public.subcategories (
      category_id,
      name,
      slug,
      sort_order,
      is_active
    )
    values (
      engineer_id,
      'Ingegneria civile e strutturale',
      'ingegneria-civile-e-strutturale',
      next_sort,
      true
    );
  end if;

  -------------------------------------------------------------------
  -- Geotecnico -> Ingegneria geotecnica
  -- Preserve the existing row/id whenever the canonical row
  -- does not already exist.
  -------------------------------------------------------------------

  canonical_id := null;
  legacy_id := null;

  select id
  into canonical_id
  from public.subcategories
  where category_id = engineer_id
    and slug = 'ingegneria-geotecnica'
  limit 1;

  select id
  into legacy_id
  from public.subcategories
  where category_id = engineer_id
    and slug = 'geotecnico'
  limit 1;

  if canonical_id is null and legacy_id is not null then
    update public.subcategories
    set
      name = 'Ingegneria geotecnica',
      slug = 'ingegneria-geotecnica',
      is_active = true
    where id = legacy_id;

    canonical_id := legacy_id;

  elsif canonical_id is not null and legacy_id is not null then
    update public.professional_profiles
    set subcategory_id = canonical_id
    where subcategory_id = legacy_id;

    update public.professional_directory
    set subcategory_id = canonical_id
    where subcategory_id = legacy_id;

    update public.subcategories
    set is_active = false
    where id = legacy_id;
  end if;

  if canonical_id is null then
    select coalesce(max(sort_order), 0) + 10
    into next_sort
    from public.subcategories
    where category_id = engineer_id;

    insert into public.subcategories (
      category_id,
      name,
      slug,
      sort_order,
      is_active
    )
    values (
      engineer_id,
      'Ingegneria geotecnica',
      'ingegneria-geotecnica',
      next_sort,
      true
    );
  end if;

  -------------------------------------------------------------------
  -- Ingegneria edile
  -------------------------------------------------------------------

  if not exists (
    select 1
    from public.subcategories
    where category_id = engineer_id
      and slug = 'ingegneria-edile'
  ) then
    select coalesce(max(sort_order), 0) + 10
    into next_sort
    from public.subcategories
    where category_id = engineer_id;

    insert into public.subcategories (
      category_id,
      name,
      slug,
      sort_order,
      is_active
    )
    values (
      engineer_id,
      'Ingegneria edile',
      'ingegneria-edile',
      next_sort,
      true
    );
  else
    update public.subcategories
    set
      name = 'Ingegneria edile',
      is_active = true
    where category_id = engineer_id
      and slug = 'ingegneria-edile';
  end if;

  -------------------------------------------------------------------
  -- Pratiche sismiche
  -------------------------------------------------------------------

  if not exists (
    select 1
    from public.subcategories
    where category_id = engineer_id
      and slug = 'pratiche-sismiche'
  ) then
    select coalesce(max(sort_order), 0) + 10
    into next_sort
    from public.subcategories
    where category_id = engineer_id;

    insert into public.subcategories (
      category_id,
      name,
      slug,
      sort_order,
      is_active
    )
    values (
      engineer_id,
      'Pratiche sismiche',
      'pratiche-sismiche',
      next_sort,
      true
    );
  else
    update public.subcategories
    set
      name = 'Pratiche sismiche',
      is_active = true
    where category_id = engineer_id
      and slug = 'pratiche-sismiche';
  end if;

  -------------------------------------------------------------------
  -- Duplicate/non-canonical engineering aliases.
  -------------------------------------------------------------------

  update public.subcategories
  set is_active = false
  where category_id = engineer_id
    and slug in (
      'energetico',
      'sicurezza-cantieri'
    );

  -------------------------------------------------------------------
  -- INFORMATICI
  -- Canonicalize cybersecurity while preserving existing row/id.
  -------------------------------------------------------------------

  canonical_id := null;
  legacy_id := null;

  select id
  into canonical_id
  from public.subcategories
  where category_id = informatics_id
    and slug = 'cybersecurity-e-sicurezza-informatica'
  limit 1;

  select id
  into legacy_id
  from public.subcategories
  where category_id = informatics_id
    and slug = 'sicurezza-informatica'
  limit 1;

  if canonical_id is null and legacy_id is not null then
    update public.subcategories
    set
      name = 'Cybersecurity e sicurezza informatica',
      slug = 'cybersecurity-e-sicurezza-informatica',
      is_active = true
    where id = legacy_id;

    canonical_id := legacy_id;

  elsif canonical_id is not null and legacy_id is not null then
    update public.professional_profiles
    set subcategory_id = canonical_id
    where subcategory_id = legacy_id;

    update public.professional_directory
    set subcategory_id = canonical_id
    where subcategory_id = legacy_id;

    update public.subcategories
    set is_active = false
    where id = legacy_id;
  end if;

  -- Any old standalone "cybersecurity" alias is merged too.
  legacy_id := null;

  select id
  into legacy_id
  from public.subcategories
  where category_id = informatics_id
    and slug = 'cybersecurity'
  limit 1;

  if canonical_id is not null and legacy_id is not null then
    update public.professional_profiles
    set subcategory_id = canonical_id
    where subcategory_id = legacy_id;

    update public.professional_directory
    set subcategory_id = canonical_id
    where subcategory_id = legacy_id;

    update public.subcategories
    set is_active = false
    where id = legacy_id;
  elsif canonical_id is null and legacy_id is not null then
    update public.subcategories
    set
      name = 'Cybersecurity e sicurezza informatica',
      slug = 'cybersecurity-e-sicurezza-informatica',
      is_active = true
    where id = legacy_id;

    canonical_id := legacy_id;
  end if;

  if canonical_id is null then
    select coalesce(max(sort_order), 0) + 10
    into next_sort
    from public.subcategories
    where category_id = informatics_id;

    insert into public.subcategories (
      category_id,
      name,
      slug,
      sort_order,
      is_active
    )
    values (
      informatics_id,
      'Cybersecurity e sicurezza informatica',
      'cybersecurity-e-sicurezza-informatica',
      next_sort,
      true
    );
  end if;

  -------------------------------------------------------------------
  -- Missing canonical IT subcategories.
  -------------------------------------------------------------------

  insert into public.subcategories (
    category_id,
    name,
    slug,
    sort_order,
    is_active
  )
  select
    informatics_id,
    x.name,
    x.slug,
    (
      select coalesce(max(s.sort_order), 0)
      from public.subcategories s
      where s.category_id = informatics_id
    ) + x.position * 10,
    true
  from (
    values
      (1,  'Sviluppo siti web',        'sviluppo-siti-web'),
      (2,  'E-commerce',               'e-commerce'),
      (3,  'Web application',          'web-application'),
      (4,  'Software desktop',         'software-desktop'),
      (5,  'App Android',              'app-android'),
      (6,  'App iOS',                  'app-ios'),
      (7,  'Cloud e DevOps',           'cloud-e-devops'),
      (8,  'Networking',               'networking'),
      (9,  'Consulenza IT',            'consulenza-it'),
      (10, 'Domotica e IoT',           'domotica-e-iot'),
      (11, 'Computer Vision',           'computer-vision'),
      (12, 'Prompt Engineering',        'prompt-engineering')
  ) as x(position, name, slug)
  where not exists (
    select 1
    from public.subcategories existing
    where existing.category_id = informatics_id
      and existing.slug = x.slug
  );

  -------------------------------------------------------------------
  -- Ensure all canonical IT rows are active and correctly named.
  -------------------------------------------------------------------

  update public.subcategories
  set is_active = true
  where category_id = informatics_id
    and slug in (
      'sviluppo-siti-web',
      'e-commerce',
      'web-application',
      'software-desktop',
      'software-gestionali',
      'app-android',
      'app-ios',
      'app-multipiattaforma',
      'back-end-developer',
      'front-end-developer',
      'full-stack-web-developer',
      'api-e-integrazioni',
      'database-e-progettazione-dati',
      'cloud-e-devops',
      'cybersecurity-e-sicurezza-informatica',
      'networking',
      'sistemi-e-server',
      'virtualizzazione',
      'intelligenza-artificiale',
      'machine-learning',
      'ai-agents-e-automazioni',
      'data-science',
      'business-intelligence',
      'ui-ux-design',
      'seo-tecnica',
      'performance-e-ottimizzazione',
      'assistenza-informatica',
      'recupero-dati',
      'consulenza-it',
      'domotica-e-iot',
      'blockchain-e-smart-contract',
      'sviluppo-videogiochi',
      'computer-vision',
      'prompt-engineering'
    );
end
$$;

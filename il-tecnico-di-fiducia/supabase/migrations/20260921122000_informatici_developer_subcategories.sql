do $$
declare
  v_category_id categories.id%type;
  v_base_sort integer;
begin
  select id
  into v_category_id
  from categories
  where slug = 'informatici'
  limit 1;

  if v_category_id is null then
    raise exception 'Categoria informatici non trovata';
  end if;

  select coalesce(max(sort_order), 0)
  into v_base_sort
  from subcategories
  where category_id = v_category_id;

  -------------------------------------------------------------------
  -- FULL STACK WEB DEVELOPER
  -------------------------------------------------------------------

  if exists (
    select 1
    from subcategories
    where category_id = v_category_id
      and slug = 'full-stack-web-developer'
  ) then
    update subcategories
    set
      name = 'Full Stack Web Developer',
      is_active = true
    where category_id = v_category_id
      and slug = 'full-stack-web-developer';

  elsif exists (
    select 1
    from subcategories
    where category_id = v_category_id
      and slug = 'full-stack-development'
  ) then
    update subcategories
    set
      name = 'Full Stack Web Developer',
      slug = 'full-stack-web-developer',
      is_active = true
    where category_id = v_category_id
      and slug = 'full-stack-development';

  else
    insert into subcategories (
      category_id,
      name,
      slug,
      sort_order,
      is_active
    )
    values (
      v_category_id,
      'Full Stack Web Developer',
      'full-stack-web-developer',
      v_base_sort + 10,
      true
    );
  end if;

  -------------------------------------------------------------------
  -- FRONT END DEVELOPER
  -------------------------------------------------------------------

  if exists (
    select 1
    from subcategories
    where category_id = v_category_id
      and slug = 'front-end-developer'
  ) then
    update subcategories
    set
      name = 'Front End Developer',
      is_active = true
    where category_id = v_category_id
      and slug = 'front-end-developer';

  elsif exists (
    select 1
    from subcategories
    where category_id = v_category_id
      and slug = 'sviluppo-frontend'
  ) then
    update subcategories
    set
      name = 'Front End Developer',
      slug = 'front-end-developer',
      is_active = true
    where category_id = v_category_id
      and slug = 'sviluppo-frontend';

  else
    insert into subcategories (
      category_id,
      name,
      slug,
      sort_order,
      is_active
    )
    values (
      v_category_id,
      'Front End Developer',
      'front-end-developer',
      v_base_sort + 20,
      true
    );
  end if;

  -------------------------------------------------------------------
  -- BACK END DEVELOPER
  -------------------------------------------------------------------

  if exists (
    select 1
    from subcategories
    where category_id = v_category_id
      and slug = 'back-end-developer'
  ) then
    update subcategories
    set
      name = 'Back End Developer',
      is_active = true
    where category_id = v_category_id
      and slug = 'back-end-developer';

  elsif exists (
    select 1
    from subcategories
    where category_id = v_category_id
      and slug = 'sviluppo-backend'
  ) then
    update subcategories
    set
      name = 'Back End Developer',
      slug = 'back-end-developer',
      is_active = true
    where category_id = v_category_id
      and slug = 'sviluppo-backend';

  else
    insert into subcategories (
      category_id,
      name,
      slug,
      sort_order,
      is_active
    )
    values (
      v_category_id,
      'Back End Developer',
      'back-end-developer',
      v_base_sort + 30,
      true
    );
  end if;
end
$$;

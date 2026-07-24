alter table public.professional_profiles
  add column if not exists website_url text;

select pg_notify('pgrst', 'reload schema');

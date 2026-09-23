-- FASE 7 / 7.9.5
-- Titolo reale separato dal corpo per i post professionali.
-- Nullable per compatibilità con i post storici.

alter table public.posts
  add column if not exists title text;

alter table public.posts
  drop constraint if exists posts_title_length_check;

alter table public.posts
  add constraint posts_title_length_check
  check (
    title is null
    or char_length(title) <= 120
  );

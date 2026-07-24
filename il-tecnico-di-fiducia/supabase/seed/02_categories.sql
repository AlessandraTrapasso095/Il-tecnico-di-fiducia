-- Bootstrap minimale del catalogo professioni.
-- La tassonomia completa e le sottocategorie vengono mantenute da scripts/seed-profession-taxonomy.mjs.

insert into public.categories (name, slug, image_url, icon, sort_order, is_active) values
  ('Ingegneri', 'ingegneri', 'https://images.pexels.com/photos/6285142/pexels-photo-6285142.jpeg?auto=compress&cs=tinysrgb&w=900&h=620&fit=crop', 'engineering', 1000, true),
  ('Architetti', 'architetti', 'https://images.pexels.com/photos/6615294/pexels-photo-6615294.jpeg?auto=compress&cs=tinysrgb&w=900&h=620&fit=crop', 'architect', 2000, true),
  ('Geometri', 'geometri', 'https://images.pexels.com/photos/5802822/pexels-photo-5802822.jpeg?auto=compress&cs=tinysrgb&w=900&h=620&fit=crop', 'surveyor', 3000, true),
  ('Periti industriali', 'periti-industriali', 'https://images.pexels.com/photos/3862130/pexels-photo-3862130.jpeg?auto=compress&cs=tinysrgb&w=900&h=620&fit=crop', 'industrial', 4000, true),
  ('Geologi', 'geologi', 'https://images.pexels.com/photos/5691622/pexels-photo-5691622.jpeg?auto=compress&cs=tinysrgb&w=900&h=620&fit=crop', 'geology', 5000, true),
  ('Agronomi', 'agronomi', 'https://images.pexels.com/photos/2886937/pexels-photo-2886937.jpeg?auto=compress&cs=tinysrgb&w=900&h=620&fit=crop', 'agronomy', 6000, true),
  ('Dietologi', 'dietologi', 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=900&h=620&fit=crop', 'nutrition', 7000, true),
  ('Avvocati', 'avvocati', 'https://images.pexels.com/photos/6077123/pexels-photo-6077123.jpeg?auto=compress&cs=tinysrgb&w=900&h=620&fit=crop', 'law', 8000, true),
  ('Commercialisti', 'commercialisti', 'https://images.pexels.com/photos/669615/pexels-photo-669615.jpeg?auto=compress&cs=tinysrgb&w=900&h=620&fit=crop', 'accounting', 9000, true),
  ('Consulenti del lavoro', 'consulenti-del-lavoro', 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=900&h=620&fit=crop', 'work-consultant', 10000, true),
  ('Notai', 'notai', 'https://images.pexels.com/photos/5668473/pexels-photo-5668473.jpeg?auto=compress&cs=tinysrgb&w=900&h=620&fit=crop', 'notary', 11000, true),
  ('CTU - CTP', 'ctu-ctp', 'https://images.pexels.com/photos/5668858/pexels-photo-5668858.jpeg?auto=compress&cs=tinysrgb&w=900&h=620&fit=crop', 'ctu', 12000, true),
  ('Psicologi', 'psicologi', 'https://images.pexels.com/photos/4101143/pexels-photo-4101143.jpeg?auto=compress&cs=tinysrgb&w=900&h=620&fit=crop', 'psychology', 13000, true),
  ('Interior designer', 'interior-designer', 'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=900&h=620&fit=crop', 'interior', 14000, true),
  ('Informatici', 'informatici', 'https://images.pexels.com/photos/1181244/pexels-photo-1181244.jpeg?auto=compress&cs=tinysrgb&w=900&h=620&fit=crop', 'informatics', 15000, true)
on conflict (slug) do update set
  name = excluded.name,
  image_url = excluded.image_url,
  icon = excluded.icon,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

-- Dishes and ingredients the user asked not to be suggested again.

alter table public.profiles
  add column disliked_recipe_ids text[] not null default '{}';

alter table public.profiles
  add column disliked_ingredients jsonb not null default '[]';

alter table public.profiles
  add constraint profiles_disliked_ingredients_check
  check (jsonb_typeof(disliked_ingredients) = 'array');

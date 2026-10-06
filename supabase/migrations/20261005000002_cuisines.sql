-- Kitchen tags on recipes, and the kitchens a user wants preferred.

alter table public.recipes
  add column cuisines text[] not null default array['international'];

alter table public.recipes
  add constraint recipes_cuisines_check check (
    cardinality(cuisines) > 0
    and cuisines <@ array[
      'israeli', 'mizrahi', 'mediterranean', 'ashkenazi',
      'italian', 'asian', 'american', 'international'
    ]
  );

alter table public.profiles
  add column preferred_cuisines text[] not null
  default array['israeli', 'mizrahi', 'mediterranean'];

alter table public.profiles
  add constraint profiles_preferred_cuisines_check check (
    cardinality(preferred_cuisines) > 0
    and preferred_cuisines <@ array[
      'israeli', 'mizrahi', 'mediterranean', 'ashkenazi',
      'italian', 'asian', 'american', 'international'
    ]
  );

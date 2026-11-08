-- Diet is a hard meal filter. Cooking style only changes which fitting dish is preferred.
alter table public.profiles
  add column diet text not null default 'none'
    check (diet in ('none', 'vegetarian', 'vegan', 'pescatarian')),
  add column cooking_style text not null default 'balanced'
    check (cooking_style in ('simple', 'balanced', 'hearty'));

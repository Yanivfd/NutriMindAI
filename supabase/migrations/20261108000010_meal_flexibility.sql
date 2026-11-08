-- Skip lunch or dinner, eat more on weekends, and choose weigh-in days.
alter table public.profiles
  add column skips_lunch boolean not null default false,
  add column skips_dinner boolean not null default false,
  add column eats_more_on_weekends boolean not null default false,
  add column weigh_in_days text[] not null default array['sunday', 'wednesday']
    check (
      weigh_in_days <@ array['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    ),
  add constraint profiles_keep_one_meal
    check (not (skips_breakfast and skips_lunch and skips_dinner));

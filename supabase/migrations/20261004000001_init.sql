-- Initial schema: profiles, recipes, weekly_plans, weight_logs, cheat_logs.

-- ---------------------------------------------------------------------------
-- profiles (one row per auth user, created by the app during onboarding)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  birth_date date not null,
  sex text not null check (sex in ('male', 'female')),
  height_cm integer not null check (height_cm between 100 and 250),
  activity_level text not null default 'light'
    check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  start_weight_kg numeric(5,2) not null check (start_weight_kg between 30 and 400),
  current_weight_kg numeric(5,2) not null check (current_weight_kg between 30 and 400),
  target_weight_kg numeric(5,2) not null check (target_weight_kg between 30 and 400),
  daily_calorie_target integer not null default 1750 check (daily_calorie_target between 1000 and 5000),
  weekly_cheat_bank integer not null default 600 check (weekly_cheat_bank between 0 and 5000),
  skips_breakfast boolean not null default true,
  -- 'kosher' = kosher recipes only + meat/dairy separation; 'mehadrin' adds stricter
  -- product guidance (e.g. mehadrin certification, chalav Yisrael) in the grocery list.
  kosher_level text not null default 'none' check (kosher_level in ('none', 'kosher', 'mehadrin')),
  -- Hours to wait after a meat meal before dairy (custom varies by community).
  meat_dairy_wait_hours smallint not null default 6 check (meat_dairy_wait_hours in (1, 3, 6)),
  -- Usual meal times; used to enforce the meat -> dairy wait for kosher users.
  breakfast_time time not null default '08:00',
  lunch_time time not null default '13:00',
  snack_time time not null default '16:30',
  dinner_time time not null default '19:30',
  check (breakfast_time < lunch_time and lunch_time < dinner_time),
  office_days text[] not null default array['monday', 'wednesday']
    check (office_days <@ array['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ---------------------------------------------------------------------------
-- recipes (read-only catalog for clients; managed via seed / service role)
-- ---------------------------------------------------------------------------
create table public.recipes (
  id text primary key,
  title_he text not null,
  title_en text not null,
  prep_time_minutes integer not null check (prep_time_minutes > 0),
  meal_types text[] not null
    check (cardinality(meal_types) > 0 and meal_types <@ array['breakfast', 'lunch', 'dinner', 'snack']),
  calories integer not null check (calories > 0),
  protein_g integer not null check (protein_g >= 0),
  carbs_g integer not null check (carbs_g >= 0),
  fat_g integer not null check (fat_g >= 0),
  -- Array of {name_he, name_en, amount, unit, category, swaps[], insect_check?}
  -- Swaps must keep the recipe's kashrut_type (no dairy swaps in a meat recipe).
  ingredients jsonb not null check (jsonb_typeof(ingredients) = 'array'),
  instructions_he text[] not null,
  instructions_en text[] not null,
  image_url text,
  kashrut_type text not null check (kashrut_type in ('meat', 'dairy', 'parve')),
  -- Only kosher ingredients and no meat/dairy mixing.
  is_kosher boolean not null default true,
  -- Can be prepared before Shabbat and served cold or at room temperature.
  shabbat_friendly boolean not null default false,
  is_active boolean not null default true
);

create index recipes_active_idx on public.recipes (is_active) where is_active;

-- ---------------------------------------------------------------------------
-- weekly_plans (one plan per user per week; regenerating overwrites it)
-- ---------------------------------------------------------------------------
create table public.weekly_plans (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  week_start_date date not null,
  -- Validated schedule + aggregated grocery list produced by generate-weekly-menu
  plan_json jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, week_start_date)
);

-- ---------------------------------------------------------------------------
-- weight_logs (at most one weigh-in per user per day)
-- ---------------------------------------------------------------------------
create table public.weight_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  logged_on date not null default current_date,
  weight_kg numeric(5,2) not null check (weight_kg between 30 and 400),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, logged_on)
);

-- ---------------------------------------------------------------------------
-- cheat_logs (spending from the weekly cheat calorie bank)
-- ---------------------------------------------------------------------------
create table public.cheat_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  logged_at timestamp with time zone default timezone('utc'::text, now()) not null,
  kind text not null check (kind in ('sweet', 'beer', 'other')),
  calories integer not null check (calories between 1 and 5000),
  note text check (char_length(note) <= 200)
);

create index cheat_logs_user_logged_at_idx on public.cheat_logs (user_id, logged_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.recipes enable row level security;
alter table public.weekly_plans enable row level security;
alter table public.weight_logs enable row level security;
alter table public.cheat_logs enable row level security;

-- `(select auth.uid())` is evaluated once per statement instead of once per row.
create policy "Users can read/write their own profile" on public.profiles
  for all to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Recipes are readable by authenticated users" on public.recipes
  for select to authenticated
  using (true);

create policy "Users can read/write their own weekly plans" on public.weekly_plans
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can read/write their own weight logs" on public.weight_logs
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can read/write their own cheat logs" on public.cheat_logs
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Grants (explicit, so access doesn't depend on project default privileges)
-- ---------------------------------------------------------------------------
revoke all on public.profiles, public.recipes, public.weekly_plans,
  public.weight_logs, public.cheat_logs from anon;

grant select on public.recipes to authenticated;
grant select, insert, update, delete on public.profiles, public.weekly_plans,
  public.weight_logs, public.cheat_logs to authenticated;

-- User-chosen daily deficit pace for calorie targets (easy / steady / fast).

alter table public.profiles
  add column deficit_pace text not null default 'steady'
    check (deficit_pace in ('easy', 'steady', 'fast'));

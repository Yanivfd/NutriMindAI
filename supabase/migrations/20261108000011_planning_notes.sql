-- Optional free-text meal preferences. The planner may read them; calorie math does not.
alter table public.profiles
  add column planning_notes text not null default ''
    check (char_length(planning_notes) <= 500);

-- What the user actually ate for a planned slot. One row per day and slot.
-- Regenerating the week does not delete these rows.

create table public.meal_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  logged_on date not null,
  slot text not null check (slot in ('breakfast', 'lunch', 'snack', 'dinner')),
  status text not null check (status in ('planned', 'other')),
  calories integer not null check (calories between 0 and 5000),
  note text check (note is null or char_length(note) <= 400),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, logged_on, slot)
);

create index meal_logs_user_logged_on_idx on public.meal_logs (user_id, logged_on);

alter table public.meal_logs enable row level security;

create policy "Users can read/write their own meal logs" on public.meal_logs
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.meal_logs from anon;

grant select, insert, update, delete on public.meal_logs to authenticated;

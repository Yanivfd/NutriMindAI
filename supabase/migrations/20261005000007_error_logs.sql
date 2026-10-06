-- Client error reports from testers. The app may insert. Nobody can read them
-- with the app key; look at the rows in Studio (SQL editor) instead.

create table public.app_error_logs (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references auth.users on delete set null,
  message text not null check (char_length(message) between 1 and 500),
  stack text check (stack is null or char_length(stack) <= 4000),
  source text not null check (source in ('js', 'render', 'query', 'mutation', 'auth')),
  screen text not null default '' check (char_length(screen) <= 200),
  app_version text check (app_version is null or char_length(app_version) <= 40)
);

create index app_error_logs_created_at_idx on public.app_error_logs (created_at desc);

alter table public.app_error_logs enable row level security;

create policy "Signed-in users insert their own error logs" on public.app_error_logs
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Signed-out users insert anonymous error logs" on public.app_error_logs
  for insert to anon
  with check (user_id is null);

revoke all on public.app_error_logs from anon, authenticated;
grant insert on public.app_error_logs to anon, authenticated;

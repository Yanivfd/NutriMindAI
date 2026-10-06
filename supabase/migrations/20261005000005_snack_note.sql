-- A 40-word snack description needs more than the original 200-character note.

do $$
declare
  constraint_name text;
begin
  select con.conname into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'cheat_logs'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) like '%note%';

  if constraint_name is not null then
    execute format('alter table public.cheat_logs drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.cheat_logs
  add constraint cheat_logs_note_check
  check (note is null or char_length(note) <= 400);

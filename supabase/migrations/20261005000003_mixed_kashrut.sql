-- Allow dishes that combine meat and dairy. Those rows stay is_kosher = false,
-- so a kosher profile never receives them.

do $$
declare
  constraint_name text;
begin
  select con.conname into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'recipes'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) like '%kashrut_type%';

  if constraint_name is not null then
    execute format('alter table public.recipes drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.recipes
  add constraint recipes_kashrut_type_check
  check (kashrut_type in ('meat', 'dairy', 'parve', 'mixed'));

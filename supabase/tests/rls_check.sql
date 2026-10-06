-- Manual RLS smoke test. Run against the local DB; everything is rolled back.
begin;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.local');

insert into public.recipes (id, title_he, title_en, prep_time_minutes, meal_types, calories,
  protein_g, carbs_g, fat_g, ingredients, instructions_he, instructions_en, kashrut_type)
values ('r1', 'מתכון', 'Recipe', 10, array['lunch'], 400, 30, 40, 10, '[]', array['א'], array['a'], 'parve');

-- Act as user A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

insert into public.profiles (id, birth_date, sex, height_cm, start_weight_kg, current_weight_kg, target_weight_kg)
values ('11111111-1111-1111-1111-111111111111', '1990-01-01', 'male', 180, 90, 90, 80);
insert into public.weight_logs (user_id, weight_kg) values ('11111111-1111-1111-1111-111111111111', 89.5);
insert into public.cheat_logs (user_id, kind, calories) values ('11111111-1111-1111-1111-111111111111', 'beer', 150);

do $$ begin
  begin
    insert into public.profiles (id, birth_date, sex, height_cm, start_weight_kg, current_weight_kg, target_weight_kg)
    values ('22222222-2222-2222-2222-222222222222', '1990-01-01', 'male', 180, 90, 90, 80);
    raise exception 'FAIL: user A created a profile for user B';
  exception when insufficient_privilege then raise notice 'PASS: cannot create profile for another user';
  end;
  begin
    insert into public.recipes (id, title_he, title_en, prep_time_minutes, meal_types, calories,
      protein_g, carbs_g, fat_g, ingredients, instructions_he, instructions_en, kashrut_type)
    values ('r2', 'x', 'x', 1, array['lunch'], 1, 0, 0, 0, '[]', array['x'], array['x'], 'parve');
    raise exception 'FAIL: authenticated user wrote to recipes';
  exception when insufficient_privilege then raise notice 'PASS: recipes are read-only';
  end;
end $$;

select 'A sees recipes' as check, count(*) from public.recipes;
select 'A sees own profile' as check, count(*) from public.profiles;

-- Act as user B: must see none of A's rows
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select 'B sees A profile (expect 0)' as check, count(*) from public.profiles;
select 'B sees A weight logs (expect 0)' as check, count(*) from public.weight_logs;
select 'B sees A cheat logs (expect 0)' as check, count(*) from public.cheat_logs;
update public.profiles set target_weight_kg = 50;  -- should affect 0 rows

-- Anonymous: no table access at all
reset role;
set local role anon;
do $$ begin
  perform 1 from public.recipes;
  raise exception 'FAIL: anon can read recipes';
exception when insufficient_privilege then raise notice 'PASS: anon has no access';
end $$;

rollback;

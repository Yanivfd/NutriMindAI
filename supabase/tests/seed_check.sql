-- Validates the recipe catalog. Every query should return 0 rows except the summary.

\echo '--- calories vs macros (more than 5% off) ---'
select id, calories, 4 * protein_g + 4 * carbs_g + 9 * fat_g as from_macros
from public.recipes
where abs(calories - (4 * protein_g + 4 * carbs_g + 9 * fat_g)) > calories * 0.05;

\echo '--- prep time > 20 or calories outside 350-650 ---'
select id, prep_time_minutes, calories from public.recipes
where prep_time_minutes > 20 or calories not between 350 and 650;

\echo '--- he/en instruction count mismatch ---'
select id from public.recipes
where cardinality(instructions_he) <> cardinality(instructions_en) or cardinality(instructions_en) = 0;

\echo '--- malformed ingredients ---'
select r.id, i.value ->> 'name_en' as ingredient
from public.recipes r, jsonb_array_elements(r.ingredients) i
where not (i.value ?& array['name_he', 'name_en', 'amount', 'unit', 'category', 'swaps'])
  or jsonb_typeof(i.value -> 'amount') <> 'number'
  or (i.value ->> 'amount')::numeric <= 0
  or i.value ->> 'unit' not in ('g', 'ml', 'unit', 'tsp', 'clove', 'slice')
  or i.value ->> 'category' not in ('produce', 'dairy', 'meat_fish', 'bakery', 'pantry', 'frozen', 'beverages')
  or jsonb_typeof(i.value -> 'swaps') <> 'array';

\echo '--- malformed swaps ---'
select r.id, s.value ->> 'name_en' as swap
from public.recipes r, jsonb_array_elements(r.ingredients) i, jsonb_array_elements(i.value -> 'swaps') s
where not (s.value ?& array['name_he', 'name_en', 'amount', 'unit'])
  or s.value ->> 'unit' not in ('g', 'ml', 'unit', 'tsp', 'clove', 'slice');

\echo '--- same ingredient name with different categories (breaks grocery grouping) ---'
select i.value ->> 'name_en' as ingredient, array_agg(distinct i.value ->> 'category') as categories
from public.recipes r, jsonb_array_elements(r.ingredients) i
group by 1 having count(distinct i.value ->> 'category') > 1;

\echo '--- summary ---'
select kashrut_type, count(*), min(calories), max(calories) from public.recipes group by 1 order by 1;

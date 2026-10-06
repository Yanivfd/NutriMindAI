// Builds supabase/seed.sql from supabase/recipes/*.json.
// Run: node scripts/build-recipe-seed.mjs
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'supabase', 'recipes');

const CUISINES = [
  'israeli',
  'mizrahi',
  'mediterranean',
  'ashkenazi',
  'italian',
  'asian',
  'american',
  'international',
];
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];
const CATEGORIES = ['produce', 'dairy', 'meat_fish', 'bakery', 'pantry', 'frozen', 'beverages'];
const UNITS = ['g', 'ml', 'unit', 'tsp', 'clove', 'slice'];
const MEAT_WORDS = ['chicken', 'turkey', 'beef', 'lamb', 'schnitzel'];
const FISH_WORDS = ['salmon', 'tuna', 'fish'];
const DAIRY_WORDS = ['cheese', 'yogurt', 'yoghurt', 'milk', 'cottage', 'mozzarella', 'feta', 'butter', 'cream'];
const TREIF_WORDS = [
  'bacon',
  'ham',
  'pork',
  'sausage',
  'pepperoni',
  'prosciutto',
  'shrimp',
  'prawn',
  'crab',
  'lobster',
  'clam',
  'mussel',
  'oyster',
  'scallop',
];

function includesWord(name, words) {
  const text = name.toLowerCase();
  return words.some((word) => text.includes(word));
}

function checkIngredient(recipe, item, where) {
  const problems = [];
  if (!item.name_he || !item.name_en) problems.push(`${where} needs Hebrew and English names`);
  if (!Number.isFinite(item.amount) || item.amount <= 0) problems.push(`${where} amount must be positive`);
  if (!UNITS.includes(item.unit)) problems.push(`${where} has unknown unit ${item.unit}`);
  if (item.category && !CATEGORIES.includes(item.category)) {
    problems.push(`${where} has unknown category ${item.category}`);
  }
  const dairy = includesWord(item.name_en, DAIRY_WORDS);
  const meat = includesWord(item.name_en, MEAT_WORDS);
  const fish = includesWord(item.name_en, FISH_WORDS);
  const treif = includesWord(item.name_en, TREIF_WORDS);
  // Mixed dishes combine meat and dairy, so they are never kosher. The other
  // types still have to match their ingredients, even when the dish is not kosher.
  if (recipe.kashrut_type !== 'mixed') {
    if (recipe.kashrut_type === 'meat' && dairy) {
      problems.push(`${recipe.id} is meat but ${where} looks dairy (${item.name_en})`);
    }
    if (recipe.kashrut_type === 'dairy' && (meat || fish)) {
      problems.push(`${recipe.id} is dairy but ${where} looks like meat or fish (${item.name_en})`);
    }
    if (recipe.kashrut_type === 'parve' && (dairy || meat)) {
      problems.push(`${recipe.id} is parve but ${where} looks like meat or dairy (${item.name_en})`);
    }
  }
  if (recipe.is_kosher !== false && treif) {
    problems.push(`${recipe.id} is kosher but ${where} is not (${item.name_en})`);
  }
  return problems;
}

function validate(recipe) {
  const problems = [];
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(recipe.id)) problems.push(`${recipe.id} is not kebab-case`);
  if (!recipe.title_he || !recipe.title_en) problems.push(`${recipe.id} needs both titles`);
  if (recipe.prep_time_minutes > 20) problems.push(`${recipe.id} takes over 20 minutes`);
  if (!recipe.meal_types?.length || recipe.meal_types.some((s) => !MEAL_TYPES.includes(s))) {
    problems.push(`${recipe.id} has bad meal types`);
  }
  if (recipe.calories < 350 || recipe.calories > 650) problems.push(`${recipe.id} calories out of 350-650`);
  if (!recipe.cuisines?.length || recipe.cuisines.some((c) => !CUISINES.includes(c))) {
    problems.push(`${recipe.id} has bad cuisines`);
  }
  if (!['meat', 'dairy', 'parve', 'mixed'].includes(recipe.kashrut_type)) {
    problems.push(`${recipe.id} bad kashrut`);
  }
  if (recipe.kashrut_type === 'mixed' && recipe.is_kosher !== false) {
    problems.push(`${recipe.id} mixes meat and dairy, so it cannot be kosher`);
  }
  if (!recipe.ingredients?.length) problems.push(`${recipe.id} has no ingredients`);
  if (!recipe.instructions_he?.length || !recipe.instructions_en?.length) {
    problems.push(`${recipe.id} needs steps in both languages`);
  }
  for (const item of recipe.ingredients ?? []) {
    problems.push(...checkIngredient(recipe, item, item.name_en ?? 'ingredient'));
    for (const swap of item.swaps ?? []) problems.push(...checkIngredient(recipe, swap, `swap of ${item.name_en}`));
  }
  return problems;
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlArray(values) {
  return `array[${values.map(sqlString).join(', ')}]`;
}

const files = readdirSync(dir).filter((name) => name.endsWith('.json')).sort();
const recipes = files.map((name) => JSON.parse(readFileSync(join(dir, name), 'utf8')));
const problems = recipes.flatMap(validate);
const ids = new Set();
for (const recipe of recipes) {
  if (ids.has(recipe.id)) problems.push(`duplicate id ${recipe.id}`);
  ids.add(recipe.id);
}
if (problems.length > 0) {
  console.error(problems.join('\n'));
  process.exit(1);
}

const rows = recipes.map((recipe) => `(\n  ${[
  sqlString(recipe.id),
  sqlString(recipe.title_he),
  sqlString(recipe.title_en),
  String(recipe.prep_time_minutes),
  sqlArray(recipe.meal_types),
  String(recipe.calories),
  String(recipe.protein_g),
  String(recipe.carbs_g),
  String(recipe.fat_g),
  `$json$${JSON.stringify(recipe.ingredients)}$json$::jsonb`,
  sqlArray(recipe.instructions_he),
  sqlArray(recipe.instructions_en),
  sqlArray(recipe.cuisines),
  sqlString(recipe.kashrut_type),
  recipe.is_kosher === false ? 'false' : 'true',
  recipe.shabbat_friendly ? 'true' : 'false',
].join(',\n  ')}\n)`);

const sql = `-- Generated by scripts/build-recipe-seed.mjs from supabase/recipes/*.json.
-- Do not edit by hand. Re-run the script after changing a recipe file.
-- Idempotent: re-running updates existing rows.

insert into public.recipes (
  id, title_he, title_en, prep_time_minutes, meal_types, calories, protein_g, carbs_g, fat_g,
  ingredients, instructions_he, instructions_en, cuisines, kashrut_type, is_kosher, shabbat_friendly
) values
${rows.join(',\n')}
on conflict (id) do update set
  title_he = excluded.title_he,
  title_en = excluded.title_en,
  prep_time_minutes = excluded.prep_time_minutes,
  meal_types = excluded.meal_types,
  calories = excluded.calories,
  protein_g = excluded.protein_g,
  carbs_g = excluded.carbs_g,
  fat_g = excluded.fat_g,
  ingredients = excluded.ingredients,
  instructions_he = excluded.instructions_he,
  instructions_en = excluded.instructions_en,
  cuisines = excluded.cuisines,
  kashrut_type = excluded.kashrut_type,
  is_kosher = excluded.is_kosher,
  shabbat_friendly = excluded.shabbat_friendly;
`;

writeFileSync(join(root, 'supabase', 'seed.sql'), sql.replaceAll('\n', '\r\n'));
console.log(`wrote ${recipes.length} recipes to supabase/seed.sql`);

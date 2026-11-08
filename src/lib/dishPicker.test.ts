import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { RecipeRow } from '../types/db.ts';
import type { Ingredient, PlannedMeal, WeeklyPlanPayload } from '../types/plan.ts';

import { listDishes, portionForBudget, replaceMealInPlan } from './dishPicker.ts';
import type { PickerQuery } from './dishPicker.ts';

function ingredient(name: string, amount: number): Ingredient {
  return {
    name_he: name,
    name_en: name,
    amount,
    unit: 'g',
    category: 'pantry',
    swaps: [],
  };
}

function recipe(partial: Partial<RecipeRow> & Pick<RecipeRow, 'id' | 'calories'>): RecipeRow {
  return {
    title_he: partial.id,
    title_en: partial.id,
    prep_time_minutes: 15,
    meal_types: ['lunch'],
    protein_g: 20,
    carbs_g: 30,
    fat_g: 10,
    ingredients: [ingredient('Rice', 100)],
    instructions_he: [],
    instructions_en: [],
    image_url: null,
    kashrut_type: 'parve',
    cuisines: ['israeli'],
    is_kosher: true,
    shabbat_friendly: false,
    is_active: true,
    ...partial,
  };
}

function query(partial: Partial<PickerQuery> = {}): PickerQuery {
  return {
    slot: 'lunch',
    weekday: 'monday',
    budget: 600,
    kosherLevel: 'none',
    waitHours: 6,
    slotMinutes: 13 * 60,
    dayMeals: [],
    dislikedRecipeIds: [],
    dislikedIngredients: [],
    preferredCuisines: [],
    diet: 'none',
    ...partial,
  };
}

type RecipeMeal = Extract<PlannedMeal, { type: 'recipe' }>;

const lunch = (id: string, calories: number, extra: Partial<RecipeMeal> = {}): RecipeMeal => ({
  type: 'recipe',
  slot: 'lunch',
  time: '13:00',
  recipe_id: id,
  portion_multiplier: 1,
  calories,
  kashrut_type: 'parve',
  prepare_before_shabbat: false,
  ...extra,
});

test('portion stays on quarter steps between half and double', () => {
  assert.equal(portionForBudget(400, 600), 1.5);
  assert.equal(portionForBudget(100, 800), 2);
  assert.equal(portionForBudget(900, 300), 0.5);
});

test('list keeps the slot, drops the current dish, and prefers a close calorie match', () => {
  const snacks = recipe({ id: 'snack', meal_types: ['snack'], calories: 200 });
  const current = recipe({ id: 'current', calories: 600 });
  const close = recipe({ id: 'close', calories: 500, cuisines: ['italian'] });
  const other = recipe({ id: 'other', calories: 600 });
  const far = recipe({ id: 'far', calories: 120 });
  const list = listDishes(
    [snacks, current, far, other, close],
    query({ currentRecipeId: 'current', preferredCuisines: ['italian'] })
  );
  assert.equal(list.relaxed, false);
  assert.deepEqual(
    list.dishes.map((dish) => dish.recipe.id),
    ['close', 'other']
  );
  assert.equal(list.dishes[0].portion, 1.25);
  assert.equal(list.dishes[0].calories, 625);
});

test('kosher lists drop non-kosher dishes and dairy too soon after meat', () => {
  const meat = recipe({ id: 'meat', calories: 600, kashrut_type: 'meat' });
  const dairy = recipe({ id: 'dairy', calories: 600, kashrut_type: 'dairy' });
  const mixed = recipe({ id: 'mixed', calories: 600, is_kosher: false, kashrut_type: 'mixed' });
  const earlierMeat: PlannedMeal = {
    type: 'recipe',
    slot: 'breakfast',
    time: '08:00',
    recipe_id: 'eggs',
    portion_multiplier: 1,
    calories: 400,
    kashrut_type: 'meat',
    prepare_before_shabbat: false,
  };
  const list = listDishes(
    [meat, dairy, mixed],
    query({
      kosherLevel: 'kosher',
      waitHours: 6,
      slotMinutes: 13 * 60,
      dayMeals: [earlierMeat],
    })
  );
  assert.deepEqual(
    list.dishes.map((dish) => dish.recipe.id),
    ['meat']
  );
});

test('a Shabbat slot only offers prepare-ahead dishes', () => {
  const cold = recipe({ id: 'cold', calories: 600, shabbat_friendly: true });
  const hot = recipe({ id: 'hot', calories: 600, shabbat_friendly: false });
  const list = listDishes([cold, hot], query({ weekday: 'saturday', kosherLevel: 'kosher' }));
  assert.deepEqual(
    list.dishes.map((dish) => dish.recipe.id),
    ['cold']
  );
});

test('when nothing is close, the list falls back to every dish that fits the rules', () => {
  const tiny = recipe({ id: 'tiny', calories: 150 });
  const list = listDishes([tiny], query({ budget: 800 }));
  assert.equal(list.relaxed, true);
  assert.equal(list.dishes.length, 1);
});

test('replacing a meal resizes that slot and rebuilds the shopping list', () => {
  const soup = recipe({ id: 'soup', calories: 400, ingredients: [ingredient('Lentils', 80)] });
  const plate = recipe({ id: 'plate', calories: 500, ingredients: [ingredient('Chicken', 100)] });
  const plan: WeeklyPlanPayload = {
    week_start_date: '2026-11-01',
    generated_at: '2026-11-01T00:00:00Z',
    source: 'fallback',
    model: null,
    daily_food_target: 1600,
    weekly_cheat_bank: 700,
    kosher_level: 'none',
    meat_dairy_wait_hours: 6,
    days: [
      {
        date: '2026-11-02',
        weekday: 'monday',
        target_calories: 1600,
        total_calories: 400,
        meals: [lunch('soup', 400)],
      },
    ],
    grocery: [],
  };
  const next = replaceMealInPlan(plan, '2026-11-02', 'lunch', plate, new Map([['soup', soup]]));
  assert.ok(next);
  const meal = next.days[0].meals[0];
  assert.equal(meal.type, 'recipe');
  if (meal.type !== 'recipe') return;
  assert.equal(meal.recipe_id, 'plate');
  assert.equal(meal.portion_multiplier, 0.75);
  assert.equal(meal.calories, 375);
  assert.equal(next.days[0].total_calories, 375);
  assert.equal(next.grocery[0]?.items[0]?.name_en, 'Chicken');
  assert.equal(next.grocery[0]?.items[0]?.amount, 80);
});

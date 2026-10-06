import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dayEatenCalories, plannedMealCalories } from './mealLog.ts';
import type { PlannedMeal } from '../types/plan.ts';

test('the day ring stays on the plan until something is logged', () => {
  assert.equal(dayEatenCalories(1800, []), 1800);
});

test('logged calories replace the plan, and unmarked meals are not added', () => {
  assert.equal(dayEatenCalories(1800, [520, 0]), 520);
});

test('recipe and takeaway slots expose planned calories; quiet slots do not', () => {
  const recipe: PlannedMeal = {
    type: 'recipe',
    slot: 'lunch',
    time: '13:00',
    recipe_id: 'soup',
    portion_multiplier: 1,
    calories: 480,
    kashrut_type: 'parve',
    prepare_before_shabbat: false,
  };
  const takeaway: PlannedMeal = {
    type: 'takeaway',
    slot: 'lunch',
    time: '13:00',
    calories_budget: 600,
    kosher_only: false,
  };
  const skip: PlannedMeal = { type: 'skip', slot: 'breakfast', time: '08:00' };
  assert.equal(plannedMealCalories(recipe), 480);
  assert.equal(plannedMealCalories(takeaway), 600);
  assert.equal(plannedMealCalories(skip), null);
});

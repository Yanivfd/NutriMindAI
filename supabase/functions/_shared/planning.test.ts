import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { mergeDislikes, toPlanningProfile } from './planning.ts';
import type { ProfileRow } from './planning.ts';
import { normalizePlanningNotes, PLANNING_NOTES_MAX, recipeContainsIngredient } from './types.ts';
import { ing, recipe } from './testFixtures.ts';

describe('mergeDislikes', () => {
  it('adds a dish and skips duplicates', () => {
    const once = mergeDislikes(
      { disliked_recipe_ids: ['pasta'], disliked_ingredients: [] },
      { recipeId: 'sabich', dislikeDish: true, ingredients: [] }
    );
    assert.deepEqual(once.disliked_recipe_ids, ['pasta', 'sabich']);
    const twice = mergeDislikes(once, { recipeId: 'sabich', dislikeDish: true, ingredients: [] });
    assert.deepEqual(twice.disliked_recipe_ids, ['pasta', 'sabich']);
  });

  it('merges ingredients by name key', () => {
    const merged = mergeDislikes(
      {
        disliked_recipe_ids: [],
        disliked_ingredients: [{ name_en: 'Egg', name_he: 'ביצה' }],
      },
      {
        recipeId: 'omelette',
        dislikeDish: false,
        ingredients: [
          { name_en: '  egg  ', name_he: 'ביצה' },
          { name_en: 'Tomato', name_he: 'עגבנייה' },
        ],
      }
    );
    assert.equal(merged.disliked_ingredients.length, 2);
    assert.equal(merged.disliked_ingredients[1]?.name_en, 'Tomato');
  });
});

describe('normalizePlanningNotes', () => {
  it('trims blank notes and drops control characters', () => {
    assert.equal(normalizePlanningNotes('   '), '');
    assert.equal(normalizePlanningNotes(null), '');
    assert.equal(normalizePlanningNotes('  night shifts \n\n\n simple meals  '), 'night shifts\n\nsimple meals');
    assert.equal(normalizePlanningNotes('eggs\u0000 please'), 'eggs  please');
  });

  it('caps the note at the storage limit', () => {
    const long = 'א'.repeat(PLANNING_NOTES_MAX + 20);
    assert.equal(normalizePlanningNotes(long).length, PLANNING_NOTES_MAX);
  });
});

describe('toPlanningProfile', () => {
  it('keeps a cleaned planning note and does not invent one', () => {
    const row = {
      daily_calorie_target: 1800,
      weekly_cheat_bank: 700,
      skips_breakfast: true,
      skips_lunch: false,
      skips_dinner: false,
      eats_more_on_weekends: false,
      office_days: [],
      kosher_level: 'none',
      meat_dairy_wait_hours: 6,
      preferred_cuisines: [],
      disliked_recipe_ids: [],
      disliked_ingredients: [],
      breakfast_time: '08:00',
      lunch_time: '13:00',
      snack_time: '16:30',
      dinner_time: '19:30',
      planning_notes: '  simple meals  ',
      diet: 'vegan',
    } satisfies ProfileRow;
    assert.equal(toPlanningProfile(row).planning_notes, 'simple meals');
    assert.equal(toPlanningProfile({ ...row, planning_notes: null }).planning_notes, '');
    assert.equal(toPlanningProfile(row).daily_calorie_target, 1800);
    assert.equal(toPlanningProfile(row).diet, 'vegan');
    assert.equal(toPlanningProfile({ ...row, diet: 'nope' }).diet, 'none');
  });
});

describe('recipeContainsIngredient', () => {
  it('matches a swap as well as the listed ingredient', () => {
    const dish = recipe({
      id: 'wrap',
      title_en: 'Wrap',
      calories: 400,
      protein_g: 30,
      prep_time_minutes: 10,
      meal_types: ['lunch'],
      kashrut_type: 'meat',
      is_kosher: true,
      shabbat_friendly: false,
      ingredients: [
        {
          ...ing('Turkey breast', 150, 'g', 'meat_fish'),
          swaps: [{ name_he: 'חזה עוף', name_en: 'Chicken breast', amount: 150, unit: 'g' }],
        },
      ],
    });
    assert.equal(recipeContainsIngredient(dish, 'Chicken breast'), true);
    assert.equal(recipeContainsIngredient(dish, 'Tuna'), false);
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { aggregateGrocery, roundForShopping } from './grocery.ts';
import { RECIPES } from './testFixtures.ts';
import type { PlannedDay, PlannedMeal } from './types.ts';

const byId = new Map(RECIPES.map((r) => [r.id, r]));

const recipeMeal = (recipe_id: string, portion_multiplier: number): PlannedMeal => ({
  type: 'recipe',
  slot: 'lunch',
  time: '13:00',
  recipe_id,
  portion_multiplier,
  calories: 0,
  kashrut_type: byId.get(recipe_id)!.kashrut_type,
  prepare_before_shabbat: false,
});

const day = (meals: PlannedMeal[]): PlannedDay => ({
  date: '2026-10-04',
  weekday: 'sunday',
  target_calories: 0,
  total_calories: 0,
  meals,
});

describe('roundForShopping', () => {
  it('rounds weights and volumes up to shop-friendly steps', () => {
    assert.equal(roundForShopping(12, 'g'), 15);
    assert.equal(roundForShopping(50, 'ml'), 50);
    assert.equal(roundForShopping(151, 'g'), 160);
  });

  it('rounds countable units up to whole items and teaspoons to halves', () => {
    assert.equal(roundForShopping(2.25, 'unit'), 3);
    assert.equal(roundForShopping(3, 'clove'), 3);
    assert.equal(roundForShopping(1.2, 'tsp'), 1.5);
    assert.equal(roundForShopping(0.75 * 4, 'unit'), 3);
  });
});

describe('aggregateGrocery', () => {
  it('scales by portion and merges the same ingredient across recipes', () => {
    const sections = aggregateGrocery(
      [
        day([recipeMeal('shakshuka-feta', 1.5), recipeMeal('chicken-pita-tahini', 1)]),
        day([recipeMeal('chicken-pita-tahini', 0.5)]),
      ],
      byId
    );
    const find = (name: string) =>
      sections.flatMap((s) => s.items).find((i) => i.name_en === name);

    // Olive oil: 10 * 1.5 + 5 * 1 + 5 * 0.5 = 22.5 ml -> 25
    assert.equal(find('Olive oil')?.amount, 25);
    // Chicken: 150 * 1.5 = 225 g -> 230
    assert.equal(find('Chicken breast')?.amount, 230);
    // Eggs: 3 * 1.5 = 4.5 -> 5
    assert.equal(find('Eggs')?.amount, 5);
    assert.equal(find('Lettuce')?.insect_check, true);
    assert.equal(find('Eggs')?.insect_check, false);
  });

  it('groups by category in supermarket order and ignores non-recipe meals', () => {
    const sections = aggregateGrocery(
      [
        day([
          recipeMeal('chicken-pita-tahini', 1),
          recipeMeal('shakshuka-feta', 1),
          { type: 'takeaway', slot: 'lunch', time: '13:00', calories_budget: 600, kosher_only: true },
          { type: 'skip', slot: 'snack', time: '16:30' },
        ]),
      ],
      byId
    );
    assert.deepEqual(
      sections.map((s) => s.category),
      ['produce', 'dairy', 'meat_fish', 'pantry']
    );
    assert.deepEqual(
      sections[0].items.map((i) => i.name_en),
      ['Garlic', 'Lettuce']
    );
  });

  it('returns an empty list for an empty plan', () => {
    assert.deepEqual(aggregateGrocery([], byId), []);
  });
});

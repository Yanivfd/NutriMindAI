import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { foodFlags, recipeFitsDiet } from './diet.ts';
import { ing, recipe } from './testFixtures.ts';

const plate = (name: string) =>
  recipe({
    id: 'plate',
    title_en: 'Plate',
    calories: 400,
    protein_g: 20,
    prep_time_minutes: 10,
    meal_types: ['lunch'],
    kashrut_type: 'parve',
    is_kosher: true,
    shabbat_friendly: false,
    ingredients: [ing(name, 1, 'unit', 'produce')],
  });

describe('foodFlags', () => {
  it('does not treat eggplant as egg', () => {
    assert.equal(foodFlags(plate('Eggplant')).egg, false);
    assert.equal(recipeFitsDiet(plate('Eggplant'), 'vegan'), true);
  });

  it('sees egg, honey, mayonnaise, and a meat swap', () => {
    assert.equal(foodFlags(plate('Egg noodles')).egg, true);
    assert.equal(recipeFitsDiet(plate('Honey'), 'vegan'), false);
    assert.equal(recipeFitsDiet(plate('Mayonnaise'), 'vegan'), false);
    assert.equal(recipeFitsDiet(plate('Mayonnaise'), 'vegetarian'), true);
    const withSwap = plate('Rice');
    withSwap.ingredients[0].swaps = [
      { name_he: 'חזה עוף', name_en: 'Chicken breast', amount: 100, unit: 'g' },
    ];
    assert.equal(recipeFitsDiet(withSwap, 'pescatarian'), false);
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { mergeDislikes } from './planning.ts';
import { recipeContainsIngredient } from './types.ts';
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

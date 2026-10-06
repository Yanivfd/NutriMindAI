import { GROCERY_CATEGORIES } from './types.ts';
import type { GroceryItem, GrocerySection, PlannedDay, Recipe, Unit } from './types.ts';

const EPSILON = 1e-9;

function ceilTo(value: number, step: number): number {
  return Math.ceil(value / step - EPSILON) * step;
}

/** Rounds up to amounts that make sense on a shopping list. */
export function roundForShopping(amount: number, unit: Unit): number {
  switch (unit) {
    case 'g':
    case 'ml':
      return amount <= 50 ? ceilTo(amount, 5) : ceilTo(amount, 10);
    case 'unit':
    case 'clove':
    case 'slice':
      return ceilTo(amount, 1);
    case 'tsp':
      return ceilTo(amount, 0.5);
    default: {
      const _exhaustive: never = unit;
      return _exhaustive;
    }
  }
}

/**
 * Builds the weekly grocery list from the planned recipe meals, scaling each ingredient by
 * the meal's portion multiplier and merging identical ingredients (same name and unit).
 */
export function aggregateGrocery(
  days: PlannedDay[],
  recipesById: ReadonlyMap<string, Recipe>
): GrocerySection[] {
  const items = new Map<string, GroceryItem & { category: GrocerySection['category'] }>();

  for (const day of days) {
    for (const meal of day.meals) {
      if (meal.type !== 'recipe') continue;
      const recipe = recipesById.get(meal.recipe_id);
      if (!recipe) continue;
      for (const ingredient of recipe.ingredients) {
        const key = `${ingredient.category}|${ingredient.name_en.toLowerCase()}|${ingredient.unit}`;
        const existing = items.get(key);
        const amount = ingredient.amount * meal.portion_multiplier;
        if (existing) {
          existing.amount += amount;
          existing.insect_check ||= ingredient.insect_check === true;
        } else {
          items.set(key, {
            category: ingredient.category,
            name_he: ingredient.name_he,
            name_en: ingredient.name_en,
            amount,
            unit: ingredient.unit,
            insect_check: ingredient.insect_check === true,
          });
        }
      }
    }
  }

  return GROCERY_CATEGORIES.map((category) => ({
    category,
    items: [...items.values()]
      .filter((item) => item.category === category)
      .map(({ category: _category, ...item }) => ({
        ...item,
        amount: roundForShopping(item.amount, item.unit),
      }))
      .sort((a, b) => a.name_en.localeCompare(b.name_en)),
  })).filter((section) => section.items.length > 0);
}

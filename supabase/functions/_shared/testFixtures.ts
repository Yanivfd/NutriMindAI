import { CUISINES } from './types.ts';
import type { Ingredient, PlanningProfile, Recipe } from './types.ts';

export const ing = (
  name_en: string,
  amount: number,
  unit: Ingredient['unit'],
  category: Ingredient['category'],
  insect_check = false
): Ingredient => ({ name_he: name_en, name_en, amount, unit, category, swaps: [], insect_check });

export const recipe = (
  r: Omit<Recipe, 'ingredients' | 'cuisines'> & {
    ingredients?: Ingredient[];
    cuisines?: Recipe['cuisines'];
  }
): Recipe => ({
  ingredients: [],
  cuisines: ['international'],
  ...r,
});

/** Planning-relevant fields of supabase/seed.sql, plus one non-kosher recipe. */
export const RECIPES: Recipe[] = [
  recipe({ id: 'shakshuka-feta', title_en: 'Shakshuka', calories: 510, protein_g: 28, prep_time_minutes: 15, meal_types: ['lunch', 'dinner'], kashrut_type: 'dairy', is_kosher: true, shabbat_friendly: false,
    ingredients: [ing('Eggs', 3, 'unit', 'dairy'), ing('Garlic', 2, 'clove', 'produce'), ing('Olive oil', 10, 'ml', 'pantry')] }),
  recipe({ id: 'chicken-pita-tahini', title_en: 'Chicken pita', calories: 515, protein_g: 45, prep_time_minutes: 20, meal_types: ['lunch', 'dinner'], kashrut_type: 'meat', is_kosher: true, shabbat_friendly: true,
    ingredients: [ing('Chicken breast', 150, 'g', 'meat_fish'), ing('Lettuce', 30, 'g', 'produce', true), ing('Olive oil', 5, 'ml', 'pantry')] }),
  recipe({ id: 'tuna-chickpea-salad', title_en: 'Tuna salad', calories: 400, protein_g: 38, prep_time_minutes: 10, meal_types: ['lunch', 'dinner', 'snack'], kashrut_type: 'parve', is_kosher: true, shabbat_friendly: true }),
  recipe({ id: 'cottage-veggie-plate', title_en: 'Cottage plate', calories: 410, protein_g: 35, prep_time_minutes: 5, meal_types: ['breakfast', 'lunch', 'dinner', 'snack'], kashrut_type: 'dairy', is_kosher: true, shabbat_friendly: true }),
  recipe({ id: 'turkey-noodle-stirfry', title_en: 'Turkey stir-fry', calories: 496, protein_g: 42, prep_time_minutes: 20, meal_types: ['lunch', 'dinner'], kashrut_type: 'meat', is_kosher: true, shabbat_friendly: false }),
  recipe({ id: 'greek-yogurt-bowl', title_en: 'Yogurt bowl', calories: 436, protein_g: 22, prep_time_minutes: 5, meal_types: ['breakfast', 'snack'], kashrut_type: 'dairy', is_kosher: true, shabbat_friendly: true }),
  recipe({ id: 'salmon-sweet-potato', title_en: 'Salmon', calories: 484, protein_g: 34, prep_time_minutes: 20, meal_types: ['lunch', 'dinner'], kashrut_type: 'parve', is_kosher: true, shabbat_friendly: true }),
  recipe({ id: 'red-lentil-soup', title_en: 'Lentil soup', calories: 379, protein_g: 20, prep_time_minutes: 20, meal_types: ['lunch', 'dinner'], kashrut_type: 'parve', is_kosher: true, shabbat_friendly: false }),
  recipe({ id: 'pasta-tomato-mozzarella', title_en: 'Pasta', calories: 492, protein_g: 26, prep_time_minutes: 15, meal_types: ['lunch', 'dinner'], kashrut_type: 'dairy', is_kosher: true, shabbat_friendly: false }),
  recipe({ id: 'veggie-omelette-toast', title_en: 'Omelette', calories: 399, protein_g: 27, prep_time_minutes: 10, meal_types: ['breakfast', 'lunch', 'dinner', 'snack'], kashrut_type: 'parve', is_kosher: true, shabbat_friendly: false }),
  recipe({ id: 'cheeseburger', title_en: 'Cheeseburger', calories: 600, protein_g: 35, prep_time_minutes: 15, meal_types: ['lunch', 'dinner'], kashrut_type: 'meat', is_kosher: false, shabbat_friendly: false }),
];

export const baseProfile = (overrides: Partial<PlanningProfile> = {}): PlanningProfile => ({
  daily_calorie_target: 1750,
  weekly_cheat_bank: 600,
  skips_breakfast: true,
  office_days: ['monday', 'wednesday'],
  kosher_level: 'none',
  meat_dairy_wait_hours: 6,
  preferred_cuisines: [...CUISINES],
  disliked_recipe_ids: [],
  disliked_ingredients: [],
  meal_times: { breakfast: '08:00:00', lunch: '13:00:00', snack: '16:30:00', dinner: '19:30:00' },
  ...overrides,
});

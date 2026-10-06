import { addDays, currentWeekStart, isValidIsoDate, weekdayOf } from './planRules.ts';
import { ingredientKey } from './types.ts';
import type { DislikedIngredient, PlanningProfile } from './types.ts';

/** Profile columns the planner and dislike repair both need. */
export interface ProfileRow {
  daily_calorie_target: number;
  weekly_cheat_bank: number;
  skips_breakfast: boolean;
  office_days: PlanningProfile['office_days'];
  kosher_level: PlanningProfile['kosher_level'];
  meat_dairy_wait_hours: number;
  preferred_cuisines: PlanningProfile['preferred_cuisines'];
  disliked_recipe_ids: PlanningProfile['disliked_recipe_ids'];
  disliked_ingredients: PlanningProfile['disliked_ingredients'];
  breakfast_time: string;
  lunch_time: string;
  snack_time: string;
  dinner_time: string;
}

export const PROFILE_PLANNING_COLUMNS =
  'daily_calorie_target, weekly_cheat_bank, skips_breakfast, office_days, kosher_level, ' +
  'meat_dairy_wait_hours, preferred_cuisines, disliked_recipe_ids, disliked_ingredients, ' +
  'breakfast_time, lunch_time, snack_time, dinner_time';

/** Maps a profiles row to the fields `chooseRecipes` needs. */
export function toPlanningProfile(row: ProfileRow): PlanningProfile {
  return {
    daily_calorie_target: row.daily_calorie_target,
    weekly_cheat_bank: row.weekly_cheat_bank,
    skips_breakfast: row.skips_breakfast,
    office_days: row.office_days,
    kosher_level: row.kosher_level,
    meat_dairy_wait_hours: row.meat_dairy_wait_hours,
    preferred_cuisines: row.preferred_cuisines ?? [],
    disliked_recipe_ids: row.disliked_recipe_ids ?? [],
    disliked_ingredients: row.disliked_ingredients ?? [],
    meal_times: {
      breakfast: row.breakfast_time,
      lunch: row.lunch_time,
      snack: row.snack_time,
      dinner: row.dinner_time,
    },
  };
}

/** Accepts only the current or the next week (Sunday start). */
export function resolveWeekStart(body: unknown, now: Date): string | null {
  const current = currentWeekStart(now);
  const requested =
    typeof body === 'object' && body !== null && 'week_start_date' in body
      ? body.week_start_date
      : undefined;
  if (requested === undefined) return current;
  if (typeof requested !== 'string' || !isValidIsoDate(requested)) return null;
  if (weekdayOf(requested) !== 'sunday') return null;
  return requested === current || requested === addDays(current, 7) ? requested : null;
}

/** Adds a dish and/or ingredients to the saved dislike lists without duplicates. */
export function mergeDislikes(
  current: {
    disliked_recipe_ids: string[];
    disliked_ingredients: DislikedIngredient[];
  },
  input: { recipeId: string; dislikeDish: boolean; ingredients: DislikedIngredient[] }
): { disliked_recipe_ids: string[]; disliked_ingredients: DislikedIngredient[] } {
  const ids = [...(current.disliked_recipe_ids ?? [])];
  if (input.dislikeDish && !ids.includes(input.recipeId)) ids.push(input.recipeId);

  const ingredients = [...(current.disliked_ingredients ?? [])];
  const seen = new Set(ingredients.map((item) => ingredientKey(item.name_en)));
  for (const item of input.ingredients) {
    const key = ingredientKey(item.name_en);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    ingredients.push({ name_en: item.name_en.trim(), name_he: item.name_he.trim() });
  }
  return { disliked_recipe_ids: ids, disliked_ingredients: ingredients };
}

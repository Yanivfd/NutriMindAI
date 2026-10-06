export const WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const MEAL_SLOTS = ['breakfast', 'lunch', 'snack', 'dinner'] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

export const GROCERY_CATEGORIES = [
  'produce',
  'dairy',
  'meat_fish',
  'bakery',
  'pantry',
  'frozen',
  'beverages',
] as const;
export type GroceryCategory = (typeof GROCERY_CATEGORIES)[number];

export type Unit = 'g' | 'ml' | 'unit' | 'tsp' | 'clove' | 'slice';
export type KashrutType = 'meat' | 'dairy' | 'parve' | 'mixed';

export const CUISINES = [
  'israeli',
  'mizrahi',
  'mediterranean',
  'ashkenazi',
  'italian',
  'asian',
  'american',
  'international',
] as const;
export type Cuisine = (typeof CUISINES)[number];
export type KosherLevel = 'none' | 'kosher' | 'mehadrin';

export interface IngredientSwap {
  name_he: string;
  name_en: string;
  amount: number;
  unit: Unit;
}

export interface Ingredient extends IngredientSwap {
  category: GroceryCategory;
  swaps: IngredientSwap[];
  insect_check?: boolean;
}

export interface Recipe {
  id: string;
  title_en: string;
  calories: number;
  protein_g: number;
  prep_time_minutes: number;
  meal_types: MealSlot[];
  kashrut_type: KashrutType;
  is_kosher: boolean;
  shabbat_friendly: boolean;
  /** Kitchens this dish belongs to. A recipe can belong to more than one. */
  cuisines: Cuisine[];
  ingredients: Ingredient[];
}

/** Profile fields the planner needs. Meal times are 'HH:MM' or 'HH:MM:SS'. */
export interface PlanningProfile {
  daily_calorie_target: number;
  weekly_cheat_bank: number;
  skips_breakfast: boolean;
  office_days: Weekday[];
  kosher_level: KosherLevel;
  meat_dairy_wait_hours: number;
  /** Kitchens to prefer. Empty means no preference. */
  preferred_cuisines: Cuisine[];
  /** Recipe ids the user asked never to see again. */
  disliked_recipe_ids: string[];
  /** Ingredient names the user asked never to see again. Match is on name_en. */
  disliked_ingredients: DislikedIngredient[];
  meal_times: Record<MealSlot, string>;
}

/** An ingredient the user does not want, stored in both languages for the profile list. */
export interface DislikedIngredient {
  name_en: string;
  name_he: string;
}

/** Comparison key for an ingredient name: case and extra spaces do not matter. */
export function ingredientKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** True when this dish lists the ingredient as a main item or as a swap. */
export function recipeContainsIngredient(recipe: Recipe, nameEn: string): boolean {
  const key = ingredientKey(nameEn);
  if (!key) return false;
  return (recipe.ingredients ?? []).some(
    (item) =>
      ingredientKey(item.name_en) === key ||
      (item.swaps ?? []).some((swap) => ingredientKey(swap.name_en) === key)
  );
}

/**
 * True when the user blocked this dish, or any of its ingredients or swaps.
 * A swap counts because the grocery list can still ask for that food.
 */
export function isRecipeBlocked(
  recipe: Recipe,
  profile: Pick<PlanningProfile, 'disliked_recipe_ids' | 'disliked_ingredients'>
): boolean {
  if ((profile.disliked_recipe_ids ?? []).includes(recipe.id)) return true;
  const blocked = new Set(
    (profile.disliked_ingredients ?? []).map((item) => ingredientKey(item.name_en))
  );
  if (blocked.size === 0) return false;
  return (recipe.ingredients ?? []).some(
    (item) =>
      blocked.has(ingredientKey(item.name_en)) ||
      (item.swaps ?? []).some((swap) => blocked.has(ingredientKey(swap.name_en)))
  );
}

/** What the model is asked for: only which recipe goes in which slot. */
export interface ModelSuggestion {
  day: Weekday;
  slot: MealSlot;
  recipe_id: string;
}

export type PlannedMeal =
  | {
      type: 'recipe';
      slot: MealSlot;
      time: string;
      recipe_id: string;
      portion_multiplier: number;
      calories: number;
      kashrut_type: KashrutType;
      prepare_before_shabbat: boolean;
    }
  | { type: 'takeaway'; slot: MealSlot; time: string; calories_budget: number; kosher_only: boolean }
  | { type: 'skip'; slot: MealSlot; time: string }
  | { type: 'unavailable'; slot: MealSlot; time: string };

export interface PlannedDay {
  date: string;
  weekday: Weekday;
  target_calories: number;
  total_calories: number;
  meals: PlannedMeal[];
}

export interface GroceryItem {
  name_he: string;
  name_en: string;
  amount: number;
  unit: Unit;
  insect_check: boolean;
}

export interface GrocerySection {
  category: GroceryCategory;
  items: GroceryItem[];
}

export interface WeeklyPlanPayload {
  week_start_date: string;
  generated_at: string;
  source: 'ai' | 'fallback';
  model: string | null;
  daily_food_target: number;
  weekly_cheat_bank: number;
  kosher_level: KosherLevel;
  meat_dairy_wait_hours: number;
  days: PlannedDay[];
  grocery: GrocerySection[];
}

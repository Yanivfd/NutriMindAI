import { aggregateGrocery } from '../../supabase/functions/_shared/grocery.ts';
import { isShabbatSlot, roundPortion } from '../../supabase/functions/_shared/planRules.ts';
import type { RecipeRow } from '../types/db.ts';
import type {
  Cuisine,
  DislikedIngredient,
  KosherLevel,
  MealSlot,
  PlannedDay,
  PlannedMeal,
  Recipe,
  Weekday,
  WeeklyPlanPayload,
} from '../types/plan.ts';
import { isRecipeBlocked } from '../types/plan.ts';

import { plannedMealCalories } from './mealLog.ts';

/** A listed dish, already sized to the slot's calorie budget. */
export interface PickerDish {
  recipe: RecipeRow;
  portion: number;
  calories: number;
}

export interface PickerQuery {
  slot: MealSlot;
  weekday: Weekday;
  /** Calories this slot was planned around. */
  budget: number;
  kosherLevel: KosherLevel;
  /** Hours to wait between meat and dairy. Ignored when the user is not kosher. */
  waitHours: number;
  slotMinutes: number;
  dayMeals: readonly PlannedMeal[];
  dislikedRecipeIds: readonly string[];
  dislikedIngredients: readonly DislikedIngredient[];
  preferredCuisines: readonly Cuisine[];
  /** The dish already in this slot, so the list offers something else. */
  currentRecipeId?: string;
}

export interface PickerList {
  dishes: PickerDish[];
  /** True when nothing landed near the budget, so the list is every dish that fits the rules. */
  relaxed: boolean;
}

/** How far a sized portion may sit from the slot budget and still count as close. */
const CALORIE_SLACK = 0.35;

/** 'HH:MM' or 'HH:MM:SS' to minutes from midnight. Invalid times sort as 0. */
export function minutesOf(time: string): number {
  const match = /^(\d{2}):(\d{2})/.exec(time);
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Portion steps that land the recipe as close as possible to the slot budget. */
export function portionForBudget(recipeCalories: number, budget: number): number {
  if (!Number.isFinite(recipeCalories) || recipeCalories <= 0) return 1;
  if (!Number.isFinite(budget) || budget <= 0) return 1;
  return roundPortion(budget / recipeCalories);
}

function sizedCalories(recipeCalories: number, budget: number): number {
  return Math.round(recipeCalories * portionForBudget(recipeCalories, budget));
}

function roughlyFits(recipeCalories: number, budget: number): boolean {
  if (budget <= 0) return true;
  const got = sizedCalories(recipeCalories, budget);
  return got >= budget * (1 - CALORIE_SLACK) && got <= budget * (1 + CALORIE_SLACK);
}

function needsShabbat(query: PickerQuery, meal: PlannedMeal | undefined): boolean {
  if (query.kosherLevel === 'none') return false;
  if (meal?.type === 'recipe' && meal.prepare_before_shabbat) return true;
  return isShabbatSlot(query.weekday, query.slot);
}

/** Takeaway counts as meat, matching the weekly planner. */
function isMeatMeal(meal: PlannedMeal): boolean {
  if (meal.type === 'takeaway') return true;
  return meal.type === 'recipe' && meal.kashrut_type === 'meat';
}

function breaksWait(recipe: RecipeRow, query: PickerQuery): boolean {
  if (query.kosherLevel === 'none') return false;
  const wait = query.waitHours * 60;
  if (recipe.kashrut_type === 'dairy') {
    return query.dayMeals.some((meal) => {
      if (meal.slot === query.slot || !isMeatMeal(meal)) return false;
      const earlier = minutesOf(meal.time);
      return earlier <= query.slotMinutes && query.slotMinutes - earlier < wait;
    });
  }
  if (recipe.kashrut_type === 'meat') {
    return query.dayMeals.some((meal) => {
      if (meal.slot === query.slot || meal.type !== 'recipe' || meal.kashrut_type !== 'dairy') {
        return false;
      }
      const later = minutesOf(meal.time);
      return later >= query.slotMinutes && later - query.slotMinutes < wait;
    });
  }
  return false;
}

function allowed(recipe: RecipeRow, query: PickerQuery, meal: PlannedMeal | undefined): boolean {
  if (!recipe.is_active || !recipe.meal_types.includes(query.slot)) return false;
  if (recipe.id === query.currentRecipeId) return false;
  if (query.kosherLevel !== 'none' && !recipe.is_kosher) return false;
  if (needsShabbat(query, meal) && !recipe.shabbat_friendly) return false;
  if (breaksWait(recipe, query)) return false;
  return !isRecipeBlocked(recipe, {
    disliked_recipe_ids: [...query.dislikedRecipeIds],
    disliked_ingredients: [...query.dislikedIngredients],
  });
}

/** Query for the dish list of one planned meal. */
export function pickerQuery(input: {
  meal: PlannedMeal;
  weekday: Weekday;
  dayMeals: readonly PlannedMeal[];
  kosherLevel: KosherLevel;
  waitHours: number;
  dislikedRecipeIds: readonly string[];
  dislikedIngredients: readonly DislikedIngredient[];
  preferredCuisines: readonly Cuisine[];
}): PickerQuery {
  return {
    slot: input.meal.slot,
    weekday: input.weekday,
    budget: plannedMealCalories(input.meal) ?? 0,
    kosherLevel: input.kosherLevel,
    waitHours: input.waitHours,
    slotMinutes: minutesOf(input.meal.time),
    dayMeals: input.dayMeals,
    dislikedRecipeIds: input.dislikedRecipeIds,
    dislikedIngredients: input.dislikedIngredients,
    preferredCuisines: input.preferredCuisines,
    currentRecipeId: input.meal.type === 'recipe' ? input.meal.recipe_id : undefined,
  };
}

function byFit(query: PickerQuery) {
  const preferred = query.preferredCuisines;
  return (a: PickerDish, b: PickerDish): number => {
    const rank = (recipe: RecipeRow): number =>
      preferred.length === 0 || recipe.cuisines.some((cuisine) => preferred.includes(cuisine)) ? 0 : 1;
    return (
      rank(a.recipe) - rank(b.recipe) ||
      Math.abs(a.calories - query.budget) - Math.abs(b.calories - query.budget) ||
      a.recipe.title_en.localeCompare(b.recipe.title_en)
    );
  };
}

/**
 * Recipes the user can cook for this slot: right meal type, kashrut, Shabbat, meat/dairy
 * wait, and not a blocked dish. Prefers dishes whose sized portion is near the budget.
 */
export function listDishes(
  recipes: readonly RecipeRow[],
  query: PickerQuery,
  meal?: PlannedMeal
): PickerList {
  const fitting = recipes.filter((recipe) => allowed(recipe, query, meal));
  const toDish = (recipe: RecipeRow): PickerDish => ({
    recipe,
    portion: portionForBudget(recipe.calories, query.budget),
    calories: sizedCalories(recipe.calories, query.budget),
  });
  const close = fitting.filter((recipe) => roughlyFits(recipe.calories, query.budget)).map(toDish);
  if (close.length > 0) return { dishes: close.sort(byFit(query)), relaxed: false };
  return { dishes: fitting.map(toDish).sort(byFit(query)), relaxed: fitting.length > 0 };
}

function dayTotal(meals: readonly PlannedMeal[]): number {
  return meals.reduce((sum, meal) => sum + (plannedMealCalories(meal) ?? 0), 0);
}

/**
 * Swaps one slot for a chosen recipe, sizes the portion to the slot's current budget,
 * and rebuilds the shopping list. Skip and empty slots are left unchanged.
 */
export function replaceMealInPlan(
  plan: WeeklyPlanPayload,
  date: string,
  slot: MealSlot,
  recipe: Recipe,
  recipes: ReadonlyMap<string, Recipe>
): WeeklyPlanPayload | null {
  const dayIndex = plan.days.findIndex((day) => day.date === date);
  if (dayIndex < 0) return null;
  const day = plan.days[dayIndex];
  const mealIndex = day.meals.findIndex((meal) => meal.slot === slot);
  if (mealIndex < 0) return null;
  const meal = day.meals[mealIndex];
  const budget = plannedMealCalories(meal);
  if (budget === null) return null;

  const portion = portionForBudget(recipe.calories, budget);
  const shabbat =
    meal.type === 'recipe'
      ? meal.prepare_before_shabbat
      : plan.kosher_level !== 'none' && isShabbatSlot(day.weekday, slot);
  const nextMeal: PlannedMeal = {
    type: 'recipe',
    slot,
    time: meal.time,
    recipe_id: recipe.id,
    portion_multiplier: portion,
    calories: Math.round(recipe.calories * portion),
    kashrut_type: recipe.kashrut_type,
    prepare_before_shabbat: shabbat,
  };
  const meals = day.meals.map((item, index) => (index === mealIndex ? nextMeal : item));
  const days: PlannedDay[] = plan.days.map((item, index) =>
    index === dayIndex ? { ...item, meals, total_calories: dayTotal(meals) } : item
  );
  const byId = new Map(recipes);
  byId.set(recipe.id, recipe);
  return { ...plan, days, grocery: aggregateGrocery(days, byId) };
}

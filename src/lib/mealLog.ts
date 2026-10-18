import type { PlannedMeal } from '../types/plan.ts';

/**
 * Calories for the day ring and overflow alerts.
 * Only logged meals count — the day starts at 0 until the user checks in.
 * Unmarked planned meals are not counted as eaten.
 */
export function dayEatenCalories(loggedCalories: readonly number[]): number {
  return loggedCalories.reduce((sum, calories) => sum + calories, 0);
}

/** How far over the daily target; 0 when on or under budget. */
export function dayCalorieOverage(eaten: number, target: number): number {
  if (!Number.isFinite(eaten) || eaten <= 0) return 0;
  if (!Number.isFinite(target) || target <= 0) return Math.max(0, Math.round(eaten));
  return Math.max(0, Math.round(eaten - target));
}

/** Planned calories for a meal the user can check in. Skip slots have none. */
export function plannedMealCalories(meal: PlannedMeal): number | null {
  if (meal.type === 'recipe') return meal.calories;
  if (meal.type === 'takeaway') return meal.calories_budget;
  return null;
}

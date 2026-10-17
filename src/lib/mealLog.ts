import type { PlannedMeal } from '../types/plan.ts';

/**
 * Calories for the day ring. The planned total is shown until a meal is logged.
 * After that, only logged calories count. Unmarked meals are left out.
 */
export function dayEatenCalories(plannedTotal: number, loggedCalories: readonly number[]): number {
  if (loggedCalories.length === 0) return plannedTotal;
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

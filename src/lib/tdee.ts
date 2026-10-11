import type { ActivityLevel, DeficitPace, Sex, SmokingStatus } from '../types/db.ts';

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** Daily deficit (kcal) while the user still has weight to lose. */
export const DEFICIT_PACE_KCAL: Record<DeficitPace, number> = {
  easy: 250,
  steady: 350,
  fast: 500,
};

export const DEFICIT_PACES: DeficitPace[] = ['easy', 'steady', 'fast'];

/** Common safe minimums for an unsupervised diet. */
export const MIN_DAILY_CALORIES: Record<Sex, number> = { male: 1500, female: 1200 };

/** DB limits for profiles.daily_calorie_target. */
const DB_MIN_TARGET = 1000;
const DB_MAX_TARGET = 5000;

/** Share of one day's target that goes into the weekly treat budget. */
const CHEAT_BANK_SHARE_OF_DAY = 0.5;
/** Daily smoking raises resting burn a little. Former smokers are not adjusted. */
const DAILY_SMOKING_BMR_FACTOR = 1.07;
/** About 100 ml of milk in a cup. */
const MILK_CUP_KCAL = 60;
/** One teaspoon of sugar. */
const SUGAR_TSP_KCAL = 16;

const roundTo = (value: number, step: number): number => Math.round(value / step) * step;
const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** Whole years between two ISO dates (YYYY-MM-DD). */
export function ageOn(birthDate: string, today: string): number {
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  const hadBirthday = tm > bm || (tm === bm && td >= bd);
  return ty - by - (hadBirthday ? 0 : 1);
}

export interface TargetInput {
  birthDate: string;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  targetWeightKg: number;
  activity: ActivityLevel;
  today: string;
  /** Defaults to steady (350 kcal) when omitted. */
  deficitPace?: DeficitPace;
  smoking?: SmokingStatus;
  coffeeBlackCups?: number;
  coffeeMilkCups?: number;
  /** Teaspoons in each milky cup. Black coffee is unsweetened. */
  coffeeSugarTsp?: number;
}

export interface CalorieTargets {
  maintenance: number;
  dailyTarget: number;
  weeklyCheatBank: number;
  /** Planned cut below maintenance while losing (0 at goal). */
  deficitKcal: number;
  /** Calories reserved for coffee with milk and sugar. Black coffee is zero. */
  coffeeKcal: number;
}

/** Cups with milk, plus sugar in each of those cups. Black coffee adds nothing. */
export function coffeeCalories(milkCups: number, sugarTsp: number): number {
  const cups = clamp(Math.round(milkCups), 0, 8);
  const tsp = clamp(Math.round(sugarTsp), 0, 2);
  return cups * (MILK_CUP_KCAL + tsp * SUGAR_TSP_KCAL);
}

/**
 * Mifflin-St Jeor maintenance, minus the user's deficit pace (none when no loss is
 * needed). Daily smoking raises the resting number by 7 percent first.
 * Coffee with milk and sugar is then reserved from the food budget.
 * Never below the safe minimum or above maintenance.
 */
export function calorieTargets(input: TargetInput): CalorieTargets {
  const age = ageOn(input.birthDate, input.today);
  const bmr =
    10 * input.weightKg + 6.25 * input.heightCm - 5 * age + (input.sex === 'male' ? 5 : -161);
  const resting = input.smoking === 'daily' ? bmr * DAILY_SMOKING_BMR_FACTOR : bmr;
  const maintenance = roundTo(resting * ACTIVITY_FACTORS[input.activity], 10);
  const coffeeKcal = coffeeCalories(input.coffeeMilkCups ?? 0, input.coffeeSugarTsp ?? 0);

  const pace = input.deficitPace ?? 'steady';
  const toLose = input.weightKg - input.targetWeightKg;
  const deficitKcal = toLose <= 0 ? 0 : DEFICIT_PACE_KCAL[pace];
  const floor = Math.min(MIN_DAILY_CALORIES[input.sex], maintenance);
  const dailyTarget = clamp(
    Math.max(floor, maintenance - deficitKcal - coffeeKcal),
    DB_MIN_TARGET,
    DB_MAX_TARGET
  );

  return {
    maintenance,
    dailyTarget,
    weeklyCheatBank: roundTo(dailyTarget * CHEAT_BANK_SHARE_OF_DAY, 50),
    deficitKcal,
    coffeeKcal,
  };
}

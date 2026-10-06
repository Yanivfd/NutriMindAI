import type { ActivityLevel, Profile, ProfileInput, Sex, SmokingStatus } from '../types/db.ts';
import { CUISINES } from '../types/plan.ts';
import type { Cuisine, KosherLevel, MealSlot, Weekday } from '../types/plan.ts';
import { ageOn, calorieTargets } from './tdee.ts';

export type WaitHours = 1 | 3 | 6;

export interface ProfileFormValues {
  birthDate: string;
  sex: Sex | null;
  heightCm: string;
  currentWeightKg: string;
  targetWeightKg: string;
  activity: ActivityLevel;
  skipsBreakfast: boolean;
  officeDays: Weekday[];
  mealTimes: Record<MealSlot, string>;
  kosherLevel: KosherLevel;
  waitHours: WaitHours;
  cuisines: Cuisine[];
  smoking: SmokingStatus;
  coffeeBlackCups: number;
  coffeeMilkCups: number;
  coffeeSugarTsp: number;
}

export type ProfileField =
  | 'birthDate'
  | 'sex'
  | 'heightCm'
  | 'currentWeightKg'
  | 'targetWeightKg'
  | 'mealTimes'
  | 'cuisines';

/** First kitchen choice from the app language. The user can change it afterwards. */
export function defaultCuisines(language: 'he' | 'en'): Cuisine[] {
  return language === 'he'
    ? ['israeli', 'mizrahi', 'mediterranean']
    : ['international', 'mediterranean'];
}

export const DEFAULT_FORM_VALUES: ProfileFormValues = {
  birthDate: '',
  sex: null,
  heightCm: '',
  currentWeightKg: '',
  targetWeightKg: '',
  activity: 'light',
  skipsBreakfast: true,
  officeDays: [],
  mealTimes: { breakfast: '08:00', lunch: '13:00', snack: '16:30', dinner: '19:30' },
  kosherLevel: 'none',
  waitHours: 6,
  cuisines: ['israeli', 'mizrahi', 'mediterranean'],
  smoking: 'no',
  coffeeBlackCups: 0,
  coffeeMilkCups: 0,
  coffeeSugarTsp: 0,
};

const MIN_AGE = 16;
const MAX_AGE = 100;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Accepts "72.5" and "72,5" (Hebrew keyboards often type a comma). */
function parseNumber(text: string): number | null {
  const value = Number(text.trim().replace(',', '.'));
  return text.trim() !== '' && Number.isFinite(value) ? value : null;
}

function isRealDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const date = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(iso);
}

export function profileToFormValues(profile: Profile): ProfileFormValues {
  return {
    birthDate: profile.birth_date,
    sex: profile.sex,
    heightCm: String(profile.height_cm),
    currentWeightKg: String(Number(profile.current_weight_kg)),
    targetWeightKg: String(Number(profile.target_weight_kg)),
    activity: profile.activity_level,
    skipsBreakfast: profile.skips_breakfast,
    officeDays: profile.office_days,
    mealTimes: {
      breakfast: profile.breakfast_time.slice(0, 5),
      lunch: profile.lunch_time.slice(0, 5),
      snack: profile.snack_time.slice(0, 5),
      dinner: profile.dinner_time.slice(0, 5),
    },
    kosherLevel: profile.kosher_level,
    waitHours: profile.meat_dairy_wait_hours,
    cuisines:
      profile.preferred_cuisines && profile.preferred_cuisines.length > 0
        ? profile.preferred_cuisines
        : defaultCuisines('he'),
    smoking: profile.smoking ?? 'no',
    coffeeBlackCups: profile.coffee_black_cups ?? 0,
    coffeeMilkCups: profile.coffee_milk_cups ?? 0,
    coffeeSugarTsp: profile.coffee_sugar_tsp ?? 0,
  };
}

const SMOKING: SmokingStatus[] = ['no', 'former', 'daily'];

function clampCount(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(0, Math.round(value)));
}

export type ProfileFormResult =
  | { ok: true; input: ProfileInput; maintenance: number; coffeeKcal: number }
  | { ok: false; errors: ProfileField[] };

/**
 * Validates the form against the same limits as the database and builds the row to save.
 * `existing` keeps the original start weight when editing.
 */
export function buildProfileInput(
  values: ProfileFormValues,
  today: string,
  existing?: Pick<Profile, 'start_weight_kg'>
): ProfileFormResult {
  const errors: ProfileField[] = [];

  const age = isRealDate(values.birthDate) ? ageOn(values.birthDate, today) : null;
  if (age === null || age < MIN_AGE || age > MAX_AGE) errors.push('birthDate');
  if (!values.sex) errors.push('sex');

  const height = parseNumber(values.heightCm);
  if (height === null || height < 100 || height > 250) errors.push('heightCm');
  const current = parseNumber(values.currentWeightKg);
  if (current === null || current < 30 || current > 400) errors.push('currentWeightKg');
  const target = parseNumber(values.targetWeightKg);
  if (target === null || target < 30 || target > 400) errors.push('targetWeightKg');

  const t = values.mealTimes;
  const timesValid = Object.values(t).every((v) => TIME_RE.test(v));
  if (!timesValid || !(t.breakfast < t.lunch && t.lunch < t.dinner)) errors.push('mealTimes');
  const cuisines = values.cuisines.filter((cuisine) => (CUISINES as readonly string[]).includes(cuisine));
  if (cuisines.length === 0) errors.push('cuisines');

  if (errors.length > 0 || !values.sex || height === null || current === null || target === null) {
    return { ok: false, errors };
  }

  const roundedHeight = Math.round(height);
  const smoking = SMOKING.includes(values.smoking) ? values.smoking : 'no';
  const coffeeBlackCups = clampCount(values.coffeeBlackCups, 8);
  const coffeeMilkCups = clampCount(values.coffeeMilkCups, 8);
  const coffeeSugarTsp = clampCount(values.coffeeSugarTsp, 2);
  const targets = calorieTargets({
    birthDate: values.birthDate,
    sex: values.sex,
    heightCm: roundedHeight,
    weightKg: current,
    targetWeightKg: target,
    activity: values.activity,
    today,
    smoking,
    coffeeBlackCups,
    coffeeMilkCups,
    coffeeSugarTsp,
  });

  return {
    ok: true,
    maintenance: targets.maintenance,
    coffeeKcal: targets.coffeeKcal,
    input: {
      birth_date: values.birthDate,
      sex: values.sex,
      height_cm: roundedHeight,
      activity_level: values.activity,
      start_weight_kg: existing ? Number(existing.start_weight_kg) : current,
      current_weight_kg: current,
      target_weight_kg: target,
      daily_calorie_target: targets.dailyTarget,
      weekly_cheat_bank: targets.weeklyCheatBank,
      skips_breakfast: values.skipsBreakfast,
      kosher_level: values.kosherLevel,
      meat_dairy_wait_hours: values.waitHours,
      preferred_cuisines: cuisines,
      breakfast_time: t.breakfast,
      lunch_time: t.lunch,
      snack_time: t.snack,
      dinner_time: t.dinner,
      office_days: values.officeDays,
      smoking,
      coffee_black_cups: coffeeBlackCups,
      coffee_milk_cups: coffeeMilkCups,
      coffee_sugar_tsp: coffeeSugarTsp,
    },
  };
}

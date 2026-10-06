import type {
  DislikedIngredient,
  Ingredient,
  Cuisine,
  KashrutType,
  KosherLevel,
  MealSlot,
  Weekday,
} from './plan';

export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type SmokingStatus = 'no' | 'former' | 'daily';
export type CheatKind = 'sweet' | 'beer' | 'other';
export type MealLogStatus = 'planned' | 'other';

/** Row of public.profiles. Times are 'HH:MM:SS'. */
export interface Profile {
  id: string;
  birth_date: string;
  sex: Sex;
  height_cm: number;
  activity_level: ActivityLevel;
  start_weight_kg: number;
  current_weight_kg: number;
  target_weight_kg: number;
  daily_calorie_target: number;
  weekly_cheat_bank: number;
  skips_breakfast: boolean;
  kosher_level: KosherLevel;
  meat_dairy_wait_hours: 1 | 3 | 6;
  preferred_cuisines: Cuisine[];
  disliked_recipe_ids: string[];
  disliked_ingredients: DislikedIngredient[];
  breakfast_time: string;
  lunch_time: string;
  snack_time: string;
  dinner_time: string;
  office_days: Weekday[];
  smoking: SmokingStatus;
  coffee_black_cups: number;
  coffee_milk_cups: number;
  coffee_sugar_tsp: number;
  created_at: string;
}

/**
 * Fields the settings form writes. Dislikes are saved on their own so editing
 * height or meal times cannot clear them.
 */
export type ProfileInput = Omit<
  Profile,
  'id' | 'created_at' | 'disliked_recipe_ids' | 'disliked_ingredients'
>;

/** Row of public.recipes. */
export interface RecipeRow {
  id: string;
  title_he: string;
  title_en: string;
  prep_time_minutes: number;
  meal_types: MealSlot[];
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  ingredients: Ingredient[];
  instructions_he: string[];
  instructions_en: string[];
  image_url: string | null;
  kashrut_type: KashrutType;
  cuisines: Cuisine[];
  is_kosher: boolean;
  shabbat_friendly: boolean;
  is_active: boolean;
}

export interface WeightLog {
  id: string;
  user_id: string;
  logged_on: string;
  weight_kg: number;
  created_at: string;
}

export interface CheatLog {
  id: string;
  user_id: string;
  logged_at: string;
  kind: CheatKind;
  calories: number;
  note: string | null;
}

/** Row of public.meal_logs. One check-in per user, date, and slot. */
export interface MealLog {
  id: string;
  user_id: string;
  logged_on: string;
  slot: MealSlot;
  status: MealLogStatus;
  calories: number;
  note: string | null;
  created_at: string;
}

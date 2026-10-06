import { FunctionsHttpError } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { addDays, localDateOf, todayLocal } from '@/lib/week';
import type {
  CheatKind,
  CheatLog,
  MealLog,
  MealLogStatus,
  Profile,
  ProfileInput,
  RecipeRow,
  WeightLog,
} from '@/types/db';
import type { DislikedIngredient, MealSlot, WeeklyPlanPayload } from '@/types/plan';

import { useUserId } from './auth';
import { supabase } from './supabase';

export const queryKeys = {
  profile: (userId: string) => ['profile', userId] as const,
  weeklyPlan: (userId: string, weekStart: string) => ['weeklyPlan', userId, weekStart] as const,
  recipes: ['recipes'] as const,
  weightLogs: (userId: string) => ['weightLogs', userId] as const,
  cheatLogs: (userId: string, weekStart: string) => ['cheatLogs', userId, weekStart] as const,
  mealLogs: (userId: string, weekStart: string) => ['mealLogs', userId, weekStart] as const,
};

export type GenerateErrorCode =
  | 'UNAUTHORIZED'
  | 'INVALID_WEEK'
  | 'PROFILE_REQUIRED'
  | 'NO_RECIPES'
  | 'PLAN_REQUIRED'
  | 'SLOT_MISMATCH'
  | 'INVALID_INGREDIENT'
  | 'INVALID_BODY'
  | 'INTERNAL'
  | 'NETWORK';

export class MenuApiError extends Error {
  constructor(readonly code: GenerateErrorCode) {
    super(code);
    this.name = 'MenuApiError';
  }
}

export interface SavedPlan {
  id: string;
  plan: WeeklyPlanPayload;
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

/** Shared by `useProfile` and the root navigator (which runs before a user is guaranteed). */
export function profileQueryOptions(userId: string) {
  return {
    queryKey: queryKeys.profile(userId),
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  };
}

export function useProfile() {
  return useQuery(profileQueryOptions(useUserId()));
}

export function useSaveProfile() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['save-profile'],
    mutationFn: async (input: ProfileInput): Promise<Profile> => {
      const { data, error } = await supabase
        .from('profiles')
        .upsert({ id: userId, ...input })
        .select('*')
        .single();
      if (error) throw error;
      return data as Profile;
    },
    onSuccess: (profile) => queryClient.setQueryData(queryKeys.profile(userId), profile),
  });
}

/** Saves only the dislike lists, so a settings save cannot clear them. */
export function useUpdateDislikes() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['update-dislikes'],
    mutationFn: async (input: {
      disliked_recipe_ids: string[];
      disliked_ingredients: DislikedIngredient[];
    }): Promise<Profile> => {
      const { data, error } = await supabase
        .from('profiles')
        .update(input)
        .eq('id', userId)
        .select('*')
        .single();
      if (error) throw error;
      return data as Profile;
    },
    onSuccess: (profile) => queryClient.setQueryData(queryKeys.profile(userId), profile),
  });
}

// ---------------------------------------------------------------------------
// Weekly plan
// ---------------------------------------------------------------------------

export function useWeeklyPlan(weekStart: string) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.weeklyPlan(userId, weekStart),
    queryFn: async (): Promise<SavedPlan | null> => {
      const { data, error } = await supabase
        .from('weekly_plans')
        .select('id, plan_json')
        .eq('user_id', userId)
        .eq('week_start_date', weekStart)
        .maybeSingle();
      if (error) throw error;
      return data ? { id: data.id as string, plan: data.plan_json as WeeklyPlanPayload } : null;
    },
  });
}

async function toMenuApiError(error: unknown): Promise<MenuApiError> {
  if (error instanceof FunctionsHttpError) {
    const body: unknown = await error.context.json().catch(() => null);
    const code =
      typeof body === 'object' && body !== null && 'error' in body ? String(body.error) : 'INTERNAL';
    const known: GenerateErrorCode[] = [
      'UNAUTHORIZED',
      'INVALID_WEEK',
      'PROFILE_REQUIRED',
      'NO_RECIPES',
      'PLAN_REQUIRED',
      'SLOT_MISMATCH',
      'INVALID_INGREDIENT',
      'INVALID_BODY',
    ];
    return new MenuApiError(known.find((k) => k === code) ?? 'INTERNAL');
  }
  return new MenuApiError('NETWORK');
}

/** Generates (or regenerates) the plan for a week via the Edge Function. */
export function useGenerateWeek() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['generate-week'],
    mutationFn: async (weekStart: string): Promise<SavedPlan> => {
      const { data, error } = await supabase.functions.invoke<{ plan_id: string; plan: WeeklyPlanPayload }>(
        'generate-weekly-menu',
        { body: { week_start_date: weekStart } }
      );
      if (error || !data) throw await toMenuApiError(error);
      return { id: data.plan_id, plan: data.plan };
    },
    onSuccess: (saved) =>
      queryClient.setQueryData(queryKeys.weeklyPlan(userId, saved.plan.week_start_date), saved),
  });
}

export interface ApplyDislikesInput {
  week_start_date: string;
  date: string;
  slot: MealSlot;
  recipe_id: string;
  dislike_dish: boolean;
  ingredients: DislikedIngredient[];
}

export interface ApplyDislikesResult {
  id: string;
  plan: WeeklyPlanPayload;
  disliked_recipe_ids: string[];
  disliked_ingredients: DislikedIngredient[];
}

/** Saves dislike lists and immediately replaces blocked meals in that week. */
export function useApplyDislikes() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['apply-dislikes'],
    mutationFn: async (input: ApplyDislikesInput): Promise<ApplyDislikesResult> => {
      const { data, error } = await supabase.functions.invoke<{
        plan_id: string;
        plan: WeeklyPlanPayload;
        disliked_recipe_ids: string[];
        disliked_ingredients: DislikedIngredient[];
      }>('apply-dislikes', { body: input });
      if (error || !data) throw await toMenuApiError(error);
      return {
        id: data.plan_id,
        plan: data.plan,
        disliked_recipe_ids: data.disliked_recipe_ids,
        disliked_ingredients: data.disliked_ingredients,
      };
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKeys.weeklyPlan(userId, saved.plan.week_start_date), {
        id: saved.id,
        plan: saved.plan,
      });
      queryClient.setQueryData(queryKeys.profile(userId), (current: Profile | null | undefined) =>
        current
          ? {
              ...current,
              disliked_recipe_ids: saved.disliked_recipe_ids,
              disliked_ingredients: saved.disliked_ingredients,
            }
          : current
      );
    },
  });
}

// ---------------------------------------------------------------------------
// Recipes (small catalog: load once, look up by id)
// ---------------------------------------------------------------------------

export function useRecipes() {
  return useQuery({
    queryKey: queryKeys.recipes,
    // Cache a plain array (JSON-persistable); expose a Map for lookups.
    queryFn: async (): Promise<RecipeRow[]> => {
      const { data, error } = await supabase.from('recipes').select('*').eq('is_active', true);
      if (error) throw error;
      return (data ?? []) as RecipeRow[];
    },
    select: (rows): Map<string, RecipeRow> => new Map(rows.map((r) => [r.id, r])),
  });
}

export function useRecipe(id: string): { recipe: RecipeRow | undefined; isLoading: boolean } {
  const { data, isLoading } = useRecipes();
  return { recipe: data?.get(id), isLoading };
}

// ---------------------------------------------------------------------------
// Weight logs
// ---------------------------------------------------------------------------

export function useWeightLogs(limit = 30) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.weightLogs(userId),
    queryFn: async (): Promise<WeightLog[]> => {
      const { data, error } = await supabase
        .from('weight_logs')
        .select('*')
        .eq('user_id', userId)
        .order('logged_on', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as WeightLog[];
    },
  });
}

/** Logs today's weight (one entry per day) and updates the profile's current weight. */
export function useLogWeight() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['log-weight'],
    mutationFn: async (weightKg: number): Promise<void> => {
      const { error } = await supabase
        .from('weight_logs')
        .upsert(
          { user_id: userId, logged_on: todayLocal(), weight_kg: weightKg },
          { onConflict: 'user_id,logged_on' }
        );
      if (error) throw error;
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ current_weight_kg: weightKg })
        .eq('id', userId);
      if (profileError) throw profileError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.weightLogs(userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.profile(userId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Cheat logs (spending from the weekly cheat bank)
// ---------------------------------------------------------------------------

export function useCheatLogs(weekStart: string) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.cheatLogs(userId, weekStart),
    queryFn: async (): Promise<CheatLog[]> => {
      // Query a day of margin in UTC, then keep entries whose Israel-time date is in the week.
      const weekEnd = addDays(weekStart, 7);
      const { data, error } = await supabase
        .from('cheat_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('logged_at', `${addDays(weekStart, -1)}T00:00:00Z`)
        .lt('logged_at', `${addDays(weekEnd, 1)}T00:00:00Z`)
        .order('logged_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as CheatLog[]).filter((log) => {
        const date = localDateOf(log.logged_at);
        return date >= weekStart && date < weekEnd;
      });
    },
  });
}

export function useAddCheatLog(weekStart: string) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['add-cheat'],
    mutationFn: async (input: { kind: CheatKind; calories: number; note?: string }): Promise<void> => {
      const { error } = await supabase
        .from('cheat_logs')
        .insert({ user_id: userId, kind: input.kind, calories: input.calories, note: input.note ?? null });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.cheatLogs(userId, weekStart) }),
  });
}

/** Meal check-ins for the week (Sunday through Saturday). */
export function useMealLogs(weekStart: string) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.mealLogs(userId, weekStart),
    queryFn: async (): Promise<MealLog[]> => {
      const weekEnd = addDays(weekStart, 7);
      const { data, error } = await supabase
        .from('meal_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('logged_on', weekStart)
        .lt('logged_on', weekEnd)
        .order('logged_on', { ascending: true });
      if (error) throw error;
      return (data ?? []) as MealLog[];
    },
  });
}

/** Saves whether the planned meal was eaten, or the calories of something else. */
export function useUpsertMealLog(weekStart: string) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['upsert-meal-log'],
    mutationFn: async (input: {
      loggedOn: string;
      slot: MealSlot;
      status: MealLogStatus;
      calories: number;
      note?: string;
    }): Promise<void> => {
      const { error } = await supabase.from('meal_logs').upsert(
        {
          user_id: userId,
          logged_on: input.loggedOn,
          slot: input.slot,
          status: input.status,
          calories: input.calories,
          note: input.note?.trim() ? input.note.trim() : null,
        },
        { onConflict: 'user_id,logged_on,slot' }
      );
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.mealLogs(userId, weekStart) }),
  });
}

/** Removes the check-in for one slot so the meal is unmarked again. */
export function useDeleteMealLog(weekStart: string) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['delete-meal-log'],
    mutationFn: async (input: { loggedOn: string; slot: MealSlot }): Promise<void> => {
      const { error } = await supabase
        .from('meal_logs')
        .delete()
        .eq('user_id', userId)
        .eq('logged_on', input.loggedOn)
        .eq('slot', input.slot);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.mealLogs(userId, weekStart) }),
  });
}

/** Asks the edge function for a typical-portion calorie estimate. The number is not saved. */
export function useEstimateSnackCalories() {
  return useMutation({
    mutationKey: ['estimate-snack'],
    mutationFn: async (description: string): Promise<number> => {
      const { data, error } = await supabase.functions.invoke<{ calories?: number }>(
        'estimate-snack-calories',
        { body: { description } }
      );
      if (error || typeof data?.calories !== 'number') throw new Error('ESTIMATE_FAILED');
      return data.calories;
    },
  });
}

export function useDeleteCheatLog(weekStart: string) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['delete-cheat'],
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from('cheat_logs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.cheatLogs(userId, weekStart) }),
  });
}

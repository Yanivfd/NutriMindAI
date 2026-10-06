import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { aggregateGrocery } from '../_shared/grocery.ts';
import { dailyFoodTarget, isKosher, repairWeek } from '../_shared/planRules.ts';
import {
  mergeDislikes,
  PROFILE_PLANNING_COLUMNS,
  resolveWeekStart,
  toPlanningProfile,
} from '../_shared/planning.ts';
import type { ProfileRow } from '../_shared/planning.ts';
import { MEAL_SLOTS, recipeContainsIngredient } from '../_shared/types.ts';
import type {
  DislikedIngredient,
  MealSlot,
  Recipe,
  WeeklyPlanPayload,
} from '../_shared/types.ts';

interface ApplyBody {
  week_start_date?: unknown;
  date?: unknown;
  slot?: unknown;
  recipe_id?: unknown;
  dislike_dish?: unknown;
  ingredients?: unknown;
}

function parseBody(raw: unknown): {
  date: string;
  slot: MealSlot;
  recipeId: string;
  dislikeDish: boolean;
  ingredients: DislikedIngredient[];
} | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const body = raw as ApplyBody;
  if (typeof body.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) return null;
  if (typeof body.slot !== 'string' || !(MEAL_SLOTS as readonly string[]).includes(body.slot)) {
    return null;
  }
  if (typeof body.recipe_id !== 'string' || body.recipe_id.length === 0) return null;
  const dislikeDish = body.dislike_dish === true;
  if (!Array.isArray(body.ingredients)) return null;
  const ingredients: DislikedIngredient[] = [];
  for (const item of body.ingredients) {
    if (typeof item !== 'object' || item === null) return null;
    const { name_en: nameEn, name_he: nameHe } = item as Record<string, unknown>;
    if (typeof nameEn !== 'string' || typeof nameHe !== 'string') return null;
    if (!nameEn.trim()) return null;
    ingredients.push({ name_en: nameEn, name_he: nameHe });
  }
  if (!dislikeDish && ingredients.length === 0) return null;
  return {
    date: body.date,
    slot: body.slot as MealSlot,
    recipeId: body.recipe_id,
    dislikeDish,
    ingredients,
  };
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return jsonResponse({ error: 'UNAUTHORIZED' }, 401);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(
    authHeader.slice('Bearer '.length)
  );
  if (userError || !userData.user) return jsonResponse({ error: 'UNAUTHORIZED' }, 401);
  const userId = userData.user.id;

  const body: unknown = await req.json().catch(() => ({}));
  const parsed = parseBody(body);
  if (!parsed) return jsonResponse({ error: 'INVALID_BODY' }, 400);
  const weekStart = resolveWeekStart(body, new Date());
  if (!weekStart) return jsonResponse({ error: 'INVALID_WEEK' }, 400);

  const { data: profileRow, error: profileError } = await supabase
    .from('profiles')
    .select(PROFILE_PLANNING_COLUMNS)
    .eq('id', userId)
    .maybeSingle();
  if (profileError) {
    console.error('profile query failed', profileError.code);
    return jsonResponse({ error: 'INTERNAL' }, 500);
  }
  if (!profileRow) return jsonResponse({ error: 'PROFILE_REQUIRED' }, 409);
  const profile = toPlanningProfile(profileRow as unknown as ProfileRow);

  const { data: planRow, error: planError } = await supabase
    .from('weekly_plans')
    .select('id, plan_json')
    .eq('user_id', userId)
    .eq('week_start_date', weekStart)
    .maybeSingle();
  if (planError) {
    console.error('plan query failed', planError.code);
    return jsonResponse({ error: 'INTERNAL' }, 500);
  }
  if (!planRow) return jsonResponse({ error: 'PLAN_REQUIRED' }, 409);
  const current = planRow.plan_json as WeeklyPlanPayload;
  const day = current.days.find((item) => item.date === parsed.date);
  const meal = day?.meals.find((item) => item.slot === parsed.slot);
  if (!meal || meal.type !== 'recipe' || meal.recipe_id !== parsed.recipeId) {
    return jsonResponse({ error: 'SLOT_MISMATCH' }, 409);
  }

  let recipeQuery = supabase
    .from('recipes')
    .select(
      'id, title_en, calories, protein_g, prep_time_minutes, meal_types, kashrut_type, ' +
        'is_kosher, shabbat_friendly, cuisines, ingredients'
    )
    .eq('is_active', true);
  if (isKosher(profile)) recipeQuery = recipeQuery.eq('is_kosher', true);
  const { data: recipeRows, error: recipesError } = await recipeQuery;
  if (recipesError) {
    console.error('recipes query failed', recipesError.code);
    return jsonResponse({ error: 'INTERNAL' }, 500);
  }
  const recipes = (recipeRows ?? []) as unknown as Recipe[];
  if (recipes.length === 0) return jsonResponse({ error: 'NO_RECIPES' }, 503);

  const currentRecipe = recipes.find((recipe) => recipe.id === parsed.recipeId);
  if (!currentRecipe) return jsonResponse({ error: 'SLOT_MISMATCH' }, 409);
  for (const item of parsed.ingredients) {
    if (!recipeContainsIngredient(currentRecipe, item.name_en)) {
      return jsonResponse({ error: 'INVALID_INGREDIENT' }, 400);
    }
  }

  const dislikes = mergeDislikes(
    {
      disliked_recipe_ids: profile.disliked_recipe_ids,
      disliked_ingredients: profile.disliked_ingredients,
    },
    { recipeId: parsed.recipeId, dislikeDish: parsed.dislikeDish, ingredients: parsed.ingredients }
  );
  const nextProfile = { ...profile, ...dislikes };

  const { error: updateError } = await supabase
    .from('profiles')
    .update(dislikes)
    .eq('id', userId);
  if (updateError) {
    console.error('dislike update failed', updateError.code);
    return jsonResponse({ error: 'INTERNAL' }, 500);
  }

  const days = repairWeek(current.days, recipes, nextProfile, weekStart);
  const payload: WeeklyPlanPayload = {
    ...current,
    generated_at: new Date().toISOString(),
    daily_food_target: dailyFoodTarget(nextProfile),
    weekly_cheat_bank: nextProfile.weekly_cheat_bank,
    kosher_level: nextProfile.kosher_level,
    meat_dairy_wait_hours: nextProfile.meat_dairy_wait_hours,
    days,
    grocery: aggregateGrocery(days, new Map(recipes.map((recipe) => [recipe.id, recipe]))),
  };

  const { data: saved, error: saveError } = await supabase
    .from('weekly_plans')
    .upsert(
      { user_id: userId, week_start_date: weekStart, plan_json: payload },
      { onConflict: 'user_id,week_start_date' }
    )
    .select('id')
    .single();
  if (saveError || !saved) {
    console.error('plan upsert failed', saveError?.code);
    return jsonResponse({ error: 'INTERNAL' }, 500);
  }

  return jsonResponse({
    plan_id: saved.id,
    plan: payload,
    disliked_recipe_ids: dislikes.disliked_recipe_ids,
    disliked_ingredients: dislikes.disliked_ingredients,
  });
});

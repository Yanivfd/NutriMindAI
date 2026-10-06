import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { aggregateGrocery } from '../_shared/grocery.ts';
import {
  buildDays,
  buildSlots,
  chooseRecipes,
  dailyFoodTarget,
  isKosher,
} from '../_shared/planRules.ts';
import {
  PROFILE_PLANNING_COLUMNS,
  resolveWeekStart,
  toPlanningProfile,
} from '../_shared/planning.ts';
import type { ProfileRow } from '../_shared/planning.ts';
import { isRecipeBlocked } from '../_shared/types.ts';
import type { ModelSuggestion, Recipe, WeeklyPlanPayload } from '../_shared/types.ts';
import { modelCandidates } from '../_shared/models.ts';
import { suggestSchedule } from './gemini.ts';

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return jsonResponse({ error: 'UNAUTHORIZED' }, 401);

  // User-scoped client: every query below runs under the caller's RLS policies.
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
  const now = new Date();
  const weekStart = resolveWeekStart(body, now);
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

  const slots = buildSlots(profile, weekStart);
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  const models = modelCandidates(
    Deno.env.get('GEMINI_MODEL'),
    Deno.env.get('GEMINI_FALLBACK_MODELS')
  );
  // The model only sees dishes that already passed the dislike rules.
  const allowed = recipes.filter((recipe) => !isRecipeBlocked(recipe, profile));

  let suggestions: ModelSuggestion[] = [];
  let source: WeeklyPlanPayload['source'] = 'fallback';
  let usedModel: string | null = null;
  if (apiKey && allowed.length > 0) {
    try {
      const result = await suggestSchedule({ apiKey, models, profile, slots, recipes: allowed });
      suggestions = result.suggestions;
      usedModel = result.model;
      source = 'ai';
    } catch (error: unknown) {
      console.error('gemini failed, using fallback', error instanceof Error ? error.message : 'unknown');
    }
  } else if (!apiKey) {
    console.warn('GEMINI_API_KEY not set, using fallback planner');
  }

  const choices = chooseRecipes(slots, suggestions, recipes, profile);
  const days = buildDays(choices, profile);
  const payload: WeeklyPlanPayload = {
    week_start_date: weekStart,
    generated_at: now.toISOString(),
    source,
    model: usedModel,
    daily_food_target: dailyFoodTarget(profile),
    weekly_cheat_bank: profile.weekly_cheat_bank,
    kosher_level: profile.kosher_level,
    meat_dairy_wait_hours: profile.meat_dairy_wait_hours,
    days,
    grocery: aggregateGrocery(days, new Map(recipes.map((r) => [r.id, r]))),
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

  return jsonResponse({ plan_id: saved.id, plan: payload });
});

import { GoogleGenAI } from 'npm:@google/genai@2.27.0';

import { formatMinutes, MAX_USES_PER_RECIPE, parseSuggestions } from '../_shared/planRules.ts';
import type { SlotSpec } from '../_shared/planRules.ts';
import { MEAL_SLOTS, WEEKDAYS } from '../_shared/types.ts';
import type { ModelSuggestion, PlanningProfile, Recipe } from '../_shared/types.ts';

const TIMEOUT_MS = 20_000;
/** Stop trying more models after this, so the user is not left waiting. */
const TOTAL_BUDGET_MS = 40_000;
const MIN_ATTEMPT_MS = 3_000;

const SYSTEM_PROMPT = `You schedule a week of meals for a low-friction fat-loss app.
You only choose recipe IDs from the provided catalog for the listed slots. Portions are
computed later, so ignore exact calories beyond picking a sensible fit.

Rules:
1. Return exactly one entry for every slot listed in "slots", using a recipe whose
   meal_types includes that slot.
2. Prefer recipes whose calories are close to the slot's target_kcal.
3. Use a recipe at most ${MAX_USES_PER_RECIPE} times per week and never twice on the same day.
   Vary meals between consecutive days.
4. Prefer higher-protein recipes, and shorter prep times on weekdays.
5. If "kosher" is true: never schedule a dairy recipe less than meat_dairy_wait_hours after a
   meat recipe on the same day (use the slot times). Dairy before meat is fine.
6. Slots with "shabbat": true must use recipes with shabbat_friendly = true. They are
   prepared before Shabbat and served cold or at room temperature.
7. Prefer recipes whose cuisines overlap preferred_cuisines. Use another recipe when
   no preferred one fits the slot.
8. Recipes with kashrut_type "mixed" combine meat and dairy. Use them only when
   "kosher" is false.

Respond with JSON only.`;

interface SuggestParams {
  apiKey: string;
  /** Tried in order; the next one is used when a model is overloaded or answers badly. */
  models: string[];
  profile: PlanningProfile;
  slots: SlotSpec[];
  recipes: Recipe[];
}

export interface SuggestResult {
  suggestions: ModelSuggestion[];
  model: string;
}

/** Asks Gemini for a recipe per slot. Throws if no model gives a usable answer in time. */
export async function suggestSchedule(params: SuggestParams): Promise<SuggestResult> {
  const { apiKey, models, profile, slots, recipes } = params;
  const recipeIds = recipes.map((r) => r.id);
  const recipeSlots = slots.filter((s) => s.kind === 'recipe');

  const context = {
    kosher: profile.kosher_level !== 'none',
    meat_dairy_wait_hours: profile.meat_dairy_wait_hours,
    preferred_cuisines: profile.preferred_cuisines,
    slots: recipeSlots.map((s) => ({
      day: s.day,
      slot: s.slot,
      time: formatMinutes(s.minutes),
      target_kcal: s.budget,
      shabbat: s.shabbat,
    })),
    recipes: recipes.map((r) => ({
      id: r.id,
      title_en: r.title_en,
      calories: r.calories,
      protein_g: r.protein_g,
      prep_time_minutes: r.prep_time_minutes,
      meal_types: r.meal_types,
      kashrut_type: r.kashrut_type,
      shabbat_friendly: r.shabbat_friendly,
      cuisines: r.cuisines,
    })),
  };

  const responseJsonSchema = {
    type: 'object',
    properties: {
      meals: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            day: { type: 'string', enum: [...WEEKDAYS] },
            slot: { type: 'string', enum: [...MEAL_SLOTS] },
            recipe_id: { type: 'string', enum: recipeIds },
          },
          required: ['day', 'slot', 'recipe_id'],
        },
      },
    },
    required: ['meals'],
  };

  const validIds = new Set(recipeIds);
  const started = Date.now();
  let lastError: unknown = null;
  for (const model of models) {
    const remaining = TOTAL_BUDGET_MS - (Date.now() - started);
    if (remaining < MIN_ATTEMPT_MS) break;
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { timeout: Math.min(TIMEOUT_MS, remaining) },
    });
    try {
      const response = await ai.models.generateContent({
        model,
        contents: JSON.stringify(context),
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: 'application/json',
          responseJsonSchema,
          thinkingConfig: { thinkingLevel: 'medium' },
        },
      });
      const suggestions = parseSuggestions(JSON.parse(response.text ?? ''), validIds);
      if (suggestions.length > 0) return { suggestions, model };
      lastError = new Error('Model returned no usable suggestions');
    } catch (error: unknown) {
      lastError = error;
    }
    const reason = lastError instanceof Error ? lastError.message.slice(0, 160) : 'unknown';
    console.warn(`gemini model ${model} failed, trying next: ${reason}`);
  }
  throw lastError instanceof Error ? lastError : new Error('Gemini request failed');
}

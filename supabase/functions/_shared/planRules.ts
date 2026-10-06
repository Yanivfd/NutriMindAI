import { isRecipeBlocked, MEAL_SLOTS, WEEKDAYS } from './types.ts';
import type {
  MealSlot,
  ModelSuggestion,
  PlannedDay,
  PlannedMeal,
  PlanningProfile,
  Recipe,
  Weekday,
} from './types.ts';

export const MAX_USES_PER_RECIPE = 3;
export const MIN_PORTION = 0.5;
export const MAX_PORTION = 2;
export const PORTION_STEP = 0.25;

const SLOT_SHARES_SKIP_BREAKFAST: Record<MealSlot, number> = {
  breakfast: 0,
  lunch: 0.4,
  snack: 0.2,
  dinner: 0.4,
};
const SLOT_SHARES_WITH_BREAKFAST: Record<MealSlot, number> = {
  breakfast: 0.25,
  lunch: 0.3,
  snack: 0.15,
  dinner: 0.3,
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseTimeToMinutes(time: string): number {
  const match = /^(\d{2}):(\d{2})/.exec(time);
  if (!match) throw new Error(`Invalid time: ${time}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

export function formatMinutes(minutes: number): string {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return `${h}:${m}`;
}

export function isValidIsoDate(date: string): boolean {
  if (!DATE_RE.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

export function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function weekdayOf(date: string): Weekday {
  return WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

/** Sunday of the current week in the given time zone (Israeli weeks start on Sunday). */
export function currentWeekStart(now: Date, timeZone = 'Asia/Jerusalem'): string {
  const localDate = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return addDays(localDate, -WEEKDAYS.indexOf(weekdayOf(localDate)));
}

/** Daily food calories after reserving the weekly cheat bank. */
export function dailyFoodTarget(profile: PlanningProfile): number {
  return Math.round(profile.daily_calorie_target - profile.weekly_cheat_bank / 7);
}

export function isKosher(profile: PlanningProfile): boolean {
  return profile.kosher_level !== 'none';
}

/** No cooking from Friday evening until Saturday night. */
export function isShabbatSlot(day: Weekday, slot: MealSlot): boolean {
  return day === 'saturday' || (day === 'friday' && slot === 'dinner');
}

export interface SlotSpec {
  date: string;
  day: Weekday;
  slot: MealSlot;
  minutes: number;
  kind: 'recipe' | 'takeaway';
  shabbat: boolean;
  budget: number;
}

export function buildSlots(profile: PlanningProfile, weekStart: string): SlotSpec[] {
  const shares = profile.skips_breakfast ? SLOT_SHARES_SKIP_BREAKFAST : SLOT_SHARES_WITH_BREAKFAST;
  const target = dailyFoodTarget(profile);
  const kosher = isKosher(profile);
  const slots: SlotSpec[] = [];

  WEEKDAYS.forEach((day, index) => {
    const date = addDays(weekStart, index);
    for (const slot of MEAL_SLOTS) {
      if (shares[slot] === 0) continue;
      const shabbat = kosher && isShabbatSlot(day, slot);
      const takeaway = slot === 'lunch' && profile.office_days.includes(day) && !shabbat;
      slots.push({
        date,
        day,
        slot,
        minutes: parseTimeToMinutes(profile.meal_times[slot]),
        kind: takeaway ? 'takeaway' : 'recipe',
        shabbat,
        budget: Math.round(target * shares[slot]),
      });
    }
  });
  return slots;
}

/** Turns an existing week into model-style suggestions so unblocked meals can stay. */
export function suggestionsFromDays(days: PlannedDay[]): ModelSuggestion[] {
  const result: ModelSuggestion[] = [];
  for (const day of days) {
    for (const meal of day.meals) {
      if (meal.type !== 'recipe') continue;
      result.push({ day: day.weekday, slot: meal.slot, recipe_id: meal.recipe_id });
    }
  }
  return result;
}

/**
 * Rebuilds a week from its current meals, swapping any slot whose suggested dish
 * is now blocked (or fails kashrut/Shabbat) for the next valid recipe.
 */
export function repairWeek(
  days: PlannedDay[],
  recipes: Recipe[],
  profile: PlanningProfile,
  weekStart: string
): PlannedDay[] {
  const slots = buildSlots(profile, weekStart);
  return buildDays(chooseRecipes(slots, suggestionsFromDays(days), recipes, profile), profile);
}

/** Keeps only well-formed suggestions for known recipes; the first one per slot wins. */
export function parseSuggestions(raw: unknown, validIds: ReadonlySet<string>): ModelSuggestion[] {
  if (typeof raw !== 'object' || raw === null || !('meals' in raw)) return [];
  const meals: unknown = raw.meals;
  if (!Array.isArray(meals)) return [];

  const seen = new Set<string>();
  const result: ModelSuggestion[] = [];
  for (const item of meals) {
    if (typeof item !== 'object' || item === null) continue;
    const { day, slot, recipe_id: recipeId } = item as Record<string, unknown>;
    if (
      typeof day !== 'string' ||
      typeof slot !== 'string' ||
      typeof recipeId !== 'string' ||
      !(WEEKDAYS as readonly string[]).includes(day) ||
      !(MEAL_SLOTS as readonly string[]).includes(slot) ||
      !validIds.has(recipeId)
    ) {
      continue;
    }
    const key = `${day}|${slot}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ day: day as Weekday, slot: slot as MealSlot, recipe_id: recipeId });
  }
  return result;
}

export interface SlotChoice {
  spec: SlotSpec;
  /** null for takeaway slots and for slots no recipe could fill. */
  recipe: Recipe | null;
}

interface DayOutcome {
  choices: SlotChoice[];
  /** Slot of an earlier meat meal that left a later slot without any valid recipe. */
  blockedBy: MealSlot | null;
}

/**
 * Turns model suggestions into a valid schedule. Kashrut and Shabbat rules are never
 * relaxed; variety rules (max uses per week, no repeat within a day) are relaxed only
 * when nothing else fits.
 */
export function chooseRecipes(
  slots: SlotSpec[],
  suggestions: ModelSuggestion[],
  recipes: Recipe[],
  profile: PlanningProfile
): SlotChoice[] {
  const kosher = isKosher(profile);
  const waitMinutes = profile.meat_dairy_wait_hours * 60;
  const pool = recipes.filter((r) => !kosher || r.is_kosher);
  const byId = new Map(pool.map((r) => [r.id, r]));
  const suggested = new Map<string, string>();
  for (const s of suggestions) {
    const key = `${s.day}|${s.slot}`;
    if (!suggested.has(key)) suggested.set(key, s.recipe_id);
  }
  const weekUsage = new Map<string, number>();

  const planDay = (daySlots: SlotSpec[], noMeat: ReadonlySet<MealSlot>): DayOutcome => {
    const choices: SlotChoice[] = [];
    const usedToday = new Set<string>();
    let lastMeat: { minutes: number; slot: MealSlot; fromRecipe: boolean } | null = null;

    for (const spec of daySlots) {
      if (spec.kind === 'takeaway') {
        choices.push({ spec, recipe: null });
        // Takeaway may be meat; assume it is so the dairy wait still applies.
        if (kosher) lastMeat = { minutes: spec.minutes, slot: spec.slot, fromRecipe: false };
        continue;
      }

      const meatBefore = lastMeat;
      const hardOk = (r: Recipe): boolean =>
        !isRecipeBlocked(r, profile) &&
        r.meal_types.includes(spec.slot) &&
        (!spec.shabbat || r.shabbat_friendly) &&
        !(noMeat.has(spec.slot) && r.kashrut_type === 'meat') &&
        !(
          kosher &&
          r.kashrut_type === 'dairy' &&
          meatBefore !== null &&
          spec.minutes - meatBefore.minutes < waitMinutes
        );
      const uses = (r: Recipe): number => weekUsage.get(r.id) ?? 0;
      const softOk = (r: Recipe): boolean => uses(r) < MAX_USES_PER_RECIPE && !usedToday.has(r.id);
      const preferred = profile.preferred_cuisines ?? [];
      // 0 when the dish matches a chosen kitchen, so those sort first. An empty
      // preference matches everything. Other valid recipes still fill a slot.
      const cuisineRank = (r: Recipe): number =>
        preferred.length === 0 || r.cuisines.some((cuisine) => preferred.includes(cuisine)) ? 0 : 1;
      const rank = (a: Recipe, b: Recipe): number =>
        cuisineRank(a) - cuisineRank(b) ||
        uses(a) - uses(b) ||
        Math.abs(a.calories - spec.budget) - Math.abs(b.calories - spec.budget) ||
        a.id.localeCompare(b.id);

      const suggestedId = suggested.get(`${spec.day}|${spec.slot}`);
      const fromModel = suggestedId ? byId.get(suggestedId) : undefined;
      let pick: Recipe | null = null;
      if (fromModel && hardOk(fromModel) && softOk(fromModel)) {
        pick = fromModel;
      } else {
        const valid = pool.filter(hardOk);
        pick = valid.filter(softOk).sort(rank)[0] ?? valid.sort(rank)[0] ?? null;
      }

      if (!pick) {
        if (meatBefore?.fromRecipe && !noMeat.has(meatBefore.slot)) {
          return { choices: [], blockedBy: meatBefore.slot };
        }
        choices.push({ spec, recipe: null });
        continue;
      }

      choices.push({ spec, recipe: pick });
      usedToday.add(pick.id);
      if (pick.kashrut_type === 'meat') {
        lastMeat = { minutes: spec.minutes, slot: spec.slot, fromRecipe: true };
      }
    }
    return { choices, blockedBy: null };
  };

  const result: SlotChoice[] = [];
  for (const day of WEEKDAYS) {
    const daySlots = slots.filter((s) => s.day === day).sort((a, b) => a.minutes - b.minutes);
    const noMeat = new Set<MealSlot>();
    let outcome = planDay(daySlots, noMeat);
    // Each retry bans meat in one more slot, so this ends within daySlots.length retries.
    while (outcome.blockedBy !== null) {
      noMeat.add(outcome.blockedBy);
      outcome = planDay(daySlots, noMeat);
    }
    for (const choice of outcome.choices) {
      if (choice.recipe) {
        weekUsage.set(choice.recipe.id, (weekUsage.get(choice.recipe.id) ?? 0) + 1);
      }
    }
    result.push(...outcome.choices);
  }
  return result;
}

export function roundPortion(value: number): number {
  const stepped = Math.round(value / PORTION_STEP) * PORTION_STEP;
  return Math.min(MAX_PORTION, Math.max(MIN_PORTION, stepped));
}

/** Sizes portions so each day lands as close as possible to the daily food target. */
export function buildDays(choices: SlotChoice[], profile: PlanningProfile): PlannedDay[] {
  const target = dailyFoodTarget(profile);
  const days: PlannedDay[] = [];

  for (const day of WEEKDAYS) {
    const dayChoices = choices.filter((c) => c.spec.day === day);
    if (dayChoices.length === 0) continue;

    const takeawayTotal = dayChoices
      .filter((c) => c.spec.kind === 'takeaway')
      .reduce((sum, c) => sum + c.spec.budget, 0);
    const recipeChoices = dayChoices.filter(
      (c): c is SlotChoice & { recipe: Recipe } => c.recipe !== null
    );
    const baseTotal = recipeChoices.reduce((sum, c) => sum + c.spec.budget, 0);
    const factor = baseTotal > 0 ? (target - takeawayTotal) / baseTotal : 1;
    const portions = recipeChoices.map((c) => roundPortion((c.spec.budget / c.recipe.calories) * factor));

    const totalFor = (ps: number[]): number =>
      takeawayTotal + recipeChoices.reduce((sum, c, i) => sum + Math.round(c.recipe.calories * ps[i]), 0);

    // Nudge single portions by one step while that moves the day closer to target.
    for (let iteration = 0; iteration < 8; iteration++) {
      const error = Math.abs(totalFor(portions) - target);
      let best: { index: number; value: number; error: number } | null = null;
      for (let index = 0; index < portions.length; index++) {
        for (const delta of [-PORTION_STEP, PORTION_STEP]) {
          const value = portions[index] + delta;
          if (value < MIN_PORTION || value > MAX_PORTION) continue;
          const candidate = [...portions];
          candidate[index] = value;
          const candidateError = Math.abs(totalFor(candidate) - target);
          if (candidateError < error && (!best || candidateError < best.error)) {
            best = { index, value, error: candidateError };
          }
        }
      }
      if (!best) break;
      portions[best.index] = best.value;
    }

    let recipeIndex = 0;
    const meals: PlannedMeal[] = dayChoices.map((c) => {
      const time = formatMinutes(c.spec.minutes);
      if (c.spec.kind === 'takeaway') {
        return {
          type: 'takeaway',
          slot: c.spec.slot,
          time,
          calories_budget: c.spec.budget,
          kosher_only: isKosher(profile),
        };
      }
      if (!c.recipe) return { type: 'unavailable', slot: c.spec.slot, time };
      const portion = portions[recipeIndex++];
      return {
        type: 'recipe',
        slot: c.spec.slot,
        time,
        recipe_id: c.recipe.id,
        portion_multiplier: portion,
        calories: Math.round(c.recipe.calories * portion),
        kashrut_type: c.recipe.kashrut_type,
        prepare_before_shabbat: c.spec.shabbat,
      };
    });

    days.push({
      date: dayChoices[0].spec.date,
      weekday: day,
      target_calories: target,
      total_calories: totalFor(portions),
      meals,
    });
  }
  return days;
}

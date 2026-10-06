import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildDays,
  buildSlots,
  chooseRecipes,
  currentWeekStart,
  dailyFoodTarget,
  MAX_PORTION,
  MIN_PORTION,
  parseSuggestions,
  parseTimeToMinutes,
  repairWeek,
} from './planRules.ts';
import { baseProfile, ing, RECIPES, recipe } from './testFixtures.ts';
import { MEAL_SLOTS, WEEKDAYS } from './types.ts';
import type { ModelSuggestion, PlannedDay, PlanningProfile } from './types.ts';

const WEEK = '2026-10-04';
const byId = new Map(RECIPES.map((r) => [r.id, r]));

function plan(profile: PlanningProfile, suggestions: ModelSuggestion[] = []): PlannedDay[] {
  const slots = buildSlots(profile, WEEK);
  return buildDays(chooseRecipes(slots, suggestions, RECIPES, profile), profile);
}

/** Worst case for kashrut: the model asks for meat lunches and dairy everywhere else. */
function adversarialSuggestions(): ModelSuggestion[] {
  return WEEKDAYS.flatMap((day) =>
    MEAL_SLOTS.map((slot) => ({
      day,
      slot,
      recipe_id: slot === 'lunch' ? 'chicken-pita-tahini' : 'cottage-veggie-plate',
    }))
  );
}

function assertKosherRules(days: PlannedDay[], waitHours: number): void {
  for (const day of days) {
    let lastMeat: number | null = null;
    for (const meal of day.meals) {
      const minutes = parseTimeToMinutes(meal.time);
      if (meal.type === 'takeaway') {
        lastMeat = minutes;
        continue;
      }
      if (meal.type !== 'recipe') continue;
      const recipe = byId.get(meal.recipe_id);
      assert.ok(recipe?.is_kosher, `${day.weekday} ${meal.slot}: non-kosher ${meal.recipe_id}`);
      if (meal.kashrut_type === 'dairy' && lastMeat !== null) {
        assert.ok(
          minutes - lastMeat >= waitHours * 60,
          `${day.weekday} ${meal.slot}: dairy ${meal.recipe_id} too soon after meat`
        );
      }
      if (meal.kashrut_type === 'meat') lastMeat = minutes;
      if (meal.prepare_before_shabbat) {
        assert.ok(recipe?.shabbat_friendly, `${day.weekday} ${meal.slot}: not Shabbat-friendly`);
      }
    }
  }
}

describe('time and calendar helpers', () => {
  it('parses HH:MM and HH:MM:SS', () => {
    assert.equal(parseTimeToMinutes('13:00'), 780);
    assert.equal(parseTimeToMinutes('16:30:00'), 990);
  });

  it('finds the Sunday of the current week in Israel time', () => {
    assert.equal(currentWeekStart(new Date('2026-10-07T10:00:00Z')), WEEK);
    // Saturday 22:30 UTC is already Sunday 01:30 in Israel.
    assert.equal(currentWeekStart(new Date('2026-10-10T22:30:00Z')), '2026-10-11');
  });

  it('reserves the cheat bank from the daily target', () => {
    assert.equal(dailyFoodTarget(baseProfile()), Math.round(1750 - 600 / 7));
  });
});

describe('buildSlots', () => {
  it('skips breakfast and turns office-day lunches into takeaway', () => {
    const slots = buildSlots(baseProfile(), WEEK);
    assert.equal(slots.length, 21);
    assert.equal(slots.filter((s) => s.slot === 'breakfast').length, 0);
    const takeaway = slots.filter((s) => s.kind === 'takeaway').map((s) => s.day);
    assert.deepEqual(takeaway, ['monday', 'wednesday']);
  });

  it('marks Friday dinner and all of Saturday as Shabbat only for kosher users', () => {
    assert.equal(buildSlots(baseProfile(), WEEK).filter((s) => s.shabbat).length, 0);
    const kosherSlots = buildSlots(baseProfile({ kosher_level: 'kosher' }), WEEK);
    const shabbat = kosherSlots.filter((s) => s.shabbat).map((s) => `${s.day}:${s.slot}`);
    assert.deepEqual(shabbat, ['friday:dinner', 'saturday:lunch', 'saturday:snack', 'saturday:dinner']);
  });

  it('never makes a Shabbat lunch a takeaway', () => {
    const profile = baseProfile({ kosher_level: 'kosher', office_days: ['saturday'] });
    const saturdayLunch = buildSlots(profile, WEEK).find((s) => s.day === 'saturday' && s.slot === 'lunch');
    assert.equal(saturdayLunch?.kind, 'recipe');
  });
});

describe('parseSuggestions', () => {
  it('drops malformed entries, unknown ids and duplicate slots', () => {
    const raw = {
      meals: [
        { day: 'sunday', slot: 'lunch', recipe_id: 'tuna-chickpea-salad' },
        { day: 'sunday', slot: 'lunch', recipe_id: 'salmon-sweet-potato' },
        { day: 'sunday', slot: 'dinner', recipe_id: 'made-up-recipe' },
        { day: 'funday', slot: 'lunch', recipe_id: 'tuna-chickpea-salad' },
        { day: 'monday', slot: 'snack' },
        'garbage',
      ],
    };
    const result = parseSuggestions(raw, new Set(byId.keys()));
    assert.deepEqual(result, [{ day: 'sunday', slot: 'lunch', recipe_id: 'tuna-chickpea-salad' }]);
    assert.deepEqual(parseSuggestions(null, new Set()), []);
    assert.deepEqual(parseSuggestions({ meals: 'x' }, new Set()), []);
  });
});

describe('chooseRecipes + buildDays', () => {
  it('keeps valid model suggestions', () => {
    const days = plan(baseProfile(), [{ day: 'sunday', slot: 'lunch', recipe_id: 'salmon-sweet-potato' }]);
    const sundayLunch = days[0].meals.find((m) => m.slot === 'lunch');
    assert.equal(sundayLunch?.type === 'recipe' && sundayLunch.recipe_id, 'salmon-sweet-potato');
  });

  it('fills every slot with a recipe whose meal type matches', () => {
    for (const day of plan(baseProfile())) {
      for (const meal of day.meals) {
        if (meal.type === 'recipe') {
          assert.ok(byId.get(meal.recipe_id)?.meal_types.includes(meal.slot));
        } else {
          assert.equal(meal.type, 'takeaway');
        }
      }
    }
  });

  it('enforces kashrut, the meat->dairy wait and Shabbat even against bad suggestions', () => {
    for (const waitHours of [6, 3, 1]) {
      for (const skipsBreakfast of [true, false]) {
        const profile = baseProfile({
          kosher_level: 'kosher',
          meat_dairy_wait_hours: waitHours,
          skips_breakfast: skipsBreakfast,
        });
        const days = plan(profile, adversarialSuggestions());
        assertKosherRules(days, waitHours);
        assert.ok(days.every((d) => d.meals.every((m) => m.type !== 'skip')), 'no slot left empty');
      }
    }
  });

  it('respects custom meal times for the wait (late snack after a meat lunch is fine)', () => {
    const profile = baseProfile({
      kosher_level: 'kosher',
      meal_times: { breakfast: '08:00', lunch: '12:00', snack: '18:30', dinner: '21:00' },
    });
    const days = plan(profile, adversarialSuggestions());
    assertKosherRules(days, 6);
    const sunday = days[0].meals;
    const lunch = sunday.find((m) => m.slot === 'lunch');
    const snack = sunday.find((m) => m.slot === 'snack');
    assert.equal(lunch?.type === 'recipe' && lunch.recipe_id, 'chicken-pita-tahini');
    assert.equal(snack?.type === 'recipe' && snack.recipe_id, 'cottage-veggie-plate');
  });

  it('never offers non-kosher recipes to kosher users', () => {
    const suggestions = WEEKDAYS.map((day) => ({ day, slot: 'dinner' as const, recipe_id: 'cheeseburger' }));
    const days = plan(baseProfile({ kosher_level: 'mehadrin' }), suggestions);
    const ids = days.flatMap((d) => d.meals.flatMap((m) => (m.type === 'recipe' ? [m.recipe_id] : [])));
    assert.ok(!ids.includes('cheeseburger'));
    const nonKosherDays = plan(baseProfile(), suggestions);
    assert.ok(nonKosherDays.some((d) => d.meals.some((m) => m.type === 'recipe' && m.recipe_id === 'cheeseburger')));
  });

  it('limits weekly repeats and avoids repeating a recipe on the same day', () => {
    const suggestions = WEEKDAYS.flatMap((day) =>
      MEAL_SLOTS.map((slot) => ({ day, slot, recipe_id: 'tuna-chickpea-salad' }))
    );
    const days = plan(baseProfile(), suggestions);
    const counts = new Map<string, number>();
    for (const day of days) {
      const ids = day.meals.flatMap((m) => (m.type === 'recipe' ? [m.recipe_id] : []));
      assert.equal(new Set(ids).size, ids.length, `${day.weekday} repeats a recipe`);
      for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    assert.ok([...counts.values()].every((n) => n <= 3), JSON.stringify([...counts]));
  });

  it('prefers a matching kitchen when two lunches have the same calories', () => {
    const pasta = recipe({
      id: 'aaa-pasta',
      title_en: 'Pasta',
      calories: 500,
      protein_g: 20,
      prep_time_minutes: 15,
      meal_types: ['lunch'],
      kashrut_type: 'dairy',
      is_kosher: true,
      shabbat_friendly: false,
      cuisines: ['italian'],
    });
    const sabich = recipe({
      id: 'sabich',
      title_en: 'Sabich',
      calories: 500,
      protein_g: 20,
      prep_time_minutes: 15,
      meal_types: ['lunch'],
      kashrut_type: 'parve',
      is_kosher: true,
      shabbat_friendly: true,
      cuisines: ['israeli'],
    });
    const profile = baseProfile({ preferred_cuisines: ['israeli'], office_days: [] });
    const slots = buildSlots(profile, WEEK).filter((slot) => slot.day === 'sunday' && slot.slot === 'lunch');
    const choices = chooseRecipes(slots, [], [pasta, sabich], profile);
    assert.equal(choices[0]?.recipe?.id, 'sabich');
  });

  it('never schedules a disliked dish, even when the model asks for it', () => {
    const pasta = recipe({
      id: 'aaa-pasta',
      title_en: 'Pasta',
      calories: 500,
      protein_g: 20,
      prep_time_minutes: 15,
      meal_types: ['lunch'],
      kashrut_type: 'dairy',
      is_kosher: true,
      shabbat_friendly: false,
    });
    const sabich = recipe({
      id: 'sabich',
      title_en: 'Sabich',
      calories: 500,
      protein_g: 20,
      prep_time_minutes: 15,
      meal_types: ['lunch'],
      kashrut_type: 'parve',
      is_kosher: true,
      shabbat_friendly: true,
    });
    const profile = baseProfile({ disliked_recipe_ids: ['sabich'], office_days: [] });
    const slots = buildSlots(profile, WEEK).filter((slot) => slot.day === 'sunday' && slot.slot === 'lunch');
    const choices = chooseRecipes(
      slots,
      [{ day: 'sunday', slot: 'lunch', recipe_id: 'sabich' }],
      [pasta, sabich],
      profile
    );
    assert.equal(choices[0]?.recipe?.id, 'aaa-pasta');
  });

  it('drops dishes that use a disliked ingredient, including as a swap', () => {
    const tuna = recipe({
      id: 'tuna-plate',
      title_en: 'Tuna',
      calories: 400,
      protein_g: 30,
      prep_time_minutes: 10,
      meal_types: ['lunch'],
      kashrut_type: 'parve',
      is_kosher: true,
      shabbat_friendly: true,
      ingredients: [ing('Tuna', 100, 'g', 'meat_fish')],
    });
    const chicken = recipe({
      id: 'chicken-plate',
      title_en: 'Chicken',
      calories: 500,
      protein_g: 40,
      prep_time_minutes: 15,
      meal_types: ['lunch'],
      kashrut_type: 'meat',
      is_kosher: true,
      shabbat_friendly: false,
      ingredients: [ing('Chicken breast', 150, 'g', 'meat_fish')],
    });
    const turkeySwap = recipe({
      id: 'turkey-wrap',
      title_en: 'Turkey wrap',
      calories: 480,
      protein_g: 35,
      prep_time_minutes: 15,
      meal_types: ['lunch'],
      kashrut_type: 'meat',
      is_kosher: true,
      shabbat_friendly: false,
      ingredients: [
        {
          ...ing('Turkey breast', 150, 'g', 'meat_fish'),
          swaps: [{ name_he: 'חזה עוף', name_en: 'Chicken breast', amount: 150, unit: 'g' }],
        },
      ],
    });
    const profile = baseProfile({
      disliked_ingredients: [{ name_en: '  Chicken   Breast ', name_he: 'חזה עוף' }],
      office_days: [],
    });
    const slots = buildSlots(profile, WEEK).filter((slot) => slot.day === 'sunday' && slot.slot === 'lunch');
    const choices = chooseRecipes(slots, [], [chicken, turkeySwap, tuna], profile);
    assert.equal(choices[0]?.recipe?.id, 'tuna-plate');
  });

  it('leaves a slot unavailable when every dish is disliked', () => {
    const only = recipe({
      id: 'only-lunch',
      title_en: 'Only lunch',
      calories: 450,
      protein_g: 20,
      prep_time_minutes: 10,
      meal_types: ['lunch'],
      kashrut_type: 'parve',
      is_kosher: true,
      shabbat_friendly: true,
    });
    const profile = baseProfile({ disliked_recipe_ids: ['only-lunch'], office_days: [] });
    const slots = buildSlots(profile, WEEK).filter((slot) => slot.day === 'sunday' && slot.slot === 'lunch');
    const days = buildDays(chooseRecipes(slots, [], [only], profile), profile);
    assert.equal(days[0]?.meals[0]?.type, 'unavailable');
  });

  it('sizes portions within bounds and close to the daily target', () => {
    for (const profile of [baseProfile(), baseProfile({ skips_breakfast: false, daily_calorie_target: 2200 })]) {
      for (const day of plan(profile)) {
        for (const meal of day.meals) {
          if (meal.type !== 'recipe') continue;
          assert.ok(meal.portion_multiplier >= MIN_PORTION && meal.portion_multiplier <= MAX_PORTION);
          assert.equal(meal.portion_multiplier % 0.25, 0);
        }
        const error = Math.abs(day.total_calories - day.target_calories) / day.target_calories;
        assert.ok(error <= 0.05, `${day.weekday}: ${day.total_calories} vs ${day.target_calories}`);
      }
    }
  });
});

describe('repairWeek', () => {
  function recipeAt(days: PlannedDay[], weekday: string, slot: string): string | undefined {
    const meal = days.find((day) => day.weekday === weekday)?.meals.find((item) => item.slot === slot);
    return meal?.type === 'recipe' ? meal.recipe_id : undefined;
  }

  it('keeps unblocked meals when one dish is banned', () => {
    const profile = baseProfile({ office_days: [] });
    const days = plan(profile, [
      { day: 'sunday', slot: 'lunch', recipe_id: 'chicken-pita-tahini' },
      { day: 'monday', slot: 'lunch', recipe_id: 'pasta-tomato-mozzarella' },
    ]);
    assert.equal(recipeAt(days, 'sunday', 'lunch'), 'chicken-pita-tahini');
    assert.equal(recipeAt(days, 'monday', 'lunch'), 'pasta-tomato-mozzarella');

    const repaired = repairWeek(
      days,
      RECIPES,
      { ...profile, disliked_recipe_ids: ['chicken-pita-tahini'] },
      WEEK
    );
    assert.notEqual(recipeAt(repaired, 'sunday', 'lunch'), 'chicken-pita-tahini');
    assert.ok(recipeAt(repaired, 'sunday', 'lunch'));
    assert.equal(recipeAt(repaired, 'monday', 'lunch'), 'pasta-tomato-mozzarella');
  });

  it('replaces every meal that uses a newly disliked ingredient, including swaps', () => {
    const chicken = recipe({
      id: 'chicken-plate',
      title_en: 'Chicken',
      calories: 500,
      protein_g: 40,
      prep_time_minutes: 15,
      meal_types: ['lunch'],
      kashrut_type: 'meat',
      is_kosher: true,
      shabbat_friendly: false,
      ingredients: [ing('Chicken breast', 150, 'g', 'meat_fish')],
    });
    const turkeySwap = recipe({
      id: 'turkey-wrap',
      title_en: 'Turkey wrap',
      calories: 480,
      protein_g: 35,
      prep_time_minutes: 15,
      meal_types: ['dinner'],
      kashrut_type: 'meat',
      is_kosher: true,
      shabbat_friendly: false,
      ingredients: [
        {
          ...ing('Turkey breast', 150, 'g', 'meat_fish'),
          swaps: [{ name_he: 'חזה עוף', name_en: 'Chicken breast', amount: 150, unit: 'g' }],
        },
      ],
    });
    const tuna = recipe({
      id: 'tuna-plate',
      title_en: 'Tuna',
      calories: 400,
      protein_g: 30,
      prep_time_minutes: 10,
      meal_types: ['lunch', 'dinner'],
      kashrut_type: 'parve',
      is_kosher: true,
      shabbat_friendly: true,
      ingredients: [ing('Tuna', 100, 'g', 'meat_fish')],
    });
    const fruit = recipe({
      id: 'fruit-snack',
      title_en: 'Fruit',
      calories: 180,
      protein_g: 4,
      prep_time_minutes: 5,
      meal_types: ['snack'],
      kashrut_type: 'parve',
      is_kosher: true,
      shabbat_friendly: true,
    });
    const catalog = [chicken, turkeySwap, tuna, fruit];
    const profile = baseProfile({ office_days: [] });
    const days = buildDays(
      chooseRecipes(
        buildSlots(profile, WEEK),
        [
          { day: 'sunday', slot: 'lunch', recipe_id: 'chicken-plate' },
          { day: 'sunday', slot: 'dinner', recipe_id: 'turkey-wrap' },
          { day: 'monday', slot: 'lunch', recipe_id: 'tuna-plate' },
        ],
        catalog,
        profile
      ),
      profile
    );
    assert.equal(recipeAt(days, 'sunday', 'lunch'), 'chicken-plate');
    assert.equal(recipeAt(days, 'sunday', 'dinner'), 'turkey-wrap');
    assert.equal(recipeAt(days, 'monday', 'lunch'), 'tuna-plate');

    const repaired = repairWeek(
      days,
      catalog,
      {
        ...profile,
        disliked_ingredients: [{ name_en: 'Chicken breast', name_he: 'חזה עוף' }],
      },
      WEEK
    );
    assert.notEqual(recipeAt(repaired, 'sunday', 'lunch'), 'chicken-plate');
    assert.notEqual(recipeAt(repaired, 'sunday', 'dinner'), 'turkey-wrap');
    assert.equal(recipeAt(repaired, 'monday', 'lunch'), 'tuna-plate');
  });

  it('does not keep the rejected dish in that slot', () => {
    const profile = baseProfile({ office_days: [] });
    const days = plan(profile, [{ day: 'sunday', slot: 'lunch', recipe_id: 'red-lentil-soup' }]);
    const repaired = repairWeek(
      days,
      RECIPES,
      { ...profile, disliked_recipe_ids: ['red-lentil-soup'] },
      WEEK
    );
    assert.notEqual(recipeAt(repaired, 'sunday', 'lunch'), 'red-lentil-soup');
  });

  it('drops a later dairy meal when the replacement is meat', () => {
    const tuna = recipe({
      id: 'tuna-lunch',
      title_en: 'Tuna',
      calories: 400,
      protein_g: 30,
      prep_time_minutes: 10,
      meal_types: ['lunch'],
      kashrut_type: 'parve',
      is_kosher: true,
      shabbat_friendly: true,
    });
    const chicken = recipe({
      id: 'chicken-lunch',
      title_en: 'Chicken',
      calories: 500,
      protein_g: 40,
      prep_time_minutes: 15,
      meal_types: ['lunch'],
      kashrut_type: 'meat',
      is_kosher: true,
      shabbat_friendly: false,
    });
    const yogurt = recipe({
      id: 'yogurt-snack',
      title_en: 'Yogurt',
      calories: 200,
      protein_g: 15,
      prep_time_minutes: 5,
      meal_types: ['snack'],
      kashrut_type: 'dairy',
      is_kosher: true,
      shabbat_friendly: true,
    });
    const fruit = recipe({
      id: 'fruit-snack',
      title_en: 'Fruit',
      calories: 180,
      protein_g: 4,
      prep_time_minutes: 5,
      meal_types: ['snack'],
      kashrut_type: 'parve',
      is_kosher: true,
      shabbat_friendly: true,
    });
    const pasta = recipe({
      id: 'pasta-dinner',
      title_en: 'Pasta',
      calories: 500,
      protein_g: 20,
      prep_time_minutes: 15,
      meal_types: ['dinner'],
      kashrut_type: 'dairy',
      is_kosher: true,
      shabbat_friendly: false,
    });
    const catalog = [tuna, chicken, yogurt, fruit, pasta];
    const profile = baseProfile({
      kosher_level: 'kosher',
      office_days: [],
      meat_dairy_wait_hours: 6,
    });
    const days = buildDays(
      chooseRecipes(
        buildSlots(profile, WEEK),
        [
          { day: 'sunday', slot: 'lunch', recipe_id: 'tuna-lunch' },
          { day: 'sunday', slot: 'snack', recipe_id: 'yogurt-snack' },
          { day: 'sunday', slot: 'dinner', recipe_id: 'pasta-dinner' },
        ],
        catalog,
        profile
      ),
      profile
    );
    assert.equal(recipeAt(days, 'sunday', 'lunch'), 'tuna-lunch');
    assert.equal(recipeAt(days, 'sunday', 'snack'), 'yogurt-snack');
    assert.equal(recipeAt(days, 'sunday', 'dinner'), 'pasta-dinner');

    const repaired = repairWeek(
      days,
      catalog,
      { ...profile, disliked_recipe_ids: ['tuna-lunch'] },
      WEEK
    );
    assert.equal(recipeAt(repaired, 'sunday', 'lunch'), 'chicken-lunch');
    assert.equal(recipeAt(repaired, 'sunday', 'snack'), 'fruit-snack');
    assert.equal(recipeAt(repaired, 'sunday', 'dinner'), 'pasta-dinner');
  });
});

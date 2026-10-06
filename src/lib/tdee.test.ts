import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildProfileInput, DEFAULT_FORM_VALUES } from './profileForm.ts';
import type { ProfileFormValues } from './profileForm.ts';
import { ageOn, calorieTargets } from './tdee.ts';
import { movingAverages } from './weightTrend.ts';

const TODAY = '2026-10-04';

test('ageOn counts the birthday only once it has passed', () => {
  assert.equal(ageOn('1990-10-04', TODAY), 36);
  assert.equal(ageOn('1990-10-05', TODAY), 35);
});

test('calorieTargets: Mifflin-St Jeor with a 500 kcal deficit', () => {
  // BMR = 10*90 + 6.25*180 - 5*36 + 5 = 1850; x1.375 = 2543.75 -> 2540
  const t = calorieTargets({
    birthDate: '1990-01-01',
    sex: 'male',
    heightCm: 180,
    weightKg: 90,
    targetWeightKg: 80,
    activity: 'light',
    today: TODAY,
  });
  assert.equal(t.maintenance, 2540);
  assert.equal(t.dailyTarget, 2040);
  assert.equal(t.weeklyCheatBank, 1000);
});

test('calorieTargets: smaller deficit near the goal, none when no loss is needed', () => {
  const base = {
    birthDate: '1990-01-01',
    sex: 'male' as const,
    heightCm: 180,
    weightKg: 90,
    activity: 'light' as const,
    today: TODAY,
  };
  assert.equal(calorieTargets({ ...base, targetWeightKg: 87 }).dailyTarget, 2190);
  assert.equal(calorieTargets({ ...base, targetWeightKg: 90 }).dailyTarget, 2540);
});

test('calorieTargets never goes below the safe minimum', () => {
  // BMR = 600 + 1000 - 5*36 - 161 = 1259; x1.2 -> 1510; minus 500 would be 1010
  const t = calorieTargets({
    birthDate: '1990-01-01',
    sex: 'female',
    heightCm: 160,
    weightKg: 60,
    targetWeightKg: 50,
    activity: 'sedentary',
    today: TODAY,
  });
  assert.equal(t.dailyTarget, 1200);
});

test('black coffee does not change the target; milk and sugar do', () => {
  const base = {
    birthDate: '1990-01-01',
    sex: 'male' as const,
    heightCm: 180,
    weightKg: 90,
    targetWeightKg: 80,
    activity: 'light' as const,
    today: TODAY,
  };
  const plain = calorieTargets(base);
  const black = calorieTargets({ ...base, coffeeBlackCups: 3 });
  const milky = calorieTargets({ ...base, coffeeMilkCups: 2, coffeeSugarTsp: 1 });
  assert.equal(black.dailyTarget, plain.dailyTarget);
  assert.equal(black.coffeeKcal, 0);
  assert.equal(milky.coffeeKcal, 152);
  assert.equal(milky.dailyTarget, plain.dailyTarget - 152);
});

test('daily smoking raises maintenance; a former smoker does not', () => {
  const base = {
    birthDate: '1990-01-01',
    sex: 'male' as const,
    heightCm: 180,
    weightKg: 90,
    targetWeightKg: 80,
    activity: 'light' as const,
    today: TODAY,
  };
  assert.equal(calorieTargets({ ...base, smoking: 'daily' }).maintenance, 2720);
  assert.equal(calorieTargets({ ...base, smoking: 'daily' }).dailyTarget, 2220);
  assert.equal(calorieTargets({ ...base, smoking: 'former' }).maintenance, 2540);
});

test('calorieTargets stays at maintenance when maintenance is below the minimum', () => {
  // BMR = 500 + 937.5 - 5*66 - 161 = 946.5; x1.2 -> 1140
  const t = calorieTargets({
    birthDate: '1960-01-01',
    sex: 'female',
    heightCm: 150,
    weightKg: 50,
    targetWeightKg: 40,
    activity: 'sedentary',
    today: TODAY,
  });
  assert.equal(t.dailyTarget, t.maintenance);
  assert.equal(t.dailyTarget, 1140);
});

const validForm: ProfileFormValues = {
  ...DEFAULT_FORM_VALUES,
  birthDate: '1990-01-01',
  sex: 'male',
  heightCm: '180',
  currentWeightKg: '90,0',
  targetWeightKg: '80',
};

test('buildProfileInput stores coffee and smoking and shrinks the food target', () => {
  const result = buildProfileInput(
    {
      ...validForm,
      smoking: 'daily',
      coffeeBlackCups: 3,
      coffeeMilkCups: 2,
      coffeeSugarTsp: 0,
    },
    TODAY
  );
  assert.ok(result.ok);
  assert.equal(result.input.smoking, 'daily');
  assert.equal(result.input.coffee_black_cups, 3);
  assert.equal(result.input.coffee_milk_cups, 2);
  assert.equal(result.coffeeKcal, 120);
  assert.equal(result.input.daily_calorie_target, 2100);
});

test('buildProfileInput accepts a valid form and a comma decimal', () => {
  const result = buildProfileInput(validForm, TODAY);
  assert.ok(result.ok);
  assert.equal(result.input.current_weight_kg, 90);
  assert.equal(result.input.start_weight_kg, 90);
  assert.equal(result.input.daily_calorie_target, 2040);
});

test('buildProfileInput keeps the original start weight when editing', () => {
  const result = buildProfileInput(validForm, TODAY, { start_weight_kg: 95 });
  assert.ok(result.ok);
  assert.equal(result.input.start_weight_kg, 95);
});

test('buildProfileInput reports each invalid field', () => {
  const result = buildProfileInput(
    {
      ...validForm,
      birthDate: '2015-02-30',
      sex: null,
      heightCm: '90',
      mealTimes: { ...validForm.mealTimes, lunch: '07:00' },
    },
    TODAY
  );
  assert.ok(!result.ok);
  assert.deepEqual(result.errors.sort(), ['birthDate', 'heightCm', 'mealTimes', 'sex']);
});

test('buildProfileInput requires at least one kitchen', () => {
  const result = buildProfileInput({ ...validForm, cuisines: [] }, TODAY);
  assert.ok(!result.ok);
  assert.ok(result.errors.includes('cuisines'));
});

test('movingAverages uses up to 7 previous entries', () => {
  assert.deepEqual(movingAverages([80, 82, 81]), [80, 81, 81]);
  assert.deepEqual(movingAverages([1, 2, 3, 4, 5, 6, 7, 8]).at(-1), 5);
});

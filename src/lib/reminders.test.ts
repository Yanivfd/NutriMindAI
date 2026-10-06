import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildReminders } from './reminders.ts';
import type { ReminderMealInput, ReminderSwitches } from './reminders.ts';

const ON: ReminderSwitches = {
  meals: true,
  shopping: true,
  water: true,
  weight: false,
  checkIn: false,
};

function meal(overrides: Partial<ReminderMealInput> = {}): ReminderMealInput {
  return {
    date: '2026-10-07',
    time: '13:00',
    type: 'recipe',
    slot: 'lunch',
    recipeTitle: 'Soup',
    prepMinutes: 15,
    ...overrides,
  };
}

test('a recipe meal is reminded by its prep time, and at least 10 minutes ahead', () => {
  const now = new Date(2026, 9, 5, 12, 0, 0, 0);
  const planned = buildReminders({
    now,
    language: 'he',
    kosher: false,
    switches: ON,
    hasPlan: true,
    meals: [meal(), meal({ slot: 'snack', time: '16:00', prepMinutes: 5, recipeTitle: 'Yogurt' })],
  });
  const lunch = planned.find((item) => item.id === 'meal:2026-10-07:lunch');
  const snack = planned.find((item) => item.id === 'meal:2026-10-07:snack');
  assert.equal(lunch?.at.getTime(), new Date(2026, 9, 7, 12, 45).getTime());
  assert.equal(lunch?.minutes, 15);
  assert.equal(snack?.at.getTime(), new Date(2026, 9, 7, 15, 50).getTime());
  assert.equal(snack?.minutes, 5);
});

test('a meal that would already have fired is dropped, and so is a skip', () => {
  const planned = buildReminders({
    now: new Date(2026, 9, 7, 13, 0, 0, 0),
    language: 'en',
    kosher: false,
    switches: ON,
    hasPlan: true,
    meals: [meal(), meal({ type: 'skip', slot: 'dinner', time: '19:00' })],
  });
  assert.equal(
    planned.some((item) => item.id.startsWith('meal:')),
    false
  );
});

test('Hebrew shops on Wednesday and English on Thursday, both at 17:00', () => {
  const now = new Date(2026, 9, 5, 12, 0, 0, 0);
  const hebrew = buildReminders({
    now,
    language: 'he',
    kosher: false,
    switches: { meals: false, shopping: true, water: false, weight: false, checkIn: false },
    hasPlan: true,
    meals: [],
  });
  const english = buildReminders({
    now,
    language: 'en',
    kosher: false,
    switches: { meals: false, shopping: true, water: false, weight: false, checkIn: false },
    hasPlan: false,
    meals: [],
  });
  assert.equal(hebrew[0]?.id, 'shop:2026-10-07');
  assert.equal(hebrew[0]?.at.getTime(), new Date(2026, 9, 7, 17, 0).getTime());
  assert.equal(hebrew[0]?.bodyKey, 'reminders.shopBody');
  assert.equal(hebrew[0]?.route, 'grocery');
  assert.equal(english[0]?.id, 'shop:2026-10-08');
  assert.equal(english[0]?.at.getTime(), new Date(2026, 9, 8, 17, 0).getTime());
  assert.equal(english[0]?.bodyKey, 'reminders.shopNoPlanBody');
});

test('water is every two hours from 09:00 through 21:00', () => {
  const planned = buildReminders({
    now: new Date(2026, 9, 5, 8, 0, 0, 0),
    language: 'en',
    kosher: false,
    switches: { meals: false, shopping: false, water: true, weight: false, checkIn: false },
    hasPlan: false,
    meals: [],
  });
  const ids = new Set(planned.map((item) => item.id));
  assert.equal(ids.has('water:2026-10-05:09'), true);
  assert.equal(ids.has('water:2026-10-05:21'), true);
  assert.equal(ids.has('water:2026-10-05:07'), false);
  assert.equal(ids.has('water:2026-10-05:23'), false);
  assert.equal(ids.has('water:2026-10-05:10'), false);
});

test('kosher users get one Friday morning Shabbat reminder when a meal is prepare-ahead', () => {
  const meals = [meal({ date: '2026-10-10', time: '13:00', slot: 'lunch', prepareBeforeShabbat: true })];
  const kosher = buildReminders({
    now: new Date(2026, 9, 5, 8, 0, 0, 0),
    language: 'he',
    kosher: true,
    switches: { meals: true, shopping: false, water: false, weight: false, checkIn: false },
    hasPlan: true,
    meals,
  });
  const plain = buildReminders({
    now: new Date(2026, 9, 5, 8, 0, 0, 0),
    language: 'he',
    kosher: false,
    switches: { meals: true, shopping: false, water: false, weight: false, checkIn: false },
    hasPlan: true,
    meals,
  });
  const shabbat = kosher.find((item) => item.id === 'shabbat:2026-10-09');
  assert.equal(shabbat?.at.getTime(), new Date(2026, 9, 9, 9, 0).getTime());
  assert.equal(shabbat?.channel, 'meals');
  assert.equal(
    plain.some((item) => item.id.startsWith('shabbat:')),
    false
  );
});

test('weigh-in is Sunday and Wednesday at 08:00', () => {
  const planned = buildReminders({
    now: new Date(2026, 9, 5, 12, 0, 0, 0),
    language: 'en',
    kosher: false,
    switches: { meals: false, shopping: false, water: false, weight: true, checkIn: false },
    hasPlan: false,
    meals: [],
  });
  const ids = planned.map((item) => item.id);
  assert.deepEqual(ids, ['weight:2026-10-07', 'weight:2026-10-11']);
  assert.equal(planned[0]?.at.getTime(), new Date(2026, 9, 7, 8, 0).getTime());
  assert.equal(planned[0]?.route, 'profile');
  assert.equal(planned[1]?.at.getTime(), new Date(2026, 9, 11, 8, 0).getTime());
});

test('a takeaway is reminded 20 minutes before, and a meal beyond 7 days is not', () => {
  const planned = buildReminders({
    now: new Date(2026, 9, 5, 12, 0, 0, 0),
    language: 'en',
    kosher: false,
    switches: { meals: true, shopping: false, water: false, weight: false, checkIn: false },
    hasPlan: true,
    meals: [
      meal({ type: 'takeaway', time: '13:00' }),
      meal({ date: '2026-10-13', time: '12:00', slot: 'lunch' }),
    ],
  });
  assert.equal(planned.length, 1);
  assert.equal(planned[0]?.titleKey, 'reminders.takeawayTitle');
  assert.equal(planned[0]?.at.getTime(), new Date(2026, 9, 7, 12, 40).getTime());
});

test('daily check-in is 21:00 on days that have a real meal', () => {
  const planned = buildReminders({
    now: new Date(2026, 9, 5, 12, 0, 0, 0),
    language: 'en',
    kosher: false,
    switches: { meals: false, shopping: false, water: false, weight: false, checkIn: true },
    hasPlan: true,
    meals: [
      meal({ date: '2026-10-07', slot: 'lunch' }),
      meal({ date: '2026-10-07', slot: 'dinner', time: '19:30' }),
      meal({ date: '2026-10-08', type: 'skip', slot: 'breakfast', time: '08:00' }),
    ],
  });
  assert.deepEqual(
    planned.map((item) => item.id),
    ['checkin:2026-10-07']
  );
  assert.equal(planned[0]?.at.getTime(), new Date(2026, 9, 7, 21, 0).getTime());
  assert.equal(planned[0]?.channel, 'checkin');
  assert.equal(planned[0]?.route, 'week');
});

test('daily check-in stays off when the switch is silenced, and after 21:00', () => {
  const silenced = buildReminders({
    now: new Date(2026, 9, 7, 12, 0, 0, 0),
    language: 'en',
    kosher: false,
    switches: { meals: false, shopping: false, water: false, weight: false, checkIn: false },
    hasPlan: true,
    meals: [meal()],
  });
  const past = buildReminders({
    now: new Date(2026, 9, 7, 21, 30, 0, 0),
    language: 'en',
    kosher: false,
    switches: { meals: false, shopping: false, water: false, weight: false, checkIn: true },
    hasPlan: true,
    meals: [meal()],
  });
  assert.equal(silenced.length, 0);
  assert.equal(
    past.some((item) => item.id === 'checkin:2026-10-07'),
    false
  );
});

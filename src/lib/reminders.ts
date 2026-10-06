import { WEEKDAYS } from '../../supabase/functions/_shared/types.ts';
import type { MealSlot } from '../../supabase/functions/_shared/types.ts';

import { addDays, weekdayOf } from './week.ts';

/** How far ahead alarms are written. Opening the app refreshes them. */
export const REMINDER_HORIZON_MS = 7 * 24 * 60 * 60 * 1000;
export const MIN_MEAL_LEAD_MINUTES = 10;
export const TAKEAWAY_LEAD_MINUTES = 20;
const SHOP_HOUR = 17;
const WATER_START_HOUR = 9;
const WATER_END_HOUR = 21;
const WATER_EVERY_HOURS = 2;
const SHABBAT_HOUR = 9;
const WEIGH_IN_HOUR = 8;
const CHECK_IN_HOUR = 21;

export interface ReminderSwitches {
  meals: boolean;
  shopping: boolean;
  water: boolean;
  weight: boolean;
  checkIn: boolean;
}

export interface ReminderMealInput {
  date: string;
  time: string;
  type: 'recipe' | 'takeaway' | 'skip' | 'unavailable';
  slot: MealSlot;
  recipeTitle?: string;
  prepMinutes?: number;
  prepareBeforeShabbat?: boolean;
}

export interface PlannedReminder {
  id: string;
  at: Date;
  channel: 'meals' | 'shopping' | 'water' | 'weight' | 'checkin';
  titleKey: string;
  bodyKey: string;
  route: 'week' | 'grocery' | 'profile';
  slot?: MealSlot;
  recipeTitle?: string;
  minutes?: number;
}

/** Local calendar instant for a plan date and HH:MM time. */
export function atLocal(date: string, time: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, hour ?? 0, minute ?? 0, 0, 0);
}

function inHorizon(now: Date, at: Date): boolean {
  const delta = at.getTime() - now.getTime();
  return delta > 0 && delta <= REMINDER_HORIZON_MS;
}

function dateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Next 17:00 on Wednesday (Hebrew) or Thursday (English), strictly after `now`. */
function nextShopAt(now: Date, language: 'he' | 'en'): Date {
  const target = language === 'he' ? 'wednesday' : 'thursday';
  const today = dateKey(now);
  for (let offset = 0; offset <= 7; offset += 1) {
    const date = addDays(today, offset);
    if (weekdayOf(date) !== target) continue;
    const at = atLocal(date, `${SHOP_HOUR}:00`);
    if (at.getTime() > now.getTime()) return at;
  }
  return atLocal(addDays(today, 7), `${SHOP_HOUR}:00`);
}

function fridayOf(date: string): string {
  return addDays(date, WEEKDAYS.indexOf('friday') - WEEKDAYS.indexOf(weekdayOf(date)));
}

function mealReminders(now: Date, meals: ReminderMealInput[]): PlannedReminder[] {
  const reminders: PlannedReminder[] = [];
  for (const meal of meals) {
    if (meal.type === 'skip' || meal.type === 'unavailable') continue;
    const lead = meal.type === 'takeaway' ? TAKEAWAY_LEAD_MINUTES : Math.max(meal.prepMinutes ?? 0, MIN_MEAL_LEAD_MINUTES);
    const at = new Date(atLocal(meal.date, meal.time.slice(0, 5)).getTime() - lead * 60_000);
    if (!inHorizon(now, at)) continue;
    reminders.push({
      id: `meal:${meal.date}:${meal.slot}`,
      at,
      channel: 'meals',
      titleKey: meal.type === 'takeaway' ? 'reminders.takeawayTitle' : 'reminders.mealTitle',
      bodyKey: meal.type === 'takeaway' ? 'reminders.takeawayBody' : 'reminders.mealBody',
      route: 'week',
      slot: meal.slot,
      recipeTitle: meal.recipeTitle,
      minutes:
        meal.type === 'recipe' && (meal.prepMinutes ?? 0) > 0 ? meal.prepMinutes : MIN_MEAL_LEAD_MINUTES,
    });
  }
  return reminders;
}

function shabbatReminders(now: Date, meals: ReminderMealInput[]): PlannedReminder[] {
  const fridays = new Set<string>();
  for (const meal of meals) {
    if (meal.prepareBeforeShabbat) fridays.add(fridayOf(meal.date));
  }
  const reminders: PlannedReminder[] = [];
  for (const friday of fridays) {
    const at = atLocal(friday, `${String(SHABBAT_HOUR).padStart(2, '0')}:00`);
    if (!inHorizon(now, at)) continue;
    reminders.push({
      id: `shabbat:${friday}`,
      at,
      channel: 'meals',
      titleKey: 'reminders.shabbatTitle',
      bodyKey: 'reminders.shabbatBody',
      route: 'week',
    });
  }
  return reminders;
}

function weightReminders(now: Date): PlannedReminder[] {
  const reminders: PlannedReminder[] = [];
  const today = dateKey(now);
  for (let offset = 0; offset <= 7; offset += 1) {
    const date = addDays(today, offset);
    const weekday = weekdayOf(date);
    if (weekday !== 'sunday' && weekday !== 'wednesday') continue;
    const at = atLocal(date, `${String(WEIGH_IN_HOUR).padStart(2, '0')}:00`);
    if (!inHorizon(now, at)) continue;
    reminders.push({
      id: `weight:${date}`,
      at,
      channel: 'weight',
      titleKey: 'reminders.weightTitle',
      bodyKey: 'reminders.weightBody',
      route: 'profile',
    });
  }
  return reminders;
}

function checkInReminders(now: Date, meals: ReminderMealInput[]): PlannedReminder[] {
  const dates = new Set<string>();
  for (const meal of meals) {
    if (meal.type === 'skip' || meal.type === 'unavailable') continue;
    dates.add(meal.date);
  }
  const reminders: PlannedReminder[] = [];
  for (const date of dates) {
    const at = atLocal(date, `${String(CHECK_IN_HOUR).padStart(2, '0')}:00`);
    if (!inHorizon(now, at)) continue;
    reminders.push({
      id: `checkin:${date}`,
      at,
      channel: 'checkin',
      titleKey: 'reminders.checkInTitle',
      bodyKey: 'reminders.checkInBody',
      route: 'week',
    });
  }
  return reminders;
}

function waterReminders(now: Date): PlannedReminder[] {
  const reminders: PlannedReminder[] = [];
  const today = dateKey(now);
  for (let offset = 0; offset <= 7; offset += 1) {
    const date = addDays(today, offset);
    for (let hour = WATER_START_HOUR; hour <= WATER_END_HOUR; hour += WATER_EVERY_HOURS) {
      const at = atLocal(date, `${String(hour).padStart(2, '0')}:00`);
      if (!inHorizon(now, at)) continue;
      reminders.push({
        id: `water:${date}:${String(hour).padStart(2, '0')}`,
        at,
        channel: 'water',
        titleKey: 'reminders.waterTitle',
        bodyKey: 'reminders.waterBody',
        route: 'week',
      });
    }
  }
  return reminders;
}

/** Upcoming alarms for the next 7 days. Past meals and quiet slots are left out. */
export function buildReminders(input: {
  now: Date;
  language: 'he' | 'en';
  kosher: boolean;
  switches: ReminderSwitches;
  hasPlan: boolean;
  meals: ReminderMealInput[];
}): PlannedReminder[] {
  const reminders: PlannedReminder[] = [];
  if (input.switches.meals) {
    reminders.push(...mealReminders(input.now, input.meals));
    if (input.kosher) reminders.push(...shabbatReminders(input.now, input.meals));
  }
  if (input.switches.shopping) {
    const at = nextShopAt(input.now, input.language);
    if (inHorizon(input.now, at)) {
      reminders.push({
        id: `shop:${dateKey(at)}`,
        at,
        channel: 'shopping',
        titleKey: 'reminders.shopTitle',
        bodyKey: input.hasPlan ? 'reminders.shopBody' : 'reminders.shopNoPlanBody',
        route: 'grocery',
      });
    }
  }
  if (input.switches.water) reminders.push(...waterReminders(input.now));
  if (input.switches.weight) reminders.push(...weightReminders(input.now));
  if (input.switches.checkIn) reminders.push(...checkInReminders(input.now, input.meals));
  return reminders.sort((a, b) => a.at.getTime() - b.at.getTime());
}

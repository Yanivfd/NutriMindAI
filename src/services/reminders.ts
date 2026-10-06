// Import the local-notification files directly. The package entry also starts
// push-token registration, and that throws in Expo Go on Android.
import { router } from 'expo-router';
import { cancelScheduledNotificationAsync } from 'expo-notifications/build/cancelScheduledNotificationAsync';
import { getAllScheduledNotificationsAsync } from 'expo-notifications/build/getAllScheduledNotificationsAsync';
import { AndroidImportance } from 'expo-notifications/build/NotificationChannelManager.types';
import { getPermissionsAsync, requestPermissionsAsync } from 'expo-notifications/build/NotificationPermissions';
import {
  addNotificationResponseReceivedListener,
  clearLastNotificationResponse,
  getLastNotificationResponse,
} from 'expo-notifications/build/NotificationsEmitter';
import { setNotificationHandler } from 'expo-notifications/build/NotificationsHandler';
import type { Notification } from 'expo-notifications/build/Notifications.types';
import { SchedulableTriggerInputTypes } from 'expo-notifications/build/Notifications.types';
import { scheduleNotificationAsync } from 'expo-notifications/build/scheduleNotificationAsync';
import { setNotificationChannelAsync } from 'expo-notifications/build/setNotificationChannelAsync';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { localizedTitle } from '@/lib/format';
import { i18n, useLanguage } from '@/lib/i18n';
import { buildReminders } from '@/lib/reminders';
import type { PlannedReminder, ReminderMealInput } from '@/lib/reminders';
import { weekStartFor } from '@/lib/week';
import { usePreferencesStore } from '@/store/usePreferencesStore';
import type { Language } from '@/store/usePreferencesStore';
import type { RecipeRow } from '@/types/db';
import type { WeeklyPlanPayload } from '@/types/plan';

import { useProfile, useRecipes, useWeeklyPlan } from './menuApi';

const PREFIX = 'diet:';

setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let generation = 0;

function mealName(reminder: PlannedReminder, language: Language): string {
  if (reminder.recipeTitle) return reminder.recipeTitle;
  if (reminder.slot) return i18n.t(`slots.${reminder.slot}`, { locale: language });
  return '';
}

async function ensureChannels(language: Language): Promise<void> {
  const channels = [
    { id: 'meals', nameKey: 'reminders.channelMeals', importance: AndroidImportance.HIGH },
    {
      id: 'shopping',
      nameKey: 'reminders.channelShopping',
      importance: AndroidImportance.DEFAULT,
    },
    { id: 'water', nameKey: 'reminders.channelWater', importance: AndroidImportance.DEFAULT },
    { id: 'weight', nameKey: 'reminders.channelWeight', importance: AndroidImportance.DEFAULT },
    { id: 'checkin', nameKey: 'reminders.channelCheckIn', importance: AndroidImportance.DEFAULT },
  ] as const;
  await Promise.all(
    channels.map((channel) =>
      setNotificationChannelAsync(channel.id, {
        name: i18n.t(channel.nameKey, { locale: language }),
        importance: channel.importance,
      })
    )
  );
}

async function cancelOurs(): Promise<void> {
  const scheduled = await getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((item) => item.identifier.startsWith(PREFIX))
      .map((item) => cancelScheduledNotificationAsync(item.identifier))
  );
}

/** Drops this app's pending alarms. Used when the user signs out. */
export async function cancelAppReminders(): Promise<void> {
  generation += 1;
  await cancelOurs();
}

/** Replaces the next week of alarms. Asks for permission only when a reminder is switched on. */
export async function syncScheduledReminders(options: {
  reminders: PlannedReminder[];
  language: Language;
  requestPermission: boolean;
}): Promise<void> {
  const ticket = ++generation;
  if (!options.requestPermission) {
    await cancelOurs();
    return;
  }
  const current = await getPermissionsAsync();
  if (ticket !== generation) return;
  const permission = current.granted ? current : await requestPermissionsAsync();
  if (ticket !== generation || !permission.granted) return;
  await ensureChannels(options.language);
  if (ticket !== generation) return;
  await cancelOurs();
  if (ticket !== generation) return;
  for (const reminder of options.reminders) {
    if (ticket !== generation) return;
    await scheduleNotificationAsync({
      identifier: `${PREFIX}${reminder.id}`,
      content: {
        title: i18n.t(reminder.titleKey, { locale: options.language }),
        body: i18n.t(reminder.bodyKey, {
          locale: options.language,
          meal: mealName(reminder, options.language),
          minutes: reminder.minutes,
        }),
        data: { route: reminder.route },
        sound: true,
      },
      trigger: {
        type: SchedulableTriggerInputTypes.DATE,
        date: reminder.at,
        channelId: reminder.channel,
      },
    });
  }
}

function mealsOf(
  plan: WeeklyPlanPayload | undefined,
  recipes: Map<string, RecipeRow> | undefined,
  language: Language
): ReminderMealInput[] {
  if (!plan) return [];
  return plan.days.flatMap((day) =>
    day.meals.map((meal) => {
      const recipe = meal.type === 'recipe' ? recipes?.get(meal.recipe_id) : undefined;
      return {
        date: day.date,
        time: meal.time.slice(0, 5),
        type: meal.type,
        slot: meal.slot,
        recipeTitle: recipe ? localizedTitle(recipe, language) : undefined,
        prepMinutes: recipe?.prep_time_minutes,
        prepareBeforeShabbat: meal.type === 'recipe' && meal.prepare_before_shabbat,
      };
    })
  );
}

function openReminder(notification: Notification): void {
  const route = notification.request.content.data?.route;
  if (route === 'grocery') router.push('/(tabs)/grocery');
  else if (route === 'profile') router.push('/(tabs)/profile');
  else if (route === 'week') router.push('/(tabs)');
}

/** Sends a tapped reminder to the week or the shopping list. */
export function ReminderNavigation(): null {
  useEffect(() => {
    const last = getLastNotificationResponse();
    if (last?.notification) {
      openReminder(last.notification);
      clearLastNotificationResponse();
    }
    const subscription = addNotificationResponseReceivedListener((response) => {
      openReminder(response.notification);
    });
    return () => subscription.remove();
  }, []);
  return null;
}

/** 'denied' only after Android has refused. The profile uses it to explain a missing reminder. */
export function useNotificationPermission(): 'granted' | 'denied' | 'undetermined' {
  const [status, setStatus] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  useEffect(() => {
    const refresh = () => {
      void getPermissionsAsync().then((current) => {
        if (current.granted) setStatus('granted');
        else if (current.status === 'denied') setStatus('denied');
        else setStatus('undetermined');
      });
    };
    refresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, []);
  return status;
}

/** Rewrites phone alarms from the current and next week whenever the plan or switches change. */
export function ReminderSync(): null {
  const language = useLanguage();
  const reminders = usePreferencesStore((state) => state.reminders);
  const profile = useProfile();
  const current = useWeeklyPlan(weekStartFor(0));
  const upcoming = useWeeklyPlan(weekStartFor(1));
  const recipes = useRecipes();
  const [foreground, setForeground] = useState(0);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setForeground((count) => count + 1);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    return () => {
      void cancelAppReminders();
    };
  }, []);

  useEffect(() => {
    if (profile.isPending || current.isPending || upcoming.isPending || recipes.isPending) return;
    const enabled =
      reminders.meals || reminders.shopping || reminders.water || reminders.weight || reminders.checkIn;
    const meals = [
      ...mealsOf(current.data?.plan, recipes.data, language),
      ...mealsOf(upcoming.data?.plan, recipes.data, language),
    ];
    const planned = enabled
      ? buildReminders({
          now: new Date(),
          language,
          kosher: (profile.data?.kosher_level ?? 'none') !== 'none',
          switches: reminders,
          hasPlan: Boolean(current.data || upcoming.data),
          meals,
        })
      : [];
    void syncScheduledReminders({ reminders: planned, language, requestPermission: enabled }).catch(
      () => undefined
    );
  }, [
    language,
    reminders,
    profile.data,
    profile.isPending,
    current.data,
    current.isPending,
    upcoming.data,
    upcoming.isPending,
    recipes.data,
    recipes.isPending,
    foreground,
  ]);

  return null;
}

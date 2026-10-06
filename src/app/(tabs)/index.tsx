import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AdBanner } from '@/components/AdBanner';
import { CalorieRing } from '@/components/CalorieRing';
import { MealCheckIn } from '@/components/MealCheckIn';
import { Text } from '@/components/Text';
import { Button, Card, CenteredMessage, EmptyState, Loading } from '@/components/ui';
import { WeekToggle } from '@/components/WeekToggle';
import { useT } from '@/lib/i18n';
import { dayEatenCalories } from '@/lib/mealLog';
import { COLORS } from '@/lib/theme';
import { todayLocal, weekStartFor } from '@/lib/week';
import { showInterstitial } from '@/services/ads';
import {
  MenuApiError,
  useCheatLogs,
  useGenerateWeek,
  useMealLogs,
  useRecipes,
  useWeeklyPlan,
} from '@/services/menuApi';
import { useWeekStore } from '@/store/useWeekStore';
import type { PlannedDay } from '@/types/plan';

function greetingKey(hour: number): string {
  if (hour < 12) return 'dashboard.greetingMorning';
  if (hour < 18) return 'dashboard.greetingAfternoon';
  return 'dashboard.greetingEvening';
}

function DayStrip(props: { days: PlannedDay[]; selected: string; onSelect: (date: string) => void }) {
  const t = useT();
  return (
    <Card className="flex-row justify-between px-2 py-3">
      {props.days.map((day) => {
        const active = day.date === props.selected;
        return (
          <Pressable
            key={day.date}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t(`weekdays.${day.weekday}`)}
            onPress={() => props.onSelect(day.date)}
            className="flex-1 items-center gap-1"
          >
            <Text className={`text-xs ${active ? 'font-semibold text-brand-600' : 'text-gray-500'}`}>
              {t(`weekdaysShort.${day.weekday}`)}
            </Text>
            <View
              className={`h-9 w-9 items-center justify-center rounded-full ${active ? 'bg-brand-500' : 'bg-gray-100'}`}
            >
              <Text className={`text-sm ${active ? 'font-semibold text-white' : 'text-gray-700'}`}>
                {Number(day.date.slice(8))}
              </Text>
            </View>
            <View className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-brand-500' : 'bg-transparent'}`} />
          </Pressable>
        );
      })}
    </Card>
  );
}

function TreatPill({ remaining }: { remaining: number }) {
  const t = useT();
  const over = remaining < 0;
  return (
    <View
      className={`flex-row items-center gap-1.5 rounded-full border px-3 py-1 ${over ? 'border-red-200 bg-red-50' : 'border-brand-200 bg-brand-50'}`}
    >
      <MaterialCommunityIcons
        name="star-four-points"
        size={14}
        color={over ? COLORS.meat : COLORS.brandDark}
      />
      <Text className="text-sm text-gray-700">{t('dashboard.treatBudget')}</Text>
      <Text className={`text-sm font-bold ${over ? 'text-meat' : 'text-gray-900'}`}>{remaining}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const offset = useWeekStore((s) => s.offset);
  const weekStart = weekStartFor(offset);
  const planQuery = useWeeklyPlan(weekStart);
  const { data: cheatLogs } = useCheatLogs(weekStart);
  const { data: mealLogs } = useMealLogs(weekStart);
  const { data: recipes } = useRecipes();
  const generate = useGenerateWeek();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { reset: resetGenerate } = generate;
  useEffect(() => resetGenerate(), [weekStart, resetGenerate]);

  const plan = planQuery.data?.plan;
  const today = todayLocal();
  const days = plan?.days ?? [];
  const activeDate =
    days.find((d) => d.date === selectedDate)?.date ??
    days.find((d) => d.date === today)?.date ??
    days[0]?.date;
  const activeDay = days.find((d) => d.date === activeDate);
  const dayLogs = (mealLogs ?? []).filter((log) => log.logged_on === activeDate);
  const treatsSpent = (cheatLogs ?? []).reduce((sum, log) => sum + log.calories, 0);

  const runGenerate = () => {
    // The ad plays while the plan is generated; both settle independently.
    Promise.all([generate.mutateAsync(weekStart), showInterstitial()]).catch(() => undefined);
  };

  const confirmRegenerate = () =>
    Alert.alert(t('dashboard.regenerate'), t('dashboard.regenerateConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('dashboard.regenerate'), onPress: runGenerate },
    ]);

  const generateError = generate.isError
    ? t(`errors.${generate.error instanceof MenuApiError ? generate.error.code : 'INTERNAL'}`)
    : null;

  let body;
  if (planQuery.isPending) {
    body = <Loading />;
  } else if (!plan && planQuery.isError) {
    body = (
      <CenteredMessage
        message={t('errors.NETWORK')}
        action={<Button label={t('common.retry')} onPress={() => planQuery.refetch()} />}
      />
    );
  } else if (!plan) {
    body = (
      <EmptyState
        icon="calendar-month"
        title={t('dashboard.noPlanTitle')}
        message={generate.isPending ? t('dashboard.generatingHint') : t('dashboard.noPlan')}
        action={
          <View className="w-64 gap-2">
            <Button
              label={generate.isPending ? t('dashboard.generating') : t('dashboard.generate')}
              icon="chef-hat"
              onPress={runGenerate}
              loading={generate.isPending}
            />
            {generateError && <Text className="text-center text-meat">{generateError}</Text>}
          </View>
        }
      />
    );
  } else {
    body = (
      <View className="gap-3">
        {activeDay && (
          <Card className="items-center gap-3 py-5">
            <Text className="text-base font-semibold text-gray-700">
              {t(`weekdays.${activeDay.weekday}`)}
            </Text>
            <CalorieRing
              total={dayEatenCalories(
                activeDay.total_calories,
                dayLogs.map((log) => log.calories)
              )}
              target={activeDay.target_calories}
            />
            {dayLogs.length > 0 && (
              <Text className="px-4 text-center text-xs text-gray-500">{t('checkIn.eatenCaption')}</Text>
            )}
            <TreatPill remaining={plan.weekly_cheat_bank - treatsSpent} />
          </Card>
        )}
        <DayStrip days={days} selected={activeDate ?? ''} onSelect={setSelectedDate} />
        {plan.source === 'fallback' && (
          <View className="flex-row items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3">
            <MaterialCommunityIcons name="information-outline" size={18} color="#b45309" />
            <Text className="flex-1 text-sm text-amber-800">{t('dashboard.fallbackNotice')}</Text>
          </View>
        )}
        {activeDay
          ? activeDay.meals.map((meal) => (
              <MealCheckIn
                key={`${activeDay.date}:${meal.slot}`}
                weekStart={weekStart}
                date={activeDay.date}
                meal={meal}
                recipe={meal.type === 'recipe' ? recipes?.get(meal.recipe_id) : undefined}
                kosherLevel={plan.kosher_level}
                log={dayLogs.find((log) => log.slot === meal.slot)}
                onOpenRecipe={(id, portion) =>
                  router.push({
                    pathname: '/recipe/[id]',
                    params: {
                      id,
                      portion: String(portion),
                      week_start: weekStart,
                      date: activeDay.date,
                      slot: meal.slot,
                    },
                  })
                }
              />
            ))
          : null}
        <View className="mt-2 gap-2">
          <Button
            label={generate.isPending ? t('dashboard.generating') : t('dashboard.regenerate')}
            variant="secondary"
            icon="refresh"
            onPress={confirmRegenerate}
            loading={generate.isPending}
          />
          {generateError && <Text className="text-center text-meat">{generateError}</Text>}
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1 bg-surface" style={{ paddingTop: insets.top }}>
      <ScrollView
        contentContainerClassName="flex-grow gap-4 p-4"
        refreshControl={
          <RefreshControl
            refreshing={planQuery.isRefetching}
            onRefresh={() => planQuery.refetch()}
            colors={[COLORS.brand]}
          />
        }
      >
        <View className="flex-row items-center gap-3">
          <View className="h-11 w-11 items-center justify-center rounded-full bg-brand-100">
            <MaterialCommunityIcons name="leaf" size={24} color={COLORS.brandDark} />
          </View>
          <Text className="flex-1 text-2xl font-bold text-gray-900">
            {t(greetingKey(new Date().getHours()))}
          </Text>
        </View>
        <WeekToggle />
        {body}
      </ScrollView>
      <AdBanner />
    </KeyboardAvoidingView>
  );
}

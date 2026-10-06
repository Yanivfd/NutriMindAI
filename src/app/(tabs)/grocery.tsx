import { useMemo } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';

import { AdBanner } from '@/components/AdBanner';
import { GrocerySection } from '@/components/GrocerySection';
import { Text } from '@/components/Text';
import { Button, Card, CenteredMessage, EmptyState, Loading } from '@/components/ui';
import { WeekToggle } from '@/components/WeekToggle';
import { useT } from '@/lib/i18n';
import { COLORS } from '@/lib/theme';
import { weekStartFor } from '@/lib/week';
import { useWeeklyPlan } from '@/services/menuApi';
import { groceryItemKey, useCheckedItems, useGroceryStore } from '@/store/useGroceryStore';
import { useWeekStore } from '@/store/useWeekStore';

export default function GroceryScreen() {
  const t = useT();
  const offset = useWeekStore((s) => s.offset);
  const planQuery = useWeeklyPlan(weekStartFor(offset));
  const saved = planQuery.data;
  const checkedList = useCheckedItems(saved?.id);
  const toggle = useGroceryStore((s) => s.toggle);
  const clear = useGroceryStore((s) => s.clear);

  const checked = useMemo(() => new Set(checkedList), [checkedList]);
  const allKeys = useMemo(
    () =>
      saved?.plan.grocery.flatMap((section) =>
        section.items.map((item) => groceryItemKey(section.category, item))
      ) ?? [],
    [saved]
  );
  // Only count ticks that still match an item on the current list.
  const checkedCount = allKeys.filter((key) => checked.has(key)).length;

  let body;
  if (planQuery.isPending) {
    body = <Loading />;
  } else if (!saved && planQuery.isError) {
    body = (
      <CenteredMessage
        message={t('errors.NETWORK')}
        action={<Button label={t('common.retry')} onPress={() => planQuery.refetch()} />}
      />
    );
  } else if (!saved || saved.plan.grocery.length === 0) {
    body = <EmptyState icon="cart-outline" title={t('grocery.emptyTitle')} message={t('grocery.empty')} />;
  } else {
    const planId = saved.id;
    const share = allKeys.length > 0 ? checkedCount / allKeys.length : 0;
    body = (
      <View className="gap-3">
        <Card className="gap-2">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="flex-1 text-base font-medium text-gray-800">
              {t('grocery.progress', { checked: checkedCount, total: allKeys.length })}
            </Text>
            {checkedCount > 0 && (
              <Button label={t('grocery.clearChecked')} variant="secondary" onPress={() => clear(planId)} />
            )}
          </View>
          <View className="h-2 overflow-hidden rounded-full bg-brand-100">
            <View className="h-2 rounded-full bg-brand-500" style={{ width: `${share * 100}%` }} />
          </View>
        </Card>
        {saved.plan.kosher_level === 'mehadrin' && (
          <Text className="rounded-2xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-700">
            {t('grocery.mehadrinHint')}
          </Text>
        )}
        {saved.plan.grocery.map((section) => (
          <GrocerySection
            key={section.category}
            section={section}
            checked={checked}
            onToggle={(key) => toggle(planId, key)}
            showInsectCheck={saved.plan.kosher_level !== 'none'}
          />
        ))}
      </View>
    );
  }

  return (
    <View className="flex-1">
      <ScrollView
        contentContainerClassName="flex-grow gap-3 p-4"
        refreshControl={
          <RefreshControl
            refreshing={planQuery.isRefetching}
            onRefresh={() => planQuery.refetch()}
            colors={[COLORS.brand]}
          />
        }
      >
        <WeekToggle />
        {body}
      </ScrollView>
      <AdBanner />
    </View>
  );
}

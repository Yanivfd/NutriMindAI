import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { View } from 'react-native';

import { useT } from '@/lib/i18n';
import type { ProfileFormResult } from '@/lib/profileForm';
import { COLORS } from '@/lib/theme';

import { Text } from './Text';
import { Card } from './ui';

/** Live preview of the calculated targets; hidden until the form is valid. */
export function TargetSummary({ result }: { result: ProfileFormResult }) {
  const t = useT();
  if (!result.ok) return null;
  return (
    <Card className="items-center gap-3 py-6">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-brand-100">
        <MaterialCommunityIcons name="target" size={34} color={COLORS.brandDark} />
      </View>
      <Text className="text-lg font-bold text-gray-900">{t('onboarding.summaryTitle')}</Text>
      <Text className="text-center text-2xl font-bold text-brand-600">
        {t('onboarding.target', { kcal: result.input.daily_calorie_target })}
      </Text>
      <Text className="text-center text-sm text-gray-500">
        {t('onboarding.maintenance', { kcal: result.maintenance })}
      </Text>
      {result.coffeeKcal > 0 && (
        <Text className="text-center text-sm text-gray-600">
          {t('onboarding.coffeeReserved', { kcal: result.coffeeKcal })}
        </Text>
      )}
      {result.input.smoking === 'daily' && (
        <Text className="text-center text-sm text-gray-600">{t('onboarding.smokingNote')}</Text>
      )}
      <View className="flex-row items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1">
        <MaterialCommunityIcons name="star-four-points" size={14} color={COLORS.brandDark} />
        <Text className="text-sm text-gray-700">
          {t('onboarding.cheatBank', { kcal: result.input.weekly_cheat_bank })}
        </Text>
      </View>
    </Card>
  );
}

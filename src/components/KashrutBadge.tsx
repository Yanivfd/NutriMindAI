import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { View } from 'react-native';

import { useT } from '@/lib/i18n';
import { COLORS } from '@/lib/theme';
import type { KashrutType } from '@/types/plan';

import { Text } from './Text';
import type { IconName } from './ui';

// Full class names so Tailwind can find them when scanning the source.
const BADGE: Record<KashrutType, { box: string; text: string; icon: IconName; color: string }> = {
  meat: { box: 'border-red-200 bg-red-50', text: 'text-meat', icon: 'food-drumstick', color: COLORS.meat },
  dairy: { box: 'border-blue-200 bg-blue-50', text: 'text-dairy', icon: 'water', color: COLORS.dairy },
  parve: { box: 'border-green-200 bg-green-50', text: 'text-parve', icon: 'leaf', color: COLORS.parve },
  mixed: { box: 'border-violet-200 bg-violet-50', text: 'text-mixed', icon: 'food-variant', color: COLORS.mixed },
};

export function KashrutBadge({ type }: { type: KashrutType }) {
  const t = useT();
  const badge = BADGE[type];
  return (
    <View className={`flex-row items-center gap-1 self-start rounded-full border px-2 py-0.5 ${badge.box}`}>
      <MaterialCommunityIcons name={badge.icon} size={12} color={badge.color} />
      <Text className={`text-xs font-medium ${badge.text}`}>{t(`kashrut.${type}`)}</Text>
    </View>
  );
}

export function NotKosherBadge() {
  const t = useT();
  return (
    <View className="flex-row items-center gap-1 self-start rounded-full border border-gray-300 bg-gray-100 px-2 py-0.5">
      <MaterialCommunityIcons name="close-circle-outline" size={12} color="#4b5563" />
      <Text className="text-xs font-medium text-gray-700">{t('kashrut.notKosher')}</Text>
    </View>
  );
}

export function ShabbatBadge() {
  const t = useT();
  return (
    <View className="flex-row items-center gap-1 self-start rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5">
      <MaterialCommunityIcons name="star-david" size={12} color="#b45309" />
      <Text className="text-xs font-medium text-amber-800">{t('dashboard.prepareBeforeShabbat')}</Text>
    </View>
  );
}

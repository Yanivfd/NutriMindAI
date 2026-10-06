import { View } from 'react-native';

import { useT } from '@/lib/i18n';
import { useWeekStore } from '@/store/useWeekStore';

import { Chip } from './ui';

export function WeekToggle() {
  const t = useT();
  const offset = useWeekStore((s) => s.offset);
  const setOffset = useWeekStore((s) => s.setOffset);
  return (
    <View className="flex-row justify-center gap-2">
      <Chip label={t('dashboard.thisWeek')} selected={offset === 0} onPress={() => setOffset(0)} />
      <Chip label={t('dashboard.nextWeek')} selected={offset === 1} onPress={() => setOffset(1)} />
    </View>
  );
}

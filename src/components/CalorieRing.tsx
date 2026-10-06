import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useT } from '@/lib/i18n';
import { COLORS } from '@/lib/theme';

import { Text } from './Text';

const SIZE = 168;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Ring showing calories against the day's target. */
export function CalorieRing({ total, target }: { total: number; target: number }) {
  const t = useT();
  const share = target > 0 ? Math.min(1, total / target) : 0;
  return (
    <View
      className="items-center justify-center"
      style={{ width: SIZE, height: SIZE }}
      accessible
      accessibilityLabel={t('dashboard.dayTotal', { total, target })}
    >
      <Svg width={SIZE} height={SIZE} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} stroke={COLORS.ring} strokeWidth={STROKE} fill="none" />
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={COLORS.brand}
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          strokeDashoffset={CIRCUMFERENCE * (1 - share)}
        />
      </Svg>
      <Text className="text-4xl font-bold text-brand-600">{total.toLocaleString('en-US')}</Text>
      <Text className="text-sm text-gray-500">{t('dashboard.ofTarget', { target: target.toLocaleString('en-US') })}</Text>
    </View>
  );
}

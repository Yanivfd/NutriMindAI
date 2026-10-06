import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { formatDayMonth } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { COLORS } from '@/lib/theme';
import { movingAverages } from '@/lib/weightTrend';
import type { WeightLog } from '@/types/db';

import { Text } from './Text';
import { EmptyState } from './ui';

const CHART_ENTRIES = 14;
const CHART_HEIGHT = 140;
const PAD = 10;

/** Line chart of the last weigh-ins with a 7-entry moving average and a dashed target line. */
export function WeightChart({ logs, targetKg }: { logs: WeightLog[]; targetKg: number }) {
  const t = useT();
  const [width, setWidth] = useState(0);
  const points = useMemo(() => {
    const oldestFirst = [...logs].reverse();
    const weights = oldestFirst.map((log) => Number(log.weight_kg));
    const averages = movingAverages(weights);
    return oldestFirst
      .map((log, i) => ({ date: log.logged_on, weight: weights[i], avg: averages[i] }))
      .slice(-CHART_ENTRIES);
  }, [logs]);

  if (points.length === 0) {
    return <EmptyState icon="scale-bathroom" message={t('profile.noWeights')} />;
  }

  const latest = points[points.length - 1];
  const values = [...points.flatMap((p) => [p.weight, p.avg]), targetKg];
  const min = Math.min(...values) - 0.5;
  const max = Math.max(...values) + 0.5;
  const innerWidth = Math.max(0, width - PAD * 2);
  const x = (i: number) => PAD + (points.length === 1 ? innerWidth / 2 : (i / (points.length - 1)) * innerWidth);
  const y = (kg: number) => PAD + (1 - (kg - min) / (max - min)) * (CHART_HEIGHT - PAD * 2);
  const avgPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.avg)}`).join(' ');
  const toGo = Math.round((latest.avg - targetKg) * 10) / 10;

  return (
    <View className="gap-2">
      <View className="flex-row items-end justify-between">
        <View>
          <Text className="text-3xl font-bold text-brand-600">{latest.avg}</Text>
          <Text className="text-xs text-gray-500">{t('profile.averageLabel')}</Text>
        </View>
        <View className="items-end">
          <Text className="text-sm font-semibold text-gray-800">
            {t('profile.targetLabel', { kg: targetKg })}
          </Text>
          <Text className="text-xs text-gray-500">
            {toGo > 0 ? t('profile.toGo', { kg: toGo }) : t('profile.targetReached')}
          </Text>
        </View>
      </View>
      {/* Charts read left to right in both languages. */}
      <View
        style={{ height: CHART_HEIGHT, direction: 'ltr' }}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessible
        accessibilityLabel={t('profile.movingAverage', { value: latest.avg })}
      >
        {width > 0 && (
          <Svg width={width} height={CHART_HEIGHT}>
            <Line
              x1={PAD}
              x2={width - PAD}
              y1={y(targetKg)}
              y2={y(targetKg)}
              stroke={COLORS.brand}
              strokeWidth={1.5}
              strokeDasharray="6 6"
              opacity={0.6}
            />
            {points.map((p, i) => (
              <Circle key={p.date} cx={x(i)} cy={y(p.weight)} r={3} fill="#bbf7d0" />
            ))}
            <Path d={avgPath} stroke={COLORS.brand} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <Circle cx={x(points.length - 1)} cy={y(latest.avg)} r={5} fill={COLORS.brandDark} />
          </Svg>
        )}
      </View>
      <View className="flex-row justify-between" style={{ direction: 'ltr' }}>
        <Text className="text-xs text-gray-500">{formatDayMonth(points[0].date)}</Text>
        <Text className="text-xs text-gray-500">{formatDayMonth(latest.date)}</Text>
      </View>
    </View>
  );
}

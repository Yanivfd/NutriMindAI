import type { ErrorBoundaryProps } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { useT } from '@/lib/i18n';
import { reportError } from '@/services/errorLog';

import { Text } from './Text';
import { Button, SafeScreen } from './ui';

/** Shown when a screen crashes. The error is saved before the tester taps retry. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const t = useT();
  useEffect(() => {
    reportError(error, { source: 'render' });
  }, [error]);

  return (
    <SafeScreen>
      <View className="flex-1 items-center justify-center gap-4 px-6">
        <Text className="text-center text-lg font-semibold text-gray-900">{t('errors.crash')}</Text>
        <Button label={t('common.retry')} onPress={() => void retry()} />
      </View>
    </SafeScreen>
  );
}

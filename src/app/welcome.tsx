import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useState } from 'react';
import type { ComponentProps } from 'react';
import { BackHandler, View } from 'react-native';

import { LanguageToggle } from '@/components/LanguageToggle';
import { Text } from '@/components/Text';
import { Button, SafeScreen } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { COLORS } from '@/lib/theme';
import { usePreferencesStore } from '@/store/usePreferencesStore';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const SLIDES: { icon: IconName; bullets: number }[] = [
  { icon: 'food-apple-outline', bullets: 3 },
  { icon: 'calendar-week', bullets: 3 },
  { icon: 'pot-steam-outline', bullets: 1 },
];

export default function WelcomeScreen() {
  const t = useT();
  const [stepIndex, setStepIndex] = useState(0);
  const setHasSeenWelcome = usePreferencesStore((s) => s.setHasSeenWelcome);
  const slide = SLIDES[stepIndex];
  const isLast = stepIndex === SLIDES.length - 1;

  const goBack = () => setStepIndex((i) => Math.max(0, i - 1));

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stepIndex === 0) return false;
      goBack();
      return true;
    });
    return () => sub.remove();
  }, [stepIndex]);

  const onNext = () => {
    if (isLast) {
      setHasSeenWelcome(true);
      return;
    }
    setStepIndex(stepIndex + 1);
  };

  const bullets = Array.from({ length: slide.bullets }, (_, i) =>
    t(`welcome.slides.${stepIndex}.bullets.${i}`)
  );

  return (
    <SafeScreen>
      <View className="flex-1 px-6 pt-4">
        <View className="flex-row items-center justify-end">
          <LanguageToggle variant="compact" />
        </View>

        <View className="flex-1 justify-center gap-6">
          <View className="items-center gap-4">
            <View className="h-20 w-20 items-center justify-center rounded-full bg-brand-100">
              <MaterialCommunityIcons name={slide.icon} size={40} color={COLORS.brandDark} />
            </View>
            <Text className="text-center text-3xl font-bold text-gray-900">
              {t(`welcome.slides.${stepIndex}.title`)}
            </Text>
            <Text className="text-center text-base leading-6 text-gray-600">
              {t(`welcome.slides.${stepIndex}.body`)}
            </Text>
          </View>

          <View className="gap-3">
            {bullets.map((line) => (
              <View key={line} className="flex-row items-start gap-3">
                <MaterialCommunityIcons
                  name="check-circle"
                  size={22}
                  color={COLORS.brand}
                  style={{ marginTop: 1 }}
                />
                <Text className="flex-1 text-base text-gray-800">{line}</Text>
              </View>
            ))}
          </View>

          {isLast ? (
            <Text className="text-center text-sm text-gray-500">{t('welcome.disclaimer')}</Text>
          ) : null}
        </View>

        <View className="flex-row items-center justify-center gap-2 pb-4">
          {SLIDES.map((_, i) => (
            <View
              key={i}
              className={`h-2 rounded-full ${i === stepIndex ? 'w-6 bg-brand-500' : 'w-2 bg-brand-100'}`}
            />
          ))}
        </View>
      </View>

      <View className="flex-row gap-3 border-t border-gray-100 bg-white p-4">
        {stepIndex > 0 && (
          <View className="flex-1">
            <Button label={t('common.back')} variant="secondary" onPress={goBack} />
          </View>
        )}
        <View className="flex-1">
          <Button label={isLast ? t('welcome.start') : t('common.next')} onPress={onNext} />
        </View>
      </View>
    </SafeScreen>
  );
}

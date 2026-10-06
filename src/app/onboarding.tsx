import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import { BackHandler, KeyboardAvoidingView, ScrollView, View } from 'react-native';

import {
  AboutYouSection,
  ActivitySection,
  HabitsSection,
  KashrutSection,
  RoutineSection,
} from '@/components/ProfileForm';
import type { ProfileSectionProps } from '@/components/ProfileForm';
import { TargetSummary } from '@/components/TargetSummary';
import { Text } from '@/components/Text';
import { Button, SafeScreen } from '@/components/ui';
import { useLanguage, useT } from '@/lib/i18n';
import { buildProfileInput, DEFAULT_FORM_VALUES, defaultCuisines } from '@/lib/profileForm';
import type { ProfileField } from '@/lib/profileForm';
import { COLORS } from '@/lib/theme';
import { todayLocal } from '@/lib/week';
import { useSaveProfile } from '@/services/menuApi';

interface WizardStep {
  /** null = the final summary step. */
  Section: ComponentType<ProfileSectionProps> | null;
  /** Fields that must be valid before leaving this step. */
  fields: ProfileField[];
}

const STEPS: WizardStep[] = [
  {
    Section: AboutYouSection,
    fields: ['birthDate', 'sex', 'heightCm', 'currentWeightKg', 'targetWeightKg'],
  },
  { Section: HabitsSection, fields: [] },
  { Section: ActivitySection, fields: [] },
  { Section: RoutineSection, fields: ['mealTimes'] },
  { Section: KashrutSection, fields: ['cuisines'] },
  { Section: null, fields: [] },
];

export default function OnboardingScreen() {
  const t = useT();
  const language = useLanguage();
  const [values, setValues] = useState(() => ({
    ...DEFAULT_FORM_VALUES,
    cuisines: defaultCuisines(language),
  }));
  const [stepIndex, setStepIndex] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const result = useMemo(() => buildProfileInput(values, todayLocal()), [values]);
  const save = useSaveProfile();

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;
  const errorsFor = (s: WizardStep) =>
    result.ok ? [] : result.errors.filter((field) => s.fields.includes(field));
  const stepErrors = errorsFor(step);

  const goBack = () => {
    setShowErrors(false);
    setStepIndex((i) => Math.max(0, i - 1));
  };

  // Android back steps backwards instead of leaving the app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stepIndex === 0) return false;
      goBack();
      return true;
    });
    return () => sub.remove();
  }, [stepIndex]);

  // Saving fills the profile cache; the root navigator then moves to the main tabs.
  const onNext = () => {
    if (stepErrors.length > 0) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    if (!isLast) {
      setStepIndex(stepIndex + 1);
      return;
    }
    if (result.ok) {
      save.mutate(result.input);
    } else {
      // Every field is checked on an earlier step; send the user back to the first problem.
      setStepIndex(Math.max(0, STEPS.findIndex((s) => errorsFor(s).length > 0)));
      setShowErrors(true);
    }
  };

  const Section = step.Section;
  const progress = (stepIndex + 1) / STEPS.length;

  return (
    <SafeScreen>
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <View className="gap-2 px-4 pt-4">
          <View className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-100">
              <MaterialCommunityIcons name="leaf" size={22} color={COLORS.brandDark} />
            </View>
            <Text className="flex-1 text-2xl font-bold text-gray-900">{t('onboarding.title')}</Text>
          </View>
          <Text className="text-sm text-gray-600">
            {t('onboarding.stepOf', { step: stepIndex + 1, total: STEPS.length })}
          </Text>
          <View className="h-2 overflow-hidden rounded-full bg-brand-100">
            <View className="h-2 rounded-full bg-brand-500" style={{ width: `${progress * 100}%` }} />
          </View>
        </View>

        <ScrollView
          key={stepIndex}
          contentContainerClassName="flex-grow gap-4 p-4"
          keyboardShouldPersistTaps="handled"
        >
          {Section ? (
            <Section
              values={values}
              errors={showErrors ? stepErrors : []}
              onChange={setValues}
            />
          ) : (
            <TargetSummary result={result} />
          )}
          {showErrors && stepErrors.length > 0 && (
            <Text className="text-center text-meat">{t('onboarding.invalid')}</Text>
          )}
          {save.isError && <Text className="text-center text-meat">{t('common.genericError')}</Text>}
        </ScrollView>

        <View className="flex-row gap-3 border-t border-gray-100 bg-white p-4">
          {stepIndex > 0 && (
            <View className="flex-1">
              <Button
                label={t('common.back')}
                variant="secondary"
                onPress={goBack}
                disabled={save.isPending}
              />
            </View>
          )}
          <View className="flex-1">
            <Button
              label={isLast ? t('onboarding.finish') : t('common.next')}
              onPress={onNext}
              loading={save.isPending}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeScreen>
  );
}

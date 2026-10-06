import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, Switch, View } from 'react-native';

import { useT } from '@/lib/i18n';
import { COLORS } from '@/lib/theme';
import type { ProfileField, ProfileFormValues, WaitHours } from '@/lib/profileForm';
import type { ActivityLevel, SmokingStatus } from '@/types/db';
import { CUISINES, MEAL_SLOTS, WEEKDAYS } from '@/types/plan';
import type { Cuisine, KosherLevel, MealSlot } from '@/types/plan';

import { BirthDateField, TimeField } from './DateTimeField';
import { Text } from './Text';
import { Card, Chip, Field, SectionTitle } from './ui';

const ACTIVITY_LEVELS: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
const SMOKING_OPTIONS: SmokingStatus[] = ['no', 'former', 'daily'];
const KOSHER_LEVELS: KosherLevel[] = ['none', 'kosher', 'mehadrin'];
const WAIT_HOURS: WaitHours[] = [6, 3, 1];

export interface ProfileSectionProps {
  values: ProfileFormValues;
  errors: ProfileField[];
  onChange: (values: ProfileFormValues) => void;
}

function formHelpers({ values, errors, onChange }: ProfileSectionProps) {
  return {
    has: (field: ProfileField) => errors.includes(field),
    set: <K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) =>
      onChange({ ...values, [key]: value }),
  };
}

function OptionRow(props: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: props.selected }}
      onPress={props.onPress}
      className={`flex-row items-center gap-3 rounded-2xl border px-4 py-3 ${props.selected ? 'border-brand-500 bg-brand-50' : 'border-gray-200 bg-white'}`}
    >
      <MaterialCommunityIcons
        name={props.selected ? 'radiobox-marked' : 'radiobox-blank'}
        size={22}
        color={props.selected ? COLORS.brand : '#9ca3af'}
      />
      <Text className={`flex-1 ${props.selected ? 'font-semibold text-brand-700' : 'text-gray-800'}`}>
        {props.label}
      </Text>
    </Pressable>
  );
}

export function AboutYouSection(props: ProfileSectionProps) {
  const t = useT();
  const { values } = props;
  const { has, set } = formHelpers(props);
  return (
    <Card className="gap-3">
      <SectionTitle>{t('onboarding.aboutYou')}</SectionTitle>
      <BirthDateField
        label={t('onboarding.birthDate')}
        value={values.birthDate}
        onChange={(v) => set('birthDate', v)}
        error={has('birthDate')}
      />
      <Text className={`text-sm ${has('sex') ? 'text-meat' : 'text-gray-700'}`}>
        {t('onboarding.sex')}
      </Text>
      <View className="flex-row gap-2">
        <Chip label={t('onboarding.male')} selected={values.sex === 'male'} onPress={() => set('sex', 'male')} />
        <Chip
          label={t('onboarding.female')}
          selected={values.sex === 'female'}
          onPress={() => set('sex', 'female')}
        />
      </View>
      <Field
        label={t('onboarding.height')}
        value={values.heightCm}
        onChangeText={(v) => set('heightCm', v)}
        keyboardType="number-pad"
        maxLength={3}
        error={has('heightCm')}
      />
      <Field
        label={t('onboarding.currentWeight')}
        value={values.currentWeightKg}
        onChangeText={(v) => set('currentWeightKg', v)}
        keyboardType="decimal-pad"
        maxLength={5}
        error={has('currentWeightKg')}
      />
      <Field
        label={t('onboarding.targetWeight')}
        value={values.targetWeightKg}
        onChangeText={(v) => set('targetWeightKg', v)}
        keyboardType="decimal-pad"
        maxLength={5}
        error={has('targetWeightKg')}
      />
    </Card>
  );
}

function CountStepper(props: {
  label: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="flex-1 text-base text-gray-800">{props.label}</Text>
      <View className="flex-row items-center gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={props.label}
          disabled={props.value <= 0}
          onPress={() => props.onChange(Math.max(0, props.value - 1))}
          className="p-1"
        >
          <MaterialCommunityIcons
            name="minus-circle-outline"
            size={28}
            color={props.value <= 0 ? '#d1d5db' : COLORS.brand}
          />
        </Pressable>
        <Text className="w-6 text-center text-lg font-semibold text-gray-900">{props.value}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={props.label}
          disabled={props.value >= props.max}
          onPress={() => props.onChange(Math.min(props.max, props.value + 1))}
          className="p-1"
        >
          <MaterialCommunityIcons
            name="plus-circle-outline"
            size={28}
            color={props.value >= props.max ? '#d1d5db' : COLORS.brand}
          />
        </Pressable>
      </View>
    </View>
  );
}

export function HabitsSection(props: ProfileSectionProps) {
  const t = useT();
  const { values } = props;
  const { set } = formHelpers(props);
  const smokingLabel: Record<SmokingStatus, string> = {
    no: t('onboarding.smokingNo'),
    former: t('onboarding.smokingFormer'),
    daily: t('onboarding.smokingDaily'),
  };
  return (
    <Card className="gap-3">
      <SectionTitle>{t('onboarding.habits')}</SectionTitle>
      <Text className="text-sm text-gray-600">{t('onboarding.habitsHint')}</Text>
      <Text className="text-sm text-gray-700">{t('onboarding.smoking')}</Text>
      {SMOKING_OPTIONS.map((option) => (
        <OptionRow
          key={option}
          label={smokingLabel[option]}
          selected={values.smoking === option}
          onPress={() => set('smoking', option)}
        />
      ))}
      <CountStepper
        label={t('onboarding.coffeeBlack')}
        value={values.coffeeBlackCups}
        max={8}
        onChange={(value) => set('coffeeBlackCups', value)}
      />
      <CountStepper
        label={t('onboarding.coffeeMilk')}
        value={values.coffeeMilkCups}
        max={8}
        onChange={(value) => set('coffeeMilkCups', value)}
      />
      {values.coffeeMilkCups > 0 && (
        <View className="gap-2">
          <Text className="text-sm text-gray-700">{t('onboarding.coffeeSugar')}</Text>
          <View className="flex-row flex-wrap gap-2">
            {[0, 1, 2].map((tsp) => (
              <Chip
                key={tsp}
                label={t(`onboarding.sugarTsp.${tsp}`)}
                selected={values.coffeeSugarTsp === tsp}
                onPress={() => set('coffeeSugarTsp', tsp)}
              />
            ))}
          </View>
        </View>
      )}
    </Card>
  );
}

export function ActivitySection(props: ProfileSectionProps) {
  const t = useT();
  const { set } = formHelpers(props);
  return (
    <Card className="gap-2">
      <SectionTitle>{t('onboarding.activity')}</SectionTitle>
      {ACTIVITY_LEVELS.map((level) => (
        <OptionRow
          key={level}
          label={t(`onboarding.activityLevels.${level}`)}
          selected={props.values.activity === level}
          onPress={() => set('activity', level)}
        />
      ))}
    </Card>
  );
}

export function RoutineSection(props: ProfileSectionProps) {
  const t = useT();
  const { values } = props;
  const { has, set } = formHelpers(props);
  // Kosher users never have a takeaway day on Shabbat.
  const officeDayOptions =
    values.kosherLevel !== 'none' ? WEEKDAYS.filter((d) => d !== 'saturday') : WEEKDAYS;
  const visibleSlots = MEAL_SLOTS.filter((s) => !(s === 'breakfast' && values.skipsBreakfast));
  const setMealTime = (slot: MealSlot, time: string) =>
    set('mealTimes', { ...values.mealTimes, [slot]: time });

  return (
    <Card className="gap-3">
      <SectionTitle>{t('onboarding.routine')}</SectionTitle>
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 text-base text-gray-800">{t('onboarding.skipsBreakfast')}</Text>
        <Switch
          value={values.skipsBreakfast}
          onValueChange={(v) => set('skipsBreakfast', v)}
          trackColor={{ true: '#86efac', false: '#d1d5db' }}
          thumbColor={values.skipsBreakfast ? COLORS.brand : '#f9fafb'}
        />
      </View>
      <Text className="text-sm text-gray-700">{t('onboarding.officeDays')}</Text>
      <View className="flex-row flex-wrap gap-2">
        {officeDayOptions.map((day) => {
          const selected = values.officeDays.includes(day);
          return (
            <Chip
              key={day}
              label={t(`weekdaysShort.${day}`)}
              selected={selected}
              onPress={() =>
                set(
                  'officeDays',
                  selected ? values.officeDays.filter((d) => d !== day) : [...values.officeDays, day]
                )
              }
            />
          );
        })}
      </View>
      <Text className={`text-sm ${has('mealTimes') ? 'text-meat' : 'text-gray-700'}`}>
        {t('onboarding.mealTimes')}
      </Text>
      <View className="flex-row flex-wrap gap-3">
        {visibleSlots.map((slot) => (
          <View key={slot} className="min-w-[45%] flex-1">
            <TimeField
              label={t(`slots.${slot}`)}
              value={values.mealTimes[slot]}
              onChange={(v) => setMealTime(slot, v)}
              error={has('mealTimes')}
            />
          </View>
        ))}
      </View>
      {has('mealTimes') && (
        <Text className="text-xs text-meat">{t('onboarding.mealOrderHint')}</Text>
      )}
    </Card>
  );
}

export function KashrutSection(props: ProfileSectionProps) {
  const t = useT();
  const { values, onChange } = props;
  const { has, set } = formHelpers(props);
  const isKosher = values.kosherLevel !== 'none';

  const toggleCuisine = (cuisine: Cuisine) => {
    const selected = values.cuisines.includes(cuisine);
    onChange({
      ...values,
      cuisines: selected
        ? values.cuisines.filter((item) => item !== cuisine)
        : [...values.cuisines, cuisine],
    });
  };

  const setKosherLevel = (level: KosherLevel) =>
    onChange({
      ...values,
      kosherLevel: level,
      officeDays:
        level === 'none' ? values.officeDays : values.officeDays.filter((d) => d !== 'saturday'),
    });

  return (
    <Card className="gap-2">
      <SectionTitle>{t('onboarding.kosherTitle')}</SectionTitle>
      <Text className="text-sm text-gray-700">{t('onboarding.kosherQuestion')}</Text>
      {KOSHER_LEVELS.map((level) => (
        <OptionRow
          key={level}
          label={t(`onboarding.kosherLevels.${level}`)}
          selected={values.kosherLevel === level}
          onPress={() => setKosherLevel(level)}
        />
      ))}
      {isKosher && (
        <>
          <Text className="mt-1 text-sm text-gray-600">{t('onboarding.kosherExplain')}</Text>
          <Text className="mt-2 text-sm text-gray-700">{t('onboarding.waitHours')}</Text>
          <View className="flex-row gap-2">
            {WAIT_HOURS.map((hours) => (
              <Chip
                key={hours}
                label={t('onboarding.waitHoursOption', { count: hours })}
                selected={values.waitHours === hours}
                onPress={() => set('waitHours', hours)}
              />
            ))}
          </View>
        </>
      )}
      <Text className={`mt-2 text-sm ${has('cuisines') ? 'text-meat' : 'text-gray-700'}`}>
        {t('onboarding.cuisines')}
      </Text>
      <Text className="text-xs text-gray-500">{t('onboarding.cuisinesHint')}</Text>
      <View className="flex-row flex-wrap gap-2">
        {CUISINES.map((cuisine) => (
          <Chip
            key={cuisine}
            label={t(`onboarding.cuisineNames.${cuisine}`)}
            selected={values.cuisines.includes(cuisine)}
            onPress={() => toggleCuisine(cuisine)}
          />
        ))}
      </View>
      {has('cuisines') && <Text className="text-xs text-meat">{t('onboarding.cuisineRequired')}</Text>}
    </Card>
  );
}

/** All sections on one page (used by Settings; onboarding shows them one per step). */
export function ProfileForm(props: ProfileSectionProps) {
  return (
    <View className="gap-4">
      <AboutYouSection {...props} />
      <HabitsSection {...props} />
      <ActivitySection {...props} />
      <RoutineSection {...props} />
      <KashrutSection {...props} />
    </View>
  );
}

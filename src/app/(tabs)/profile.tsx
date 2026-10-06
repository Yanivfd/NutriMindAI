import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, Switch, View } from 'react-native';

import { LanguageToggle } from '@/components/LanguageToggle';
import { Text } from '@/components/Text';
import { Button, Card, Field, Loading, SectionTitle } from '@/components/ui';
import { WeightChart } from '@/components/WeightChart';
import { localizedName, localizedTitle } from '@/lib/format';
import { useLanguage, useT } from '@/lib/i18n';
import { COLORS } from '@/lib/theme';
import { signOut } from '@/services/auth';
import { useLogWeight, useProfile, useRecipes, useUpdateDislikes, useWeightLogs } from '@/services/menuApi';
import { useNotificationPermission } from '@/services/reminders';
import { usePreferencesStore } from '@/store/usePreferencesStore';
import { ingredientKey } from '@/types/plan';

export default function ProfileScreen() {
  const t = useT();
  const lang = useLanguage();
  const { data: profile } = useProfile();
  const { data: recipes } = useRecipes();
  const { data: logs = [] } = useWeightLogs();
  const updateDislikes = useUpdateDislikes();
  const logWeight = useLogWeight();
  const [weight, setWeight] = useState('');
  const [invalidWeight, setInvalidWeight] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const reminders = usePreferencesStore((state) => state.reminders);
  const setReminder = usePreferencesStore((state) => state.setReminder);
  const notificationPermission = useNotificationPermission();

  if (!profile) return <Loading />;

  const dislikedIds = profile.disliked_recipe_ids ?? [];
  const dislikedIngredients = profile.disliked_ingredients ?? [];
  const hasBlocks = dislikedIds.length > 0 || dislikedIngredients.length > 0;

  const saveDislikes = (ids: string[], ingredients: typeof dislikedIngredients) => {
    updateDislikes.mutate({ disliked_recipe_ids: ids, disliked_ingredients: ingredients });
  };

  const onLogWeight = () => {
    const value = Number(weight.trim().replace(',', '.'));
    if (!Number.isFinite(value) || value < 30 || value > 400) {
      setInvalidWeight(true);
      return;
    }
    setInvalidWeight(false);
    logWeight.mutate(Math.round(value * 10) / 10, { onSuccess: () => setWeight('') });
  };

  // The root navigator returns to login once the session is gone.
  const onSignOut = () => {
    setSigningOut(true);
    signOut().catch(() => setSigningOut(false));
  };

  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1">
      <ScrollView contentContainerClassName="gap-4 p-4" keyboardShouldPersistTaps="handled">
        <Card className="gap-2">
          <SectionTitle>{t('profile.language')}</SectionTitle>
          <LanguageToggle />
          <Text className="text-xs text-gray-500">{t('profile.languageRestart')}</Text>
        </Card>

        <Card className="gap-3">
          <SectionTitle>{t('reminders.title')}</SectionTitle>
          {(
            [
              ['meals', 'reminders.meals', 'reminders.mealsHint'],
              ['shopping', 'reminders.shopping', 'reminders.shoppingHint'],
              ['water', 'reminders.water', 'reminders.waterHint'],
              ['weight', 'reminders.weight', 'reminders.weightHint'],
              ['checkIn', 'reminders.checkIn', 'reminders.checkInHint'],
            ] as const
          ).map(([key, label, hint]) => (
            <View key={key} className="flex-row items-center justify-between gap-3">
              <View className="flex-1 gap-1">
                <Text className="text-gray-900">{t(label)}</Text>
                <Text className="text-xs text-gray-500">{t(hint)}</Text>
              </View>
              <Switch
                accessibilityLabel={t(label)}
                value={reminders[key]}
                onValueChange={(enabled) => setReminder(key, enabled)}
                trackColor={{ false: '#d1d5db', true: COLORS.brand }}
                thumbColor="#ffffff"
              />
            </View>
          ))}
          {notificationPermission === 'denied' &&
            (reminders.meals ||
              reminders.shopping ||
              reminders.water ||
              reminders.weight ||
              reminders.checkIn) && (
              <Text className="text-xs text-meat">{t('reminders.permissionDenied')}</Text>
            )}
        </Card>

        <Card className="gap-3">
          <SectionTitle>{t('profile.weight')}</SectionTitle>
          <WeightChart logs={logs} targetKg={Number(profile.target_weight_kg)} />
          <Field
            label={t('profile.logWeight')}
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
            maxLength={5}
            placeholder={String(Number(profile.current_weight_kg))}
            error={invalidWeight}
            hint={invalidWeight ? t('profile.invalidWeight') : undefined}
          />
          <Button label={t('common.save')} onPress={onLogWeight} loading={logWeight.isPending} />
          {logWeight.isError && <Text className="text-center text-meat">{t('common.genericError')}</Text>}
        </Card>

        <Card className="gap-2">
          <SectionTitle>{t('profile.settings')}</SectionTitle>
          <View className="flex-row justify-between">
            <Text className="text-gray-700">{t('profile.dailyTarget')}</Text>
            <Text className="font-semibold text-gray-900">
              {profile.daily_calorie_target} {t('common.kcal')}
            </Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-gray-700">{t('profile.weeklyCheatBank')}</Text>
            <Text className="font-semibold text-gray-900">
              {profile.weekly_cheat_bank} {t('common.kcal')}
            </Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-gray-700">{t('onboarding.kosherTitle')}</Text>
            <Text className="font-semibold text-gray-900">
              {t(`onboarding.kosherLevels.${profile.kosher_level}`)}
            </Text>
          </View>
          <View className="flex-row justify-between gap-3">
            <Text className="text-gray-700">{t('profile.kitchens')}</Text>
            <Text className="shrink font-semibold text-gray-900">
              {(profile.preferred_cuisines ?? [])
                .map((cuisine) => t(`onboarding.cuisineNames.${cuisine}`))
                .join(', ')}
            </Text>
          </View>
          <Text className="text-xs text-gray-500">{t('profile.settingsApplyHint')}</Text>
          <Button
            label={t('profile.editSettings')}
            variant="secondary"
            icon="pencil-outline"
            onPress={() => router.push('/settings')}
          />
        </Card>

        {hasBlocks && (
          <Card className="gap-3">
            <SectionTitle>{t('profile.blockedTitle')}</SectionTitle>
            <Text className="text-xs text-gray-500">{t('profile.blockedHint')}</Text>
            {dislikedIds.length > 0 && (
              <View className="gap-1">
                <Text className="text-sm font-medium text-gray-700">{t('profile.blockedDishes')}</Text>
                {dislikedIds.map((id) => {
                  const dish = recipes?.get(id);
                  return (
                    <View key={id} className="flex-row items-center justify-between gap-2">
                      <Text className="flex-1 text-gray-900">
                        {dish ? localizedTitle(dish, lang) : id}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('common.delete')}
                        onPress={() =>
                          saveDislikes(
                            dislikedIds.filter((item) => item !== id),
                            dislikedIngredients
                          )
                        }
                        disabled={updateDislikes.isPending}
                        className="p-1"
                      >
                        <MaterialCommunityIcons name="close" size={18} color={COLORS.muted} />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}
            {dislikedIngredients.length > 0 && (
              <View className="gap-1">
                <Text className="text-sm font-medium text-gray-700">{t('profile.blockedIngredients')}</Text>
                {dislikedIngredients.map((item) => (
                  <View key={ingredientKey(item.name_en)} className="flex-row items-center justify-between gap-2">
                    <Text className="flex-1 text-gray-900">{localizedName(item, lang)}</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('common.delete')}
                      onPress={() =>
                        saveDislikes(
                          dislikedIds,
                          dislikedIngredients.filter(
                            (entry) => ingredientKey(entry.name_en) !== ingredientKey(item.name_en)
                          )
                        )
                      }
                      disabled={updateDislikes.isPending}
                      className="p-1"
                    >
                      <MaterialCommunityIcons name="close" size={18} color={COLORS.muted} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
            {updateDislikes.isError && (
              <Text className="text-center text-meat">{t('common.genericError')}</Text>
            )}
          </Card>
        )}

        <Button
          label={t('profile.signOut')}
          variant="danger"
          icon="logout"
          onPress={onSignOut}
          loading={signingOut}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

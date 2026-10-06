import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, ScrollView, View } from 'react-native';

import { DislikeSheet } from '@/components/DislikeSheet';
import { KashrutBadge, NotKosherBadge } from '@/components/KashrutBadge';
import { Text } from '@/components/Text';
import { Button, Card, CenteredMessage, Loading, SectionTitle } from '@/components/ui';
import { formatAmount, localizedName, localizedTitle } from '@/lib/format';
import { useLanguage, useT } from '@/lib/i18n';
import { recipeImage } from '@/lib/recipeImages';
import { COLORS } from '@/lib/theme';
import {
  MenuApiError,
  useApplyDislikes,
  useProfile,
  useRecipe,
  useUpdateDislikes,
} from '@/services/menuApi';
import { MEAL_SLOTS, type MealSlot } from '@/types/plan';

const MIN_PORTION = 0.5;
const MAX_PORTION = 2;

function parsePortion(raw: string | undefined): number {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0
    ? Math.min(MAX_PORTION, Math.max(MIN_PORTION, value))
    : 1;
}

function parseSlot(raw: string | undefined): MealSlot | undefined {
  if (!raw) return undefined;
  return (MEAL_SLOTS as readonly string[]).includes(raw) ? (raw as MealSlot) : undefined;
}

function Macro({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 items-center rounded-2xl bg-brand-50 py-2">
      <Text className="text-base font-bold text-brand-700">{value}</Text>
      <Text className="text-xs text-gray-500">{label}</Text>
    </View>
  );
}

export default function RecipeScreen() {
  const t = useT();
  const lang = useLanguage();
  const params = useLocalSearchParams<{
    id: string;
    portion?: string;
    week_start?: string;
    date?: string;
    slot?: string;
  }>();
  const portion = parsePortion(params.portion);
  const slot = parseSlot(params.slot);
  const weekStart = params.week_start;
  const mealDate = params.date;
  const canSwap = Boolean(weekStart && mealDate && slot);
  const { recipe, isLoading } = useRecipe(params.id);
  const { data: profile } = useProfile();
  const updateDislikes = useUpdateDislikes();
  const applyDislikes = useApplyDislikes();
  const [sheetOpen, setSheetOpen] = useState(false);

  if (isLoading) return <Loading />;
  if (!recipe) return <CenteredMessage message={t('recipe.notFound')} />;

  const isKosherUser = (profile?.kosher_level ?? 'none') !== 'none';
  const title = localizedTitle(recipe, lang);
  const instructions = lang === 'he' ? recipe.instructions_he : recipe.instructions_en;
  const scaled = (value: number) => String(Math.round(value * portion));

  const photo = recipeImage(recipe.id);
  const dislikedIds = profile?.disliked_recipe_ids ?? [];
  const dislikedIngredients = profile?.disliked_ingredients ?? [];
  const dishBlocked = dislikedIds.includes(recipe.id);

  const unlikeDish = () => {
    updateDislikes.mutate({
      disliked_recipe_ids: dislikedIds.filter((id) => id !== recipe.id),
      disliked_ingredients: dislikedIngredients,
    });
  };

  return (
    <ScrollView contentContainerClassName="gap-4 p-4">
      <Stack.Screen options={{ title }} />

      {photo && (
        <Image
          source={photo}
          accessibilityIgnoresInvertColors
          className="w-full rounded-3xl"
          style={{ aspectRatio: 4 / 3 }}
          resizeMode="cover"
        />
      )}

      <Card className="gap-3">
        <Text className="text-2xl font-bold text-gray-900">{title}</Text>
        <View className="flex-row flex-wrap items-center gap-3">
          <View className="flex-row items-center gap-1">
            <MaterialCommunityIcons name="timer-outline" size={16} color={COLORS.brand} />
            <Text className="text-sm text-gray-600">
              {t('recipe.prepTime', { count: recipe.prep_time_minutes })}
            </Text>
          </View>
          {portion !== 1 && (
            <Text className="text-sm text-gray-600">{t('recipe.portion', { value: portion })}</Text>
          )}
          {isKosherUser && <KashrutBadge type={recipe.kashrut_type} />}
          {isKosherUser && !recipe.is_kosher && <NotKosherBadge />}
        </View>
        <View className="flex-row gap-2">
          <Macro label={t('common.kcal')} value={scaled(recipe.calories)} />
          <Macro label={t('recipe.protein')} value={`${scaled(recipe.protein_g)}g`} />
          <Macro label={t('recipe.carbs')} value={`${scaled(recipe.carbs_g)}g`} />
          <Macro label={t('recipe.fat')} value={`${scaled(recipe.fat_g)}g`} />
        </View>
        {profile && dishBlocked && (
          <Button
            label={t('recipe.likeDishAgain')}
            variant="secondary"
            icon="undo"
            onPress={unlikeDish}
            loading={updateDislikes.isPending}
          />
        )}
        {profile && !dishBlocked && canSwap && (
          <Button
            label={t('recipe.dislikeDish')}
            variant="secondary"
            icon="thumb-down-outline"
            onPress={() => setSheetOpen(true)}
          />
        )}
        {(updateDislikes.isError || applyDislikes.isError) && !sheetOpen && (
          <Text className="text-center text-meat">{t('common.genericError')}</Text>
        )}
      </Card>

      <Card>
        <SectionTitle>{t('recipe.ingredients')}</SectionTitle>
        {recipe.ingredients.map((ingredient) => (
          <View key={`${ingredient.name_en}|${ingredient.unit}`} className="border-b border-gray-100 py-2">
            <View className="flex-row items-center justify-between gap-2">
              <Text className="flex-1 text-base text-gray-900">{localizedName(ingredient, lang)}</Text>
              <Text className="text-base text-gray-700">
                {formatAmount(ingredient.amount * portion, ingredient.unit)} {t(`units.${ingredient.unit}`)}
              </Text>
            </View>
            {ingredient.swaps.length > 0 && (
              <Text className="mt-0.5 text-xs text-gray-500">
                {t('recipe.swaps', {
                  options: ingredient.swaps.map((swap) => localizedName(swap, lang)).join(' / '),
                })}
              </Text>
            )}
            {isKosherUser && ingredient.insect_check && (
              <View className="mt-0.5 flex-row items-center gap-1">
                <MaterialCommunityIcons name="bug-outline" size={14} color="#b45309" />
                <Text className="text-xs text-amber-700">{t('recipe.insectCheck')}</Text>
              </View>
            )}
          </View>
        ))}
      </Card>

      <Card>
        <SectionTitle>{t('recipe.instructions')}</SectionTitle>
        {instructions.map((step, index) => (
          <View key={index} className="flex-row gap-3 py-1.5">
            <View className="h-7 w-7 items-center justify-center rounded-full bg-brand-100">
              <Text className="text-sm font-bold text-brand-700">{index + 1}</Text>
            </View>
            <Text className="flex-1 text-base text-gray-800">{step}</Text>
          </View>
        ))}
      </Card>

      {sheetOpen && (
        <DislikeSheet
          visible
          ingredients={recipe.ingredients}
          loading={applyDislikes.isPending}
          errorMessage={
            applyDislikes.isError
              ? t(
                  `errors.${applyDislikes.error instanceof MenuApiError ? applyDislikes.error.code : 'INTERNAL'}`
                )
              : undefined
          }
          onCancel={() => {
            applyDislikes.reset();
            setSheetOpen(false);
          }}
          onConfirm={({ dislikeDish, ingredients }) => {
            if (!weekStart || !mealDate || !slot) return;
            applyDislikes.mutate(
              {
                week_start_date: weekStart,
                date: mealDate,
                slot,
                recipe_id: recipe.id,
                dislike_dish: dislikeDish,
                ingredients,
              },
              {
                onSuccess: () => {
                  setSheetOpen(false);
                  router.back();
                },
              }
            );
          }}
        />
      )}
    </ScrollView>
  );
}

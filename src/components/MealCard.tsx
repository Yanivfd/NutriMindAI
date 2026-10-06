import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ReactNode } from 'react';
import { Image, Pressable, View } from 'react-native';

import { localizedTitle } from '@/lib/format';
import { useLanguage, useT } from '@/lib/i18n';
import { recipeImage } from '@/lib/recipeImages';
import { COLORS } from '@/lib/theme';
import type { RecipeRow } from '@/types/db';
import type { KosherLevel, PlannedMeal } from '@/types/plan';

import { KashrutBadge, NotKosherBadge, ShabbatBadge } from './KashrutBadge';
import { Text } from './Text';
import type { IconName } from './ui';

interface MealCardProps {
  meal: PlannedMeal;
  recipe: RecipeRow | undefined;
  kosherLevel: KosherLevel;
  onOpenRecipe: (recipeId: string, portion: number) => void;
  /** Shown under the meal, inside the same card. Used for the ate / didn't-eat check-in. */
  footer?: ReactNode;
}

const THUMB = 72;

function Thumbnail({ recipeId, icon }: { recipeId?: string; icon: IconName }) {
  const source = recipeId ? recipeImage(recipeId) : undefined;
  if (source) {
    return (
      <Image
        source={source}
        accessibilityIgnoresInvertColors
        style={{ width: THUMB, height: THUMB, borderRadius: THUMB / 2 }}
      />
    );
  }
  return (
    <View
      className="items-center justify-center rounded-full bg-brand-100"
      style={{ width: THUMB, height: THUMB }}
    >
      <MaterialCommunityIcons name={icon} size={32} color={COLORS.brandDark} />
    </View>
  );
}

function MealShell(props: {
  slotLabel: string;
  time: string;
  thumbnail: ReactNode;
  children: ReactNode;
  className?: string;
  onPress?: () => void;
  footer?: ReactNode;
}) {
  const row = (
    <View className="flex-row items-center gap-4 p-3">
      {props.thumbnail}
      <View className="flex-1 gap-0.5">
        <Text className="text-lg font-bold text-gray-900">{props.slotLabel}</Text>
        <View className="flex-row items-center gap-1">
          <MaterialCommunityIcons name="clock-outline" size={14} color={COLORS.brand} />
          <Text className="text-sm text-gray-500">{props.time}</Text>
        </View>
        {props.children}
      </View>
    </View>
  );
  return (
    <View className={`rounded-3xl border ${props.className ?? 'border-gray-100 bg-white shadow-sm'}`}>
      {props.onPress ? (
        <Pressable accessibilityRole="button" onPress={props.onPress} className="active:opacity-80">
          {row}
        </Pressable>
      ) : (
        row
      )}
      {props.footer ? (
        <View className="gap-2 border-t border-gray-100 px-3 pb-3 pt-3">{props.footer}</View>
      ) : null}
    </View>
  );
}

export function MealCard({ meal, recipe, kosherLevel, onOpenRecipe, footer }: MealCardProps) {
  const t = useT();
  const lang = useLanguage();
  const slotLabel = t(`slots.${meal.slot}`);

  switch (meal.type) {
    case 'recipe':
      return (
        <MealShell
          slotLabel={slotLabel}
          time={meal.time}
          thumbnail={<Thumbnail recipeId={meal.recipe_id} icon="silverware-fork-knife" />}
          onPress={() => onOpenRecipe(meal.recipe_id, meal.portion_multiplier)}
          footer={footer}
        >
          <Text className="text-sm text-gray-700" numberOfLines={2}>
            {recipe ? localizedTitle(recipe, lang) : t('recipe.notFound')}
          </Text>
          <View className="mt-1 flex-row flex-wrap items-center gap-2">
            <Text className="text-sm font-semibold text-brand-600">
              {meal.calories} {t('common.kcal')}
            </Text>
            {meal.portion_multiplier !== 1 && (
              <Text className="text-sm text-gray-500">
                {t('dashboard.portion', { value: meal.portion_multiplier })}
              </Text>
            )}
            {kosherLevel !== 'none' && (
              <KashrutBadge type={recipe?.kashrut_type ?? meal.kashrut_type} />
            )}
            {kosherLevel !== 'none' && recipe?.is_kosher === false && <NotKosherBadge />}
            {meal.prepare_before_shabbat && <ShabbatBadge />}
          </View>
        </MealShell>
      );
    case 'takeaway':
      return (
        <MealShell
          slotLabel={slotLabel}
          time={meal.time}
          thumbnail={<Thumbnail icon="food-takeout-box" />}
          className="border-dashed border-brand-200 bg-brand-50"
          footer={footer}
        >
          <Text className="text-sm font-semibold text-gray-900">{t('dashboard.takeaway')}</Text>
          <Text className="text-sm text-gray-700">
            {t('dashboard.takeawayHint', { kcal: meal.calories_budget })}
          </Text>
          {meal.kosher_only && (
            <Text className="text-sm font-medium text-gray-800">
              {t(
                kosherLevel === 'mehadrin'
                  ? 'dashboard.takeawayMehadrinHint'
                  : 'dashboard.takeawayKosherHint'
              )}
            </Text>
          )}
        </MealShell>
      );
    case 'skip':
      return (
        <MealShell
          slotLabel={slotLabel}
          time={meal.time}
          thumbnail={<Thumbnail icon="food-apple" />}
          className="border-gray-100 bg-gray-50"
          footer={footer}
        >
          <Text className="text-sm text-gray-600">{t('dashboard.skipped')}</Text>
        </MealShell>
      );
    case 'unavailable':
      return (
        <MealShell
          slotLabel={slotLabel}
          time={meal.time}
          thumbnail={<Thumbnail icon="food-off" />}
          className="border-gray-100 bg-gray-50"
          footer={footer}
        >
          <Text className="text-sm text-gray-600">{t('dashboard.unavailable')}</Text>
        </MealShell>
      );
    default: {
      const _exhaustive: never = meal;
      return _exhaustive;
    }
  }
}

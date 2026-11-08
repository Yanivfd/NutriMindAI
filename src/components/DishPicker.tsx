import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image, Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listDishes } from '@/lib/dishPicker';
import type { PickerDish, PickerQuery } from '@/lib/dishPicker';
import { localizedTitle } from '@/lib/format';
import { useLanguage, useT } from '@/lib/i18n';
import { recipeImage } from '@/lib/recipeImages';
import { COLORS } from '@/lib/theme';
import type { RecipeRow } from '@/types/db';
import type { PlannedMeal } from '@/types/plan';

import { Text } from './Text';
import { Button } from './ui';

interface DishPickerProps {
  visible: boolean;
  recipes: readonly RecipeRow[];
  query: PickerQuery;
  meal: PlannedMeal;
  savingPlanId: string | null;
  savingAteId: string | null;
  error: boolean;
  onClose: () => void;
  onPlan: (dish: PickerDish) => void;
  onAte: (dish: PickerDish) => void;
}

/** Browsable list of other recipes for one meal slot. No AI call. */
export function DishPicker(props: DishPickerProps) {
  const t = useT();
  const lang = useLanguage();
  const insets = useSafeAreaInsets();
  const list = listDishes(props.recipes, props.query, props.meal);
  const busy = props.savingPlanId !== null || props.savingAteId !== null;

  return (
    <Modal visible={props.visible} animationType="slide" onRequestClose={props.onClose}>
      <View className="flex-1 bg-surface" style={{ paddingTop: insets.top }}>
        <View className="flex-row items-center gap-3 px-4 pb-2 pt-3">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
            onPress={props.onClose}
            className="h-10 w-10 items-center justify-center rounded-full bg-white"
          >
            <MaterialCommunityIcons name="close" size={22} color={COLORS.brandDark} />
          </Pressable>
          <Text className="flex-1 text-xl font-bold text-gray-900">{t('dishPicker.title')}</Text>
        </View>
        <Text className="px-4 pb-3 text-sm text-gray-600">
          {list.relaxed
            ? t('dishPicker.relaxedHint')
            : t('dishPicker.hint', { kcal: props.query.budget })}
        </Text>
        <ScrollView
          contentContainerClassName="gap-3 px-4"
          contentContainerStyle={{ paddingBottom: 16 + insets.bottom }}
        >
          {list.dishes.length === 0 ? (
            <Text className="py-8 text-center text-sm text-gray-600">{t('dishPicker.empty')}</Text>
          ) : (
            list.dishes.map((dish) => {
              const source = recipeImage(dish.recipe.id);
              const planning = props.savingPlanId === dish.recipe.id;
              const logging = props.savingAteId === dish.recipe.id;
              return (
                <View
                  key={dish.recipe.id}
                  className="gap-3 rounded-3xl border border-gray-100 bg-white p-3 shadow-sm"
                >
                  <View className="flex-row items-center gap-3">
                    {source ? (
                      <Image
                        source={source}
                        accessibilityIgnoresInvertColors
                        style={{ width: 64, height: 64, borderRadius: 32 }}
                      />
                    ) : (
                      <View className="h-16 w-16 items-center justify-center rounded-full bg-brand-100">
                        <MaterialCommunityIcons name="silverware-fork-knife" size={28} color={COLORS.brandDark} />
                      </View>
                    )}
                    <View className="flex-1 gap-0.5">
                      <Text className="text-base font-bold text-gray-900" numberOfLines={2}>
                        {localizedTitle(dish.recipe, lang)}
                      </Text>
                      <Text className="text-sm text-gray-600">
                        {t('dishPicker.meta', {
                          kcal: dish.calories,
                          minutes: dish.recipe.prep_time_minutes,
                          portion: dish.portion,
                        })}
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row gap-2">
                    <View className="flex-1">
                      <Button
                        label={t('dishPicker.planThis')}
                        variant="secondary"
                        icon="chef-hat"
                        onPress={() => props.onPlan(dish)}
                        loading={planning}
                        disabled={busy && !planning}
                      />
                    </View>
                    <View className="flex-1">
                      <Button
                        label={t('dishPicker.ateThis')}
                        icon="check"
                        onPress={() => props.onAte(dish)}
                        loading={logging}
                        disabled={busy && !logging}
                      />
                    </View>
                  </View>
                </View>
              );
            })
          )}
          {props.error && <Text className="text-center text-sm text-meat">{t('common.genericError')}</Text>}
        </ScrollView>
      </View>
    </Modal>
  );
}

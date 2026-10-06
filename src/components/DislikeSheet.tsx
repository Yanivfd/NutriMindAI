import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { localizedName } from '@/lib/format';
import { useLanguage, useT } from '@/lib/i18n';
import { COLORS } from '@/lib/theme';
import type { DislikedIngredient, Ingredient } from '@/types/plan';
import { ingredientKey } from '@/types/plan';

import { Text } from './Text';
import { Button } from './ui';

interface DislikeSheetProps {
  visible: boolean;
  ingredients: Ingredient[];
  loading: boolean;
  errorMessage?: string;
  onCancel: () => void;
  onConfirm: (input: { dislikeDish: boolean; ingredients: DislikedIngredient[] }) => void;
}

/** Asks why a planned dish should be swapped: the dish itself and/or its ingredients. */
export function DislikeSheet(props: DislikeSheetProps) {
  const t = useT();
  const lang = useLanguage();
  const insets = useSafeAreaInsets();
  const [dislikeDish, setDislikeDish] = useState(false);
  const [selected, setSelected] = useState<DislikedIngredient[]>([]);

  const toggleIngredient = (item: Ingredient) => {
    const key = ingredientKey(item.name_en);
    setSelected((current) => {
      const exists = current.some((entry) => ingredientKey(entry.name_en) === key);
      if (exists) return current.filter((entry) => ingredientKey(entry.name_en) !== key);
      return [...current, { name_en: item.name_en.trim(), name_he: item.name_he.trim() }];
    });
  };

  const canConfirm = dislikeDish || selected.length > 0;

  return (
    <Modal visible={props.visible} transparent animationType="fade" onRequestClose={props.onCancel}>
      <View className="flex-1 justify-end bg-black/40">
        <Pressable className="flex-1" accessibilityRole="button" onPress={props.onCancel} />
        <View className="max-h-[85%] rounded-t-3xl bg-white p-4" style={{ paddingBottom: 16 + insets.bottom }}>
          <Text className="text-xl font-bold text-gray-900">{t('recipe.dislikeTitle')}</Text>
          <Text className="mt-1 text-sm text-gray-600">{t('recipe.dislikeHint')}</Text>
          <ScrollView className="mt-3" contentContainerClassName="gap-1 pb-2">
            {props.ingredients.map((item) => {
              const checked = selected.some(
                (entry) => ingredientKey(entry.name_en) === ingredientKey(item.name_en)
              );
              return (
                <Pressable
                  key={`${item.name_en}|${item.unit}`}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                  onPress={() => toggleIngredient(item)}
                  className="flex-row items-center gap-3 rounded-2xl border border-gray-100 px-3 py-3"
                >
                  <MaterialCommunityIcons
                    name={checked ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={22}
                    color={checked ? COLORS.brandDark : '#9ca3af'}
                  />
                  <Text className="flex-1 text-base text-gray-900">{localizedName(item, lang)}</Text>
                </Pressable>
              );
            })}
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: dislikeDish }}
              onPress={() => setDislikeDish((value) => !value)}
              className="mt-2 flex-row items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-3 py-3"
            >
              <MaterialCommunityIcons
                name={dislikeDish ? 'checkbox-marked' : 'checkbox-blank-outline'}
                size={22}
                color={COLORS.brandDark}
              />
              <Text className="flex-1 text-base font-medium text-gray-900">
                {t('recipe.dislikeDishGenerally')}
              </Text>
            </Pressable>
          </ScrollView>
          {props.errorMessage ? (
            <Text className="mb-2 text-center text-meat">{props.errorMessage}</Text>
          ) : null}
          <View className="gap-2">
            <Button
              label={props.loading ? t('recipe.replacing') : t('recipe.replaceMeal')}
              icon="swap-horizontal"
              onPress={() => props.onConfirm({ dislikeDish, ingredients: selected })}
              loading={props.loading}
              disabled={!canConfirm}
            />
            <Button label={t('common.cancel')} variant="secondary" onPress={props.onCancel} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

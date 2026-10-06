import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, View } from 'react-native';

import { localizedName } from '@/lib/format';
import { useLanguage, useT } from '@/lib/i18n';
import { COLORS } from '@/lib/theme';
import { groceryItemKey } from '@/store/useGroceryStore';
import type { GroceryCategory, GrocerySection as GrocerySectionData } from '@/types/plan';

import { Text } from './Text';
import type { IconName } from './ui';

const CATEGORY_ICONS: Record<GroceryCategory, IconName> = {
  produce: 'carrot',
  dairy: 'cheese',
  meat_fish: 'fish',
  bakery: 'baguette',
  pantry: 'shaker-outline',
  frozen: 'snowflake',
  beverages: 'cup-water',
};

interface GrocerySectionProps {
  section: GrocerySectionData;
  checked: ReadonlySet<string>;
  onToggle: (itemKey: string) => void;
  /** Insect checking is a kashrut practice; only shown in kosher plans. */
  showInsectCheck: boolean;
}

export function GrocerySection({ section, checked, onToggle, showInsectCheck }: GrocerySectionProps) {
  const t = useT();
  const lang = useLanguage();

  return (
    <View className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
      <View className="mb-1 flex-row items-center gap-2">
        <View className="h-8 w-8 items-center justify-center rounded-full bg-brand-100">
          <MaterialCommunityIcons
            name={CATEGORY_ICONS[section.category]}
            size={18}
            color={COLORS.brandDark}
          />
        </View>
        <Text className="text-base font-bold text-gray-900">
          {t(`categories.${section.category}`)}
        </Text>
      </View>
      {section.items.map((item) => {
        const key = groceryItemKey(section.category, item);
        const isChecked = checked.has(key);
        return (
          <Pressable
            key={key}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isChecked }}
            onPress={() => onToggle(key)}
            className="flex-row items-start gap-3 border-b border-gray-50 py-2.5"
          >
            <MaterialCommunityIcons
              name={isChecked ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
              size={24}
              color={isChecked ? COLORS.brand : '#9ca3af'}
            />
            <View className="flex-1">
              <View className="flex-row justify-between gap-2">
                <Text
                  className={`flex-1 text-base ${isChecked ? 'text-gray-400 line-through' : 'text-gray-900'}`}
                >
                  {localizedName(item, lang)}
                </Text>
                <Text className={isChecked ? 'text-gray-400' : 'text-gray-600'}>
                  {item.amount} {t(`units.${item.unit}`)}
                </Text>
              </View>
              {showInsectCheck && item.insect_check && !isChecked && (
                <View className="mt-1 flex-row items-center gap-1">
                  <MaterialCommunityIcons name="bug-outline" size={14} color="#b45309" />
                  <Text className="flex-1 text-xs text-amber-700">{t('grocery.insectCheck')}</Text>
                </View>
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

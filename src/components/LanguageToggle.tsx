import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';

import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { changeLanguage, useLanguage, useLayoutDirection, useT } from '@/lib/i18n';
import type { Language } from '@/lib/i18n';
import { COLORS } from '@/lib/theme';

import { Text } from './Text';

/** Native names, so the list stays readable in every language. Add a row here for each new locale. */
const LANGUAGES: { lang: Language; label: string }[] = [
  { lang: 'he', label: 'עברית' },
  { lang: 'en', label: 'English' },
];

type LanguageToggleVariant = 'field' | 'compact';

/**
 * Opens a sheet to pick Hebrew or English.
 * `field` is a full-width row for forms; `compact` is a header chip.
 */
export function LanguageToggle({ variant = 'field' }: { variant?: LanguageToggleVariant }) {
  const t = useT();
  const current = useLanguage();
  const direction = useLayoutDirection();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const selected = LANGUAGES.find((item) => item.lang === current) ?? LANGUAGES[0];

  const choose = (lang: Language) => {
    setOpen(false);
    if (lang !== current) changeLanguage(lang);
  };

  return (
    <>
      {variant === 'compact' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('profile.language')}
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen(true)}
          className="flex-row items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1.5 active:opacity-80"
        >
          <MaterialCommunityIcons name="translate" size={18} color={COLORS.brandDark} />
          <Text className="text-sm font-medium text-gray-900">{selected.label}</Text>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('profile.language')}
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen(true)}
          className="w-full flex-row items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3 active:opacity-80"
        >
          <Text className="text-base text-gray-900">{selected.label}</Text>
          <MaterialCommunityIcons name="chevron-down" size={22} color={COLORS.brandDark} />
        </Pressable>
      )}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View className="flex-1 justify-end">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
            className="absolute inset-0 bg-black/40"
            onPress={() => setOpen(false)}
          />
          <View
            style={{ direction, paddingBottom: insets.bottom + 16 }}
            className="max-h-[70%] gap-2 rounded-t-3xl bg-white px-4 pt-5"
          >
            <Text className="text-lg font-bold text-gray-900">{t('profile.language')}</Text>
            <ScrollView>
              {LANGUAGES.map((item) => {
                const chosen = item.lang === current;
                return (
                  <Pressable
                    key={item.lang}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: chosen }}
                    onPress={() => choose(item.lang)}
                    className={`flex-row items-center gap-3 rounded-2xl px-3 py-3 ${chosen ? 'bg-brand-50' : ''}`}
                  >
                    <MaterialCommunityIcons
                      name={chosen ? 'radiobox-marked' : 'radiobox-blank'}
                      size={22}
                      color={chosen ? COLORS.brand : '#9ca3af'}
                    />
                    <Text className={`flex-1 text-base ${chosen ? 'font-semibold text-brand-700' : 'text-gray-800'}`}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

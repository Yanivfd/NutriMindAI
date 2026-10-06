import { getLocales } from 'expo-localization';
import { I18n } from 'i18n-js';
import type { TranslateOptions } from 'i18n-js';
import { useCallback } from 'react';
import { I18nManager } from 'react-native';

import en from '@/locales/en.json';
import he from '@/locales/he.json';
import { usePreferencesStore } from '@/store/usePreferencesStore';
import type { Language } from '@/store/usePreferencesStore';

export type { Language };

export const i18n = new I18n({ en, he });
i18n.enableFallback = true;
i18n.defaultLocale = 'en';

export function deviceLanguage(): Language {
  const code = getLocales()[0]?.languageCode;
  return code === 'he' || code === 'iw' ? 'he' : 'en';
}

export function isRtlLanguage(language: Language): boolean {
  return language === 'he';
}

/** Layout direction for the current language. Applied in style so it updates without an app restart. */
export function layoutDirection(language: Language): 'rtl' | 'ltr' {
  return isRtlLanguage(language) ? 'rtl' : 'ltr';
}

export function useLanguage(): Language {
  return usePreferencesStore((s) => s.language) ?? deviceLanguage();
}

export function useLayoutDirection(): 'rtl' | 'ltr' {
  return layoutDirection(useLanguage());
}

/** Translation function that re-renders the component when the language changes. */
export function useT(): (key: string, options?: TranslateOptions) => string {
  const language = useLanguage();
  return useCallback(
    (key: string, options?: TranslateOptions) => i18n.t(key, { ...options, locale: language }),
    [language]
  );
}

/**
 * Keeps the native direction flag in step with the chosen language.
 * `isRTL` is a snapshot taken at startup; screens read it while rendering, so the field is
 * updated too. The visible layout uses `useLayoutDirection()` and does not wait for a restart.
 */
function applyDirection(language: Language): void {
  const rtl = isRtlLanguage(language);
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(rtl);
  (I18nManager as { isRTL: boolean }).isRTL = rtl;
}

/** Switches language and layout direction immediately. */
export function changeLanguage(language: Language): void {
  applyDirection(language);
  i18n.locale = language;
  usePreferencesStore.getState().setLanguage(language);
}

/** Call once after preferences load, before the first screen. */
export function syncDirectionOnStartup(): void {
  const language = usePreferencesStore.getState().language ?? deviceLanguage();
  i18n.locale = language;
  applyDirection(language);
}

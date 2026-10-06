import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Language = 'he' | 'en';

export interface ReminderSwitches {
  meals: boolean;
  shopping: boolean;
  water: boolean;
  weight: boolean;
  checkIn: boolean;
}

export const DEFAULT_REMINDERS: ReminderSwitches = {
  meals: true,
  shopping: true,
  water: true,
  weight: true,
  checkIn: true,
};

interface PreferencesState {
  /** null until the user picks one; the device language is used meanwhile. */
  language: Language | null;
  reminders: ReminderSwitches;
  /** True after the first-run welcome is finished on this device. */
  hasSeenWelcome: boolean;
  setLanguage: (language: Language) => void;
  setReminder: (key: keyof ReminderSwitches, enabled: boolean) => void;
  setHasSeenWelcome: (seen: boolean) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      language: null,
      reminders: DEFAULT_REMINDERS,
      hasSeenWelcome: false,
      setLanguage: (language) => set({ language }),
      setReminder: (key, enabled) =>
        set((state) => ({
          reminders: { ...DEFAULT_REMINDERS, ...state.reminders, [key]: enabled },
        })),
      setHasSeenWelcome: (hasSeenWelcome) => set({ hasSeenWelcome }),
    }),
    {
      name: 'preferences',
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persisted, current) => {
        const saved = persisted as Partial<PreferencesState> | undefined;
        return {
          ...current,
          ...saved,
          reminders: { ...DEFAULT_REMINDERS, ...saved?.reminders },
          hasSeenWelcome: saved?.hasSeenWelcome === true,
        };
      },
    }
  )
);

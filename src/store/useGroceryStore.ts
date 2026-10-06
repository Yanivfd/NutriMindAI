import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { GroceryItem, GrocerySection } from '@/types/plan';

const MAX_PLANS_KEPT = 4;

/** Stable key for a grocery item within a plan. */
export function groceryItemKey(category: GrocerySection['category'], item: GroceryItem): string {
  return `${category}|${item.name_en.toLowerCase()}|${item.unit}`;
}

interface GroceryState {
  /** Checked item keys per plan id. Regenerating a week keeps the same plan id. */
  checkedByPlan: Record<string, string[]>;
  /** Plan ids, most recently used first, so old plans can be pruned. */
  planOrder: string[];
  toggle: (planId: string, itemKey: string) => void;
  clear: (planId: string) => void;
}

export const useGroceryStore = create<GroceryState>()(
  persist(
    (set) => ({
      checkedByPlan: {},
      planOrder: [],
      toggle: (planId, itemKey) =>
        set((state) => {
          const current = state.checkedByPlan[planId] ?? [];
          const next = current.includes(itemKey)
            ? current.filter((k) => k !== itemKey)
            : [...current, itemKey];
          const planOrder = [planId, ...state.planOrder.filter((id) => id !== planId)];
          const kept = planOrder.slice(0, MAX_PLANS_KEPT);
          const checkedByPlan: Record<string, string[]> = {};
          for (const id of kept) {
            checkedByPlan[id] = id === planId ? next : (state.checkedByPlan[id] ?? []);
          }
          return { checkedByPlan, planOrder: kept };
        }),
      clear: (planId) =>
        set((state) => ({ checkedByPlan: { ...state.checkedByPlan, [planId]: [] } })),
    }),
    { name: 'grocery-checks', storage: createJSONStorage(() => AsyncStorage) }
  )
);

/** Checked keys for a plan (stable empty array when none). */
const EMPTY: string[] = [];
export function useCheckedItems(planId: string | undefined): string[] {
  return useGroceryStore((s) => (planId ? (s.checkedByPlan[planId] ?? EMPTY) : EMPTY));
}

import type { Language } from '../store/usePreferencesStore.ts';
import type { IngredientSwap, Unit } from '../types/plan.ts';

/** Kitchen-friendly amount: g/ml to the nearest 5, other units to the nearest half. */
export function formatAmount(amount: number, unit: Unit): string {
  if (unit === 'g' || unit === 'ml') return String(Math.max(5, Math.round(amount / 5) * 5));
  const half = Math.max(0.5, Math.round(amount * 2) / 2);
  return Number.isInteger(half) ? String(half) : half.toFixed(1);
}

/** "4/10" from "2026-10-04". */
export function formatDayMonth(isoDate: string): string {
  const [, month, day] = isoDate.split('-').map(Number);
  return `${day}/${month}`;
}

export function localizedName(item: Pick<IngredientSwap, 'name_he' | 'name_en'>, lang: Language) {
  return lang === 'he' ? item.name_he : item.name_en;
}

export function localizedTitle(recipe: { title_he: string; title_en: string }, lang: Language) {
  return lang === 'he' ? recipe.title_he : recipe.title_en;
}

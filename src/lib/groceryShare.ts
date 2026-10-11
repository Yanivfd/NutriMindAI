import type { Language } from '../store/usePreferencesStore.ts';
import type { GroceryCategory, GroceryItem, GrocerySection, Unit } from '../types/plan.ts';

import { formatAmount, localizedName } from './format.ts';

/** Stable key for a grocery item within a plan. */
export function groceryItemKey(category: GrocerySection['category'], item: GroceryItem): string {
  return `${category}|${item.name_en.toLowerCase()}|${item.unit}`;
}

/** Emoji prefix for each grocery category in the shared list. */
export const CATEGORY_EMOJI: Record<GroceryCategory, string> = {
  produce: '🥕',
  dairy: '🧀',
  meat_fish: '🐟',
  bakery: '🥖',
  pantry: '🫙',
  frozen: '🧊',
  beverages: '🥤',
};

/** Labels the UI supplies so the formatter stays free of i18n. */
export interface GroceryShareLabels {
  title: string;
  categoryLabel: (category: GroceryCategory) => string;
  unitLabel: (unit: Unit) => string;
  /** Optional week line under the title (e.g. "Week of 5/10"). */
  weekLine?: string;
}

/**
 * Builds a plain-text checklist for the system share sheet (WhatsApp, Keep, etc.).
 * Checked items use ☑; unchecked use ☐ so the list stays usable outside the app.
 */
export function formatGroceryShareText(
  sections: GrocerySection[],
  lang: Language,
  labels: GroceryShareLabels,
  checkedKeys: ReadonlySet<string> = new Set()
): string {
  const lines: string[] = [labels.title];
  if (labels.weekLine) lines.push(labels.weekLine);

  for (const section of sections) {
    if (section.items.length === 0) continue;
    lines.push('');
    const emoji = CATEGORY_EMOJI[section.category];
    lines.push(`${emoji} ${labels.categoryLabel(section.category)}`);
    for (const item of section.items) {
      const key = groceryItemKey(section.category, item);
      const mark = checkedKeys.has(key) ? '☑' : '☐';
      const name = localizedName(item, lang);
      const amount = formatAmount(item.amount, item.unit);
      const unit = labels.unitLabel(item.unit);
      lines.push(`${mark} ${name} — ${amount} ${unit}`);
    }
  }

  return lines.join('\n').trim();
}

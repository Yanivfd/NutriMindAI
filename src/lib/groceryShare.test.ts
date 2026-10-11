import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { GrocerySection } from '../types/plan.ts';

import { formatGroceryShareText, groceryItemKey } from './groceryShare.ts';

const sections: GrocerySection[] = [
  {
    category: 'produce',
    items: [
      {
        name_he: 'עגבניות',
        name_en: 'Tomatoes',
        amount: 502,
        unit: 'g',
        insect_check: true,
      },
      {
        name_he: 'מלפפון',
        name_en: 'Cucumber',
        amount: 2,
        unit: 'unit',
        insect_check: false,
      },
    ],
  },
  {
    category: 'dairy',
    items: [
      {
        name_he: 'יוגורט',
        name_en: 'Yogurt',
        amount: 200,
        unit: 'g',
        insect_check: false,
      },
    ],
  },
];

const labels = {
  title: 'Shopping list',
  weekLine: 'Week of 5/10',
  categoryLabel: (c: string) => (c === 'produce' ? 'Fruit & vegetables' : 'Dairy & eggs'),
  unitLabel: (u: string) => (u === 'unit' ? 'pcs' : u),
};

test('formats a bilingual checklist with category headers', () => {
  const text = formatGroceryShareText(sections, 'en', labels);
  assert.equal(
    text,
    [
      'Shopping list',
      'Week of 5/10',
      '',
      '🥕 Fruit & vegetables',
      '☐ Tomatoes — 500 g',
      '☐ Cucumber — 2 pcs',
      '',
      '🧀 Dairy & eggs',
      '☐ Yogurt — 200 g',
    ].join('\n')
  );
});

test('uses Hebrew names and marks checked items', () => {
  const tomato = sections[0]!.items[0]!;
  const key = groceryItemKey('produce', tomato);
  const text = formatGroceryShareText(sections, 'he', labels, new Set([key]));
  assert.match(text, /^Shopping list/);
  assert.match(text, /☑ עגבניות — 500 g/);
  assert.match(text, /☐ מלפפון — 2 pcs/);
  assert.match(text, /☐ יוגורט — 200 g/);
});

test('skips empty sections', () => {
  const text = formatGroceryShareText(
    [{ category: 'frozen', items: [] }, ...sections],
    'en',
    { title: 'List', categoryLabel: () => 'X', unitLabel: (u) => u }
  );
  assert.ok(!text.includes('frozen'));
  assert.ok(text.startsWith('List\n\n🥕 X'));
});

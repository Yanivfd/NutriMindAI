import type { Diet, Recipe } from './types.ts';

import { DIETS } from './types.ts';

/** Land meat. Matched as whole words so a longer word cannot hide inside another. */
const MEAT_WORDS = [
  'bacon',
  'beef',
  'chicken',
  'duck',
  'ham',
  'lamb',
  'pepperoni',
  'pork',
  'prosciutto',
  'sausage',
  'schnitzel',
  'turkey',
  'veal',
];

/** Fish and seafood, including kinds a vegetarian does not eat. */
const FISH_WORDS = [
  'anchovy',
  'clam',
  'cod',
  'crab',
  'fish',
  'lobster',
  'mussel',
  'oyster',
  'prawn',
  'salmon',
  'sardine',
  'scallop',
  'shrimp',
  'tilapia',
  'tuna',
];

const DAIRY_WORDS = [
  'butter',
  'cheese',
  'cottage',
  'cream',
  'feta',
  'ghee',
  'halloumi',
  'labneh',
  'milk',
  'mozzarella',
  'whey',
  'yogurt',
  'yoghurt',
];

const EGG_WORDS = ['egg', 'eggs', 'mayonnaise', 'mayo'];
const HONEY_WORDS = ['honey'];

export function normalizeDiet(value: unknown): Diet {
  return typeof value === 'string' && (DIETS as readonly string[]).includes(value)
    ? (value as Diet)
    : 'none';
}

function tokens(name: string): string[] {
  return name.toLowerCase().split(/[^a-z]+/).filter((token) => token.length > 0);
}

function mentions(name: string, words: readonly string[]): boolean {
  const found = new Set(tokens(name));
  return words.some((word) => found.has(word));
}

function ingredientNames(recipe: Recipe): string[] {
  const names: string[] = [];
  for (const item of recipe.ingredients ?? []) {
    names.push(item.name_en);
    for (const swap of item.swaps ?? []) names.push(swap.name_en);
  }
  return names;
}

export interface FoodFlags {
  meat: boolean;
  fish: boolean;
  dairy: boolean;
  egg: boolean;
  honey: boolean;
}

/** What a dish contains, from ingredient and swap names. The title is ignored. */
export function foodFlags(recipe: Recipe): FoodFlags {
  const names = ingredientNames(recipe);
  return {
    meat: names.some((name) => mentions(name, MEAT_WORDS)),
    fish: names.some((name) => mentions(name, FISH_WORDS)),
    dairy: names.some((name) => mentions(name, DAIRY_WORDS)),
    egg: names.some((name) => mentions(name, EGG_WORDS)),
    honey: names.some((name) => mentions(name, HONEY_WORDS)),
  };
}

/** True when this dish is allowed on the diet. `none` allows everything. */
export function recipeFitsDiet(recipe: Recipe, diet: Diet | undefined): boolean {
  const choice = diet ?? 'none';
  if (choice === 'none') return true;
  const flags = foodFlags(recipe);
  if (flags.meat) return false;
  if (choice === 'pescatarian') return true;
  if (flags.fish) return false;
  if (choice === 'vegetarian') return true;
  return !flags.dairy && !flags.egg && !flags.honey;
}

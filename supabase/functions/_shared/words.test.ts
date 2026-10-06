import assert from 'node:assert/strict';
import { test } from 'node:test';

import { clampSnackText, MAX_SNACK_WORDS, parseSnackEstimate, roundSnackCalories, wordCount } from './words.ts';

test('wordCount treats empty and space-only text as zero', () => {
  assert.equal(wordCount(''), 0);
  assert.equal(wordCount('   \n\t  '), 0);
});

test('wordCount ignores extra spaces between words', () => {
  assert.equal(wordCount('  two   slices   of pizza  '), 4);
});

test('clampSnackText keeps a trailing space so the next word can be typed', () => {
  assert.equal(clampSnackText(' '), ' ');
  assert.equal(clampSnackText('slice '), 'slice ');
  assert.equal(wordCount(clampSnackText('slice ')), 1);
});

test('clampSnackText stops at 40 words', () => {
  const words = Array.from({ length: 41 }, (_, index) => `w${index + 1}`);
  const clamped = clampSnackText(words.join(' '));
  assert.equal(wordCount(clamped), MAX_SNACK_WORDS);
  assert.equal(clamped.endsWith('w40'), true);
  assert.equal(clamped.includes('w41'), false);
  assert.equal(clampSnackText(`${clamped} `).endsWith(' '), false);
});

test('roundSnackCalories snaps to tens inside 1..5000', () => {
  assert.equal(roundSnackCalories(155), 160);
  assert.equal(roundSnackCalories(4), 1);
  assert.equal(roundSnackCalories(9000), 5000);
  assert.equal(roundSnackCalories(0), null);
  assert.equal(roundSnackCalories(Number.NaN), null);
});

test('parseSnackEstimate rejects text that is not food', () => {
  assert.deepEqual(parseSnackEstimate({ food: false, calories: 0 }), { ok: false, error: 'NOT_FOOD' });
  assert.deepEqual(parseSnackEstimate({ food: true, calories: 250 }), { ok: true, calories: 250 });
  assert.deepEqual(parseSnackEstimate(null), { ok: false, error: 'ESTIMATE_FAILED' });
});

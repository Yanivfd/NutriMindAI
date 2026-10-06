import assert from 'node:assert/strict';
import { test } from 'node:test';

import { toE164 } from './phone.ts';

test('toE164 accepts a number that already has a country code', () => {
  assert.equal(toE164('+1 202-555-0143'), '+12025550143');
  assert.equal(toE164('+972 50-123-4567'), '+972501234567');
  assert.equal(toE164('972501234567'), '+972501234567');
});

test('toE164 turns an Israeli mobile that starts with 0 into +972', () => {
  assert.equal(toE164('050-123-4567'), '+972501234567');
  assert.equal(toE164('0721234567'), '+972721234567');
});

test('toE164 rejects numbers that are not a full mobile number', () => {
  assert.equal(toE164(''), null);
  assert.equal(toE164('12345'), null);
  assert.equal(toE164('050123'), null);
  assert.equal(toE164('03-1234567'), null);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { displayDate, parseIsoDate, parseTime, toIsoDate, toTime, yearsBefore } from './dateInput.ts';

test('ISO dates round-trip and reject impossible days', () => {
  const date = parseIsoDate('1990-01-31');
  assert.ok(date);
  assert.equal(toIsoDate(date), '1990-01-31');
  assert.equal(parseIsoDate('1990-02-30'), null);
  assert.equal(parseIsoDate('31/01/1990'), null);
  assert.equal(parseIsoDate(''), null);
});

test('displayDate shows day first and leaves bad input alone', () => {
  assert.equal(displayDate('1990-01-05'), '05/01/1990');
  assert.equal(displayDate('abc'), 'abc');
});

test('times round-trip and reject out-of-range values', () => {
  const time = parseTime('7:05', new Date(2026, 0, 1));
  assert.ok(time);
  assert.equal(toTime(time), '07:05');
  assert.equal(parseTime('24:00'), null);
  assert.equal(parseTime('12:60'), null);
  assert.equal(parseTime('noon'), null);
});

test('yearsBefore keeps the calendar day', () => {
  assert.equal(toIsoDate(yearsBefore(new Date(2026, 9, 4), 16)), '2010-10-04');
});

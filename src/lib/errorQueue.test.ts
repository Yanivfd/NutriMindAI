import assert from 'node:assert/strict';
import { test } from 'node:test';

import { appendErrorQueue, parseErrorQueue, removeErrorQueueIds } from './errorQueue.ts';
import type { PendingErrorLog } from './errorQueue.ts';

const sample = (id: string, message: string): PendingErrorLog => ({
  id,
  message,
  stack: null,
  source: 'js',
  screen: '/tabs',
  app_version: '1.0.0',
});

test('parseErrorQueue returns [] for missing or corrupt storage', () => {
  assert.deepEqual(parseErrorQueue(null), []);
  assert.deepEqual(parseErrorQueue('not-json'), []);
  assert.deepEqual(parseErrorQueue('{}'), []);
  assert.deepEqual(parseErrorQueue(JSON.stringify([{ message: 'x' }])), []);
});

test('parseErrorQueue keeps only well-formed rows', () => {
  const good = sample('1', 'boom');
  const parsed = parseErrorQueue(JSON.stringify([good, { message: 1 }, 'x']));
  assert.deepEqual(parsed, [good]);
});

test('appendErrorQueue keeps the newest rows when over max', () => {
  const queue = [sample('1', 'a'), sample('2', 'b')];
  const next = appendErrorQueue(queue, sample('3', 'c'), 2);
  assert.deepEqual(
    next.map((row) => row.message),
    ['b', 'c']
  );
});

test('removeErrorQueueIds drops uploaded rows and keeps newer ones', () => {
  const queue = [sample('1', 'a'), sample('2', 'b'), sample('3', 'c')];
  assert.deepEqual(
    removeErrorQueueIds(queue, ['1', '3']).map((row) => row.id),
    ['2']
  );
});

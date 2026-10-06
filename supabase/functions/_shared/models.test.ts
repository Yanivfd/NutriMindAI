import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DEFAULT_BACKUP_MODELS, DEFAULT_PRIMARY_MODEL, modelCandidates } from './models.ts';

test('primary first, then default backups', () => {
  assert.deepEqual(modelCandidates('my-model', undefined), ['my-model', ...DEFAULT_BACKUP_MODELS]);
});

test('missing or blank primary uses the default primary', () => {
  assert.equal(modelCandidates(undefined, undefined)[0], DEFAULT_PRIMARY_MODEL);
  assert.equal(modelCandidates('  ', undefined)[0], DEFAULT_PRIMARY_MODEL);
});

test('env backups replace the defaults; duplicates and blanks are dropped', () => {
  assert.deepEqual(modelCandidates('a', ' b, a ,, c '), ['a', 'b', 'c']);
});

test('empty env value means no backups', () => {
  assert.deepEqual(modelCandidates('a', ''), ['a']);
});

test('a backup equal to the primary is not tried twice', () => {
  const models = modelCandidates('gemini-3.5-flash', undefined);
  assert.equal(models.filter((m) => m === 'gemini-3.5-flash').length, 1);
});

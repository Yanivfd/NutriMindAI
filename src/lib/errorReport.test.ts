import assert from 'node:assert/strict';
import { test } from 'node:test';

import { errorText, shouldReport } from './errorReport.ts';

test('errorText strips emails and phone numbers', () => {
  const error = new Error('send failed for friend@example.com at +972 50-123-4567');
  error.stack = 'Error\n at login friend@example.com';
  const text = errorText(error);
  assert.equal(text.message, 'send failed for [email] at [number]');
  assert.match(text.stack ?? '', /\[email\]/);
  assert.doesNotMatch(text.message, /example\.com/);
});

test('shouldReport skips expected limits and a wrong login code', () => {
  assert.equal(shouldReport(new Error('NO_RECIPES')), false);
  assert.equal(shouldReport({ code: 'otp_expired', message: 'expired' }), false);
  assert.equal(shouldReport(new Error('NETWORK')), true);
});

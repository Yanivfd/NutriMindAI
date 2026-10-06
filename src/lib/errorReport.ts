/** Where an error was caught. Stored on app_error_logs.source. */
export type ErrorSource = 'js' | 'render' | 'query' | 'mutation' | 'auth';

const EXPECTED_MESSAGES = new Set([
  'INVALID_WEEK',
  'PROFILE_REQUIRED',
  'UNAUTHORIZED',
  'NO_RECIPES',
]);

/** User mistakes and expected product limits, not bugs worth a database row. */
export function shouldReport(error: unknown): boolean {
  const message = rawMessage(error);
  if (EXPECTED_MESSAGES.has(message)) return false;
  const code = errorCode(error);
  return code !== 'otp_expired' && code !== 'otp_disabled';
}

/** Message and stack safe to store: no email addresses or phone numbers. */
export function errorText(error: unknown): { message: string; stack: string | null } {
  const message = redact(rawMessage(error)).slice(0, 500);
  const stack = redact(rawStack(error)).slice(0, 4000);
  return { message: message || 'Unknown error', stack: stack || null };
}

function rawMessage(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

function rawStack(error: unknown): string {
  return error instanceof Error && error.stack ? error.stack : '';
}

function errorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  const code = error.code;
  return typeof code === 'string' ? code : null;
}

function redact(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/\+?\d[\d\s()-]{7,}\d/g, '[number]');
}

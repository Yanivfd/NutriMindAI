import { addDays, currentWeekStart, weekdayOf } from '../../supabase/functions/_shared/planRules.ts';

export { addDays, currentWeekStart, weekdayOf };

export const APP_TIME_ZONE = 'Asia/Jerusalem';

/** Calendar date (YYYY-MM-DD) of an ISO timestamp in Israel time. */
export function localDateOf(isoTimestamp: string, timeZone = APP_TIME_ZONE): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(isoTimestamp));
}

/** 'HH:MM' (24h) of an ISO timestamp in Israel time. */
export function localTimeOf(isoTimestamp: string, timeZone = APP_TIME_ZONE): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(isoTimestamp));
}

export function todayLocal(): string {
  return localDateOf(new Date().toISOString());
}

/** Sunday of this week (offset 0) or next week (offset 1), Israel time. */
export function weekStartFor(offset: 0 | 1): string {
  return addDays(currentWeekStart(new Date(), APP_TIME_ZONE), offset * 7);
}

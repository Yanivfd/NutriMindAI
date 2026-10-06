/** Conversions between form strings and the Date objects native pickers use (device-local time). */

const pad = (n: number) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' -> local Date, or null when the string is not a real date. */
export function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 'YYYY-MM-DD' -> 'DD/MM/YYYY' for display; other input is returned unchanged. */
export function displayDate(value: string): string {
  const date = parseIsoDate(value);
  return date ? `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}` : value;
}

/** 'HH:MM' -> Date on `base`'s day at that time, or null when invalid. */
export function parseTime(value: string, base = new Date()): Date | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [hours, minutes] = [Number(match[1]), Number(match[2])];
  if (hours > 23 || minutes > 59) return null;
  const date = new Date(base);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export function toTime(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** The date `years` years before `today` (Feb 29 rolls to Mar 1). */
export function yearsBefore(today: Date, years: number): Date {
  return new Date(today.getFullYear() - years, today.getMonth(), today.getDate());
}

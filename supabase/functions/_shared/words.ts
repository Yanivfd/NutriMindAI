/** Maximum words in a free-form snack description. */
export const MAX_SNACK_WORDS = 40;
/** Matches the cheat_logs.note column limit. */
export const MAX_SNACK_CHARS = 400;
/** One short coaching tip returned with a snack calorie estimate. */
export const MAX_TIP_CHARS = 180;

/** Words separated by whitespace. Empty and space-only text count as zero. */
export function wordCount(text: string): number {
  const trimmed = text.trim();
  if (trimmed === '') return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Keeps at most 40 words and 400 characters. A paste that is too long is cut, not rejected.
 * One trailing space is kept while there is still room for another word, so the keyboard
 * space key can start the next word.
 */
export function clampSnackText(text: string): string {
  const limited = text.slice(0, MAX_SNACK_CHARS);
  const match = /^(?:\s*\S+){0,40}/.exec(limited);
  const words = match?.[0] ?? '';
  const trailing = limited.slice(words.length);
  if (wordCount(words) < MAX_SNACK_WORDS && trailing.startsWith(' ')) {
    return `${words} `;
  }
  return words;
}

/**
 * Nearest 10 kcal, kept between 1 and 5000.
 * Zero, negative, and non-numbers are not an estimate.
 */
export function roundSnackCalories(value: number): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const rounded = Math.round(value / 10) * 10;
  return Math.min(5000, Math.max(1, rounded));
}

/** Trims and caps a coaching tip; empty or non-string input becomes "". */
export function clampTip(text: unknown): string {
  if (typeof text !== 'string') return '';
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (trimmed === '') return '';
  return trimmed.slice(0, MAX_TIP_CHARS);
}

/** Reads the model JSON. `food: false` means the text was not food or drink. */
export function parseSnackEstimate(
  raw: unknown
):
  | { ok: true; calories: number; tip: string }
  | { ok: false; error: 'NOT_FOOD' | 'ESTIMATE_FAILED' } {
  if (typeof raw !== 'object' || raw === null) return { ok: false, error: 'ESTIMATE_FAILED' };
  const food = 'food' in raw ? raw.food : undefined;
  const calories = 'calories' in raw ? raw.calories : undefined;
  if (food === false) return { ok: false, error: 'NOT_FOOD' };
  if (food !== true || typeof calories !== 'number') return { ok: false, error: 'ESTIMATE_FAILED' };
  const rounded = roundSnackCalories(calories);
  if (rounded === null) return { ok: false, error: 'ESTIMATE_FAILED' };
  const tip = clampTip('tip' in raw ? raw.tip : '');
  return { ok: true, calories: rounded, tip };
}

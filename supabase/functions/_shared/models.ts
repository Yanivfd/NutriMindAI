/** Tried in order after the primary model when it is overloaded or fails. */
export const DEFAULT_BACKUP_MODELS = ['gemini-3.7-flash', 'gemini-3.5-flash', 'gemini-flash-latest'];

export const DEFAULT_PRIMARY_MODEL = 'gemini-3.8-flash';

/**
 * Primary model first, then backups (comma-separated env override), without duplicates
 * or blanks.
 */
export function modelCandidates(primary: string | undefined, backupsEnv: string | undefined): string[] {
  const backups =
    backupsEnv === undefined ? DEFAULT_BACKUP_MODELS : backupsEnv.split(',').map((m) => m.trim());
  const ordered = [primary?.trim() || DEFAULT_PRIMARY_MODEL, ...backups];
  return ordered.filter((model, i) => model !== '' && ordered.indexOf(model) === i);
}

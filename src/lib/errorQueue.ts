import type { ErrorSource } from '@/lib/errorReport';

/** One error waiting to be uploaded to app_error_logs. */
export interface PendingErrorLog {
  id: string;
  message: string;
  stack: string | null;
  source: ErrorSource;
  screen: string;
  app_version: string | null;
}

const SOURCES = new Set<ErrorSource>(['js', 'render', 'query', 'mutation', 'auth']);

/** Reads a stored queue; corrupt or unknown shapes become an empty list. */
export function parseErrorQueue(raw: string | null): PendingErrorLog[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPendingErrorLog);
  } catch {
    return [];
  }
}

/** Appends a row and keeps only the newest `max` entries. */
export function appendErrorQueue(
  queue: PendingErrorLog[],
  row: PendingErrorLog,
  max: number
): PendingErrorLog[] {
  const next = [...queue, row];
  return next.length > max ? next.slice(next.length - max) : next;
}

/** Drops rows that already uploaded successfully. */
export function removeErrorQueueIds(queue: PendingErrorLog[], ids: readonly string[]): PendingErrorLog[] {
  if (ids.length === 0) return queue;
  const drop = new Set(ids);
  return queue.filter((row) => !drop.has(row.id));
}

function isPendingErrorLog(value: unknown): value is PendingErrorLog {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    row.id.length > 0 &&
    typeof row.message === 'string' &&
    row.message.length > 0 &&
    (typeof row.stack === 'string' || row.stack === null) &&
    typeof row.source === 'string' &&
    SOURCES.has(row.source as ErrorSource) &&
    typeof row.screen === 'string' &&
    (typeof row.app_version === 'string' || row.app_version === null)
  );
}

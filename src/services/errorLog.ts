import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

import { appendErrorQueue, parseErrorQueue, removeErrorQueueIds } from '@/lib/errorQueue';
import type { PendingErrorLog } from '@/lib/errorQueue';
import { errorText, shouldReport } from '@/lib/errorReport';
import type { ErrorSource } from '@/lib/errorReport';

import { supabase } from './supabase';

const QUEUE_KEY = 'app_error_log_queue';
const MAX_PER_LAUNCH = 40;
const MAX_QUEUE = 40;
const DEDUPE_MS = 60_000;
/** Time allowed to persist a fatal crash before the default handler runs. */
const FATAL_FLUSH_MS = 1_500;

let installed = false;
let currentScreen = '';
let sent = 0;
let flushRunning = false;
/** Set when enqueue asks to flush while a flush is already uploading. */
let flushRequested = false;
/** Serializes AsyncStorage queue mutations only (not network uploads). */
let storageTail: Promise<void> = Promise.resolve();
const recent = new Map<string, number>();

/** Remembers the open screen so a crash row says where it happened. */
export function setErrorLogScreen(screen: string): void {
  currentScreen = screen.slice(0, 200);
}

/**
 * Saves an unexpected error to app_error_logs. Rows are written to disk first
 * so a sudden close can still upload them on the next launch.
 */
export function reportError(error: unknown, info: { source: ErrorSource; where?: string }): void {
  void reportErrorAsync(error, info);
}

/** Catches crashes outside React, such as a thrown event handler. */
export function installErrorLogging(): void {
  if (installed) return;
  installed = true;
  void flushPendingErrors();

  const utils = (
    globalThis as {
      ErrorUtils?: {
        getGlobalHandler: () => (error: unknown, isFatal?: boolean) => void;
        setGlobalHandler: (handler: (error: unknown, isFatal?: boolean) => void) => void;
      };
    }
  ).ErrorUtils;
  if (!utils) return;

  const previous = utils.getGlobalHandler();
  utils.setGlobalHandler((error, isFatal) => {
    const finish = (): void => {
      previous(error, isFatal);
    };

    if (!isFatal) {
      reportError(error, { source: 'js', where: 'js' });
      finish();
      return;
    }

    // Prefer a durable disk write; network may still finish within the window.
    const saved = reportErrorAsync(error, { source: 'js', where: 'fatal' });
    const timeout = new Promise<void>((resolve) => {
      setTimeout(resolve, FATAL_FLUSH_MS);
    });
    void Promise.race([saved, timeout]).finally(finish);
  });
}

function withStorageLock(fn: () => Promise<void>): Promise<void> {
  const run = storageTail.then(fn, fn);
  storageTail = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function reportErrorAsync(
  error: unknown,
  info: { source: ErrorSource; where?: string }
): Promise<void> {
  if (!shouldReport(error) || sent >= MAX_PER_LAUNCH) return;
  const text = errorText(error);
  const key = `${info.source}:${text.message}`;
  const now = Date.now();
  if (now - (recent.get(key) ?? 0) < DEDUPE_MS) return;
  recent.set(key, now);
  sent += 1;

  const row: PendingErrorLog = {
    id: `${now}-${Math.random().toString(36).slice(2, 10)}`,
    message: text.message,
    stack: text.stack,
    source: info.source,
    screen: (info.where ? `${info.where} ${currentScreen}` : currentScreen).trim().slice(0, 200),
    app_version: Constants.expoConfig?.version ?? null,
  };

  try {
    // Disk write is short and must not wait on network uploads.
    await withStorageLock(async () => {
      const raw = await AsyncStorage.getItem(QUEUE_KEY);
      const next = appendErrorQueue(parseErrorQueue(raw), row, MAX_QUEUE);
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(next));
    });
  } catch {
    // Disk failure must not become another crash.
  }

  await flushPendingErrors();
}

async function flushPendingErrors(): Promise<void> {
  if (flushRunning) {
    flushRequested = true;
    return;
  }
  flushRunning = true;
  try {
    do {
      flushRequested = false;
      for (;;) {
        let queue: PendingErrorLog[] = [];
        await withStorageLock(async () => {
          queue = parseErrorQueue(await AsyncStorage.getItem(QUEUE_KEY));
        });
        if (queue.length === 0) break;

        const uploadedIds: string[] = [];
        for (const row of queue) {
          if (await upload(row)) uploadedIds.push(row.id);
        }
        if (uploadedIds.length === 0) break;

        await withStorageLock(async () => {
          const current = parseErrorQueue(await AsyncStorage.getItem(QUEUE_KEY));
          const remaining = removeErrorQueueIds(current, uploadedIds);
          if (remaining.length === 0) {
            await AsyncStorage.removeItem(QUEUE_KEY);
          } else {
            await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
          }
        });
      }
    } while (flushRequested);
  } catch {
    // A failed log must not surface as another error.
  } finally {
    flushRunning = false;
  }
}

async function upload(row: PendingErrorLog): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id ?? null;
    const { error } = await supabase.from('app_error_logs').insert({
      user_id: userId,
      message: row.message,
      stack: row.stack,
      source: row.source,
      screen: row.screen,
      app_version: row.app_version,
    });
    return error == null;
  } catch {
    return false;
  }
}

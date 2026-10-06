import Constants from 'expo-constants';

import { errorText, shouldReport } from '@/lib/errorReport';
import type { ErrorSource } from '@/lib/errorReport';

import { supabase } from './supabase';

const MAX_PER_LAUNCH = 40;
const DEDUPE_MS = 60_000;

let installed = false;
let currentScreen = '';
let sent = 0;
const recent = new Map<string, number>();

/** Remembers the open screen so a crash row says where it happened. */
export function setErrorLogScreen(screen: string): void {
  currentScreen = screen.slice(0, 200);
}

/**
 * Saves an unexpected error to app_error_logs. Failures here are ignored so
 * logging never becomes a second crash.
 */
export function reportError(error: unknown, info: { source: ErrorSource; where?: string }): void {
  if (!shouldReport(error) || sent >= MAX_PER_LAUNCH) return;
  const text = errorText(error);
  const key = `${info.source}:${text.message}`;
  const now = Date.now();
  if (now - (recent.get(key) ?? 0) < DEDUPE_MS) return;
  recent.set(key, now);
  sent += 1;
  void persist(text, info);
}

/** Catches crashes outside React, such as a thrown event handler. */
export function installErrorLogging(): void {
  if (installed) return;
  installed = true;
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
    reportError(error, { source: 'js', where: isFatal ? 'fatal' : 'js' });
    previous(error, isFatal);
  });
}

async function persist(
  text: { message: string; stack: string | null },
  info: { source: ErrorSource; where?: string }
): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id ?? null;
    const screen = (info.where ? `${info.where} ${currentScreen}` : currentScreen).trim().slice(0, 200);
    await supabase.from('app_error_logs').insert({
      user_id: userId,
      message: text.message,
      stack: text.stack,
      source: info.source,
      screen,
      app_version: Constants.expoConfig?.version ?? null,
    });
  } catch {
    // A failed log must not surface as another error.
  }
}

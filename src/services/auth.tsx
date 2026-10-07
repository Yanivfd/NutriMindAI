import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { useGroceryStore } from '@/store/useGroceryStore';

import { supabase } from './supabase';

type AuthState =
  | { status: 'loading'; session: null }
  | { status: 'signedOut'; session: null }
  | { status: 'signedIn'; session: Session };

const AuthContext = createContext<AuthState>({ status: 'loading', session: null });

function toState(session: Session | null): AuthState {
  return session ? { status: 'signedIn', session } : { status: 'signedOut', session: null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', session: null });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setState(toState(data.session)));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(toState(session));
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

/** User id of the signed-in user; throws if used outside a signed-in area. */
export function useUserId(): string {
  const auth = useAuth();
  if (auth.status !== 'signedIn') throw new Error('useUserId requires a signed-in user');
  return auth.session.user.id;
}

/** SMS or WhatsApp. Both deliver the same 6-digit phone code. */
export type PhoneChannel = 'sms' | 'whatsapp';

/** Sends a 6-digit email code. Creates the account on first use. */
export async function sendEmailCode(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw error;
}

export async function verifyEmailCode(email: string, token: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw error;
}

/** Sends a 6-digit code by SMS or WhatsApp. Creates the account on first use. */
export async function sendPhoneCode(phone: string, channel: PhoneChannel): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: { shouldCreateUser: true, channel },
  });
  if (error) throw error;
}

/** Checks the code from either SMS or WhatsApp. */
export async function verifyPhoneCode(phone: string, token: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Permanently deletes the signed-in auth user and cascaded app data, then signs out
 * and clears grocery check state stored on device.
 */
export async function deleteAccount(): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>(
    'delete-account',
    { body: {} }
  );
  if (error || !data?.ok) throw error ?? new Error(data?.error ?? 'DELETE_FAILED');
  useGroceryStore.getState().resetAll();
  // Prefer a full sign-out; fall back to clearing local session if the auth user is already gone.
  const { error: signOutError } = await supabase.auth.signOut();
  if (signOutError) {
    await supabase.auth.signOut({ scope: 'local' });
  }
}

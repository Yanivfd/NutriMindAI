import '../../global.css';

import { Rubik_400Regular } from '@expo-google-fonts/rubik/400Regular';
import { Rubik_500Medium } from '@expo-google-fonts/rubik/500Medium';
import { Rubik_600SemiBold } from '@expo-google-fonts/rubik/600SemiBold';
import { Rubik_700Bold } from '@expo-google-fonts/rubik/700Bold';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { MutationCache, QueryCache, QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import Constants from 'expo-constants';
import { useFonts } from 'expo-font';
import { Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { View } from 'react-native';

import { Button, CenteredMessage, Loading } from '@/components/ui';
import { syncDirectionOnStartup, useLayoutDirection, useT } from '@/lib/i18n';
import { COLORS, FONTS } from '@/lib/theme';
import { initAds } from '@/services/ads';
import { installErrorLogging, reportError, setErrorLogScreen } from '@/services/errorLog';
import { AuthProvider, useAuth } from '@/services/auth';
import { profileQueryOptions } from '@/services/menuApi';
import { ReminderNavigation, ReminderSync } from '@/services/reminders';
import { usePreferencesStore } from '@/store/usePreferencesStore';

const DAY_MS = 24 * 60 * 60 * 1000;

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      reportError(error, { source: 'query', where: String(query.queryKey[0]) });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      const key = mutation.options.mutationKey?.[0];
      reportError(error, { source: 'mutation', where: typeof key === 'string' ? key : 'mutation' });
    },
  }),
  defaultOptions: {
    queries: { staleTime: DAY_MS, gcTime: DAY_MS, retry: 1 },
  },
});

const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'query-cache' });

SplashScreen.preventAutoHideAsync().catch(() => undefined);

/** Waits for saved preferences and applies the text direction before the first screen. */
function usePreferencesReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const finish = () => {
      syncDirectionOnStartup();
      setReady(true);
    };
    if (usePreferencesStore.persist.hasHydrated()) {
      finish();
      return undefined;
    }
    return usePreferencesStore.persist.onFinishHydration(finish);
  }, []);
  return ready;
}

/** Keeps the crash log pointed at the screen the tester is on. */
function ErrorLogScreen() {
  const pathname = usePathname();
  useEffect(() => {
    setErrorLogScreen(pathname);
  }, [pathname]);
  return null;
}

/** Drops cached server data when the user signs out, so the next user never sees it. */
function ClearCacheOnSignOut() {
  const auth = useAuth();
  const client = useQueryClient();
  useEffect(() => {
    if (auth.status === 'signedOut') client.clear();
  }, [auth.status, client]);
  return null;
}

/** Signed out -> welcome then login; signed in without a profile -> onboarding; otherwise the app. */
function RootNavigator() {
  const t = useT();
  const direction = useLayoutDirection();
  const auth = useAuth();
  const hasSeenWelcome = usePreferencesStore((s) => s.hasSeenWelcome);
  const userId = auth.status === 'signedIn' ? auth.session.user.id : null;
  const profile = useQuery({ ...profileQueryOptions(userId ?? ''), enabled: userId !== null });

  if (auth.status === 'loading' || (userId !== null && profile.isPending)) return <Loading />;
  if (userId !== null && profile.isError && profile.data === undefined) {
    return (
      <CenteredMessage
        message={t('errors.NETWORK')}
        action={<Button label={t('common.retry')} onPress={() => profile.refetch()} />}
      />
    );
  }

  const signedIn = userId !== null;
  const hasProfile = Boolean(profile.data);

  return (
    <>
      {signedIn && hasProfile ? <ReminderSync /> : null}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.background, direction },
          headerStyle: { backgroundColor: COLORS.background },
          headerShadowVisible: false,
          headerTintColor: COLORS.brandDark,
          headerTitleStyle: { fontFamily: FONTS.semibold, color: COLORS.text },
        }}
      >
        <Stack.Protected guard={!signedIn && !hasSeenWelcome}>
          <Stack.Screen name="welcome" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn && hasSeenWelcome}>
          <Stack.Screen name="login" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && !hasProfile}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && hasProfile}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="recipe/[id]" options={{ headerShown: true, title: '' }} />
          <Stack.Screen name="settings" options={{ headerShown: true, title: t('profile.settings') }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export { ErrorBoundary } from '@/components/AppErrorScreen';

export default function RootLayout() {
  const preferencesReady = usePreferencesReady();
  const direction = useLayoutDirection();
  // A font that fails to load falls back to the system font rather than blocking the app.
  const [fontsLoaded, fontError] = useFonts({
    Rubik_400Regular,
    Rubik_500Medium,
    Rubik_600SemiBold,
    Rubik_700Bold,
  });
  const ready = preferencesReady && (fontsLoaded || fontError !== null);

  useEffect(() => {
    initAds();
    installErrorLogging();
  }, []);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null;

  return (
    <View style={{ flex: 1, direction }}>
      <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: DAY_MS,
        buster: Constants.expoConfig?.version ?? '1',
      }}
    >
      <AuthProvider>
        <ErrorLogScreen />
        <ClearCacheOnSignOut />
        <ReminderNavigation />
        <StatusBar style="dark" />
        <RootNavigator />
      </AuthProvider>
      </PersistQueryClientProvider>
    </View>
  );
}

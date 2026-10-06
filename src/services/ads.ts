import Constants, { ExecutionEnvironment } from 'expo-constants';

type AdsModule = typeof import('react-native-google-mobile-ads');

const INTERSTITIAL_TIMEOUT_MS = 8000;

// Health app: never request personalized ads.
export const AD_REQUEST_OPTIONS = { requestNonPersonalizedAdsOnly: true } as const;

/** Expo Go has no AdMob native module, so ads are a no-op there. */
function loadAdsModule(): AdsModule | null {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return null;
  try {
    // A static import would crash Expo Go at startup; load only when the module exists.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-google-mobile-ads') as AdsModule;
  } catch {
    return null;
  }
}

export const adsModule = loadAdsModule();

/** Google test units in development; env-configured units in release builds. */
export function adUnitId(kind: 'banner' | 'interstitial'): string | null {
  if (!adsModule) return null;
  if (__DEV__) {
    return kind === 'banner' ? adsModule.TestIds.ADAPTIVE_BANNER : adsModule.TestIds.INTERSTITIAL;
  }
  const id =
    kind === 'banner'
      ? process.env.EXPO_PUBLIC_ADMOB_BANNER_ID
      : process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID;
  return id || null;
}

export function initAds(): void {
  adsModule
    ?.default()
    .initialize()
    .catch(() => undefined);
}

/** Loads and shows an interstitial; always resolves (closed, failed, or timed out). */
export function showInterstitial(): Promise<void> {
  const unitId = adUnitId('interstitial');
  if (!adsModule || !unitId) return Promise.resolve();
  const { InterstitialAd, AdEventType } = adsModule;

  return new Promise((resolve) => {
    const ad = InterstitialAd.createForAdRequest(unitId, AD_REQUEST_OPTIONS);
    const unsubscribers: (() => void)[] = [];
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      resolve();
    };
    const timer = setTimeout(finish, INTERSTITIAL_TIMEOUT_MS);

    unsubscribers.push(
      ad.addAdEventListener(AdEventType.LOADED, () => {
        clearTimeout(timer);
        ad.show().catch(finish);
      }),
      ad.addAdEventListener(AdEventType.CLOSED, finish),
      ad.addAdEventListener(AdEventType.ERROR, finish)
    );
    ad.load();
  });
}

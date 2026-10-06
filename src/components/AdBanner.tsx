import { View } from 'react-native';

import { AD_REQUEST_OPTIONS, adsModule, adUnitId } from '@/services/ads';

export function AdBanner() {
  const unitId = adUnitId('banner');
  if (!adsModule || !unitId) return null;
  const { BannerAd, BannerAdSize } = adsModule;

  return (
    <View className="items-center">
      <BannerAd
        unitId={unitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={AD_REQUEST_OPTIONS}
      />
    </View>
  );
}

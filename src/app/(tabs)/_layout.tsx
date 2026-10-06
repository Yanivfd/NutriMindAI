import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import type { IconName } from '@/components/ui';
import { useLayoutDirection, useT } from '@/lib/i18n';
import { COLORS, FONTS } from '@/lib/theme';

function tabIcon(active: IconName, inactive: IconName) {
  return function TabIcon(props: { color: ColorValue; size: number; focused: boolean }) {
    return (
      <MaterialCommunityIcons
        name={props.focused ? active : inactive}
        color={props.color}
        size={props.size}
      />
    );
  };
}

export default function TabsLayout() {
  const t = useT();
  const direction = useLayoutDirection();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.brandDark,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarLabelStyle: { fontFamily: FONTS.medium, fontSize: 12 },
        tabBarStyle: { borderTopColor: COLORS.border, backgroundColor: '#ffffff', direction },
        headerTitleAlign: 'center',
        headerStyle: { backgroundColor: COLORS.background },
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: FONTS.semibold, color: COLORS.text },
        sceneStyle: { backgroundColor: COLORS.background, direction },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.dashboard'),
          headerShown: false,
          tabBarIcon: tabIcon('home', 'home-outline'),
        }}
      />
      <Tabs.Screen
        name="grocery"
        options={{ title: t('tabs.grocery'), tabBarIcon: tabIcon('cart', 'cart-outline') }}
      />
      <Tabs.Screen
        name="bank"
        options={{ title: t('tabs.bank'), tabBarIcon: tabIcon('cupcake', 'cupcake') }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: tabIcon('account-circle', 'account-circle-outline'),
        }}
      />
    </Tabs>
  );
}

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLayoutDirection } from '@/lib/i18n';
import { COLORS, FONTS } from '@/lib/theme';

import { Text } from './Text';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Full-screen container padded for the status bar and system navigation. */
export function SafeScreen({ children, className = '' }: { children: ReactNode; className?: string }) {
  const insets = useSafeAreaInsets();
  const direction = useLayoutDirection();
  return (
    <View
      className={`flex-1 bg-surface ${className}`}
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom, direction }}
    >
      {children}
    </View>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'danger';

const BUTTON_STYLES: Record<ButtonVariant, { box: string; text: string; spinner: string }> = {
  primary: { box: 'bg-brand-600', text: 'text-white', spinner: '#ffffff' },
  secondary: { box: 'bg-white border border-brand-200', text: 'text-brand-700', spinner: COLORS.brandDark },
  danger: { box: 'bg-white border border-red-200', text: 'text-meat', spinner: COLORS.meat },
};

export function Button(props: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
}) {
  const style = BUTTON_STYLES[props.variant ?? 'primary'];
  const inactive = props.disabled || props.loading;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      disabled={inactive}
      className={`min-h-12 flex-row items-center justify-center gap-2 rounded-2xl px-5 py-3 active:opacity-80 ${style.box} ${inactive ? 'opacity-60' : ''}`}
    >
      {props.loading ? (
        <ActivityIndicator color={style.spinner} />
      ) : (
        props.icon && <MaterialCommunityIcons name={props.icon} size={20} color={style.spinner} />
      )}
      <Text className={`text-base font-semibold ${style.text}`}>{props.label}</Text>
    </Pressable>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <View className={`rounded-3xl border border-gray-100 bg-white p-4 shadow-sm ${className}`}>
      {children}
    </View>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text className="mb-2 text-lg font-bold text-gray-900">{children}</Text>;
}

export function Field(
  props: TextInputProps & { label: string; error?: boolean; hint?: string }
) {
  const { label, error, hint, style, ...inputProps } = props;
  return (
    <View className="gap-1">
      <Text className={`text-sm font-medium ${error ? 'text-meat' : 'text-gray-700'}`}>{label}</Text>
      <TextInput
        placeholderTextColor="#9ca3af"
        className={`rounded-2xl border bg-white px-4 py-3 text-base text-gray-900 ${error ? 'border-meat' : 'border-gray-200'}`}
        style={[{ fontFamily: FONTS.regular }, style]}
        {...inputProps}
      />
      {hint ? <Text className="text-xs text-gray-500">{hint}</Text> : null}
    </View>
  );
}

/** Tappable box that looks like a Field; used to open native pickers. */
export function PickerField(props: {
  label: string;
  value: string;
  placeholder?: string;
  icon: IconName;
  onPress: () => void;
  error?: boolean;
  hint?: string;
}) {
  return (
    <View className="gap-1">
      <Text className={`text-sm font-medium ${props.error ? 'text-meat' : 'text-gray-700'}`}>
        {props.label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={props.label}
        onPress={props.onPress}
        className={`flex-row items-center justify-between rounded-2xl border bg-white px-4 py-3 active:opacity-80 ${props.error ? 'border-meat' : 'border-gray-200'}`}
      >
        <Text className={`text-base ${props.value ? 'text-gray-900' : 'text-gray-400'}`}>
          {props.value || props.placeholder}
        </Text>
        <MaterialCommunityIcons name={props.icon} size={20} color={COLORS.brandDark} />
      </Pressable>
      {props.hint ? <Text className="text-xs text-gray-500">{props.hint}</Text> : null}
    </View>
  );
}

export function Chip(props: { label: string; selected: boolean; onPress: () => void; icon?: IconName }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: props.selected }}
      onPress={props.onPress}
      className={`flex-row items-center gap-1 rounded-full border px-4 py-2 ${props.selected ? 'border-brand-600 bg-brand-600' : 'border-gray-200 bg-white'}`}
    >
      {props.icon ? (
        <MaterialCommunityIcons
          name={props.icon}
          size={16}
          color={props.selected ? '#ffffff' : '#374151'}
        />
      ) : null}
      <Text className={`font-medium ${props.selected ? 'text-white' : 'text-gray-700'}`}>
        {props.label}
      </Text>
    </Pressable>
  );
}

/** Icon in a soft green circle with a title, message and optional action. */
export function EmptyState(props: {
  icon: IconName;
  title?: string;
  message: string;
  action?: ReactNode;
  tone?: 'brand' | 'error';
}) {
  const error = props.tone === 'error';
  return (
    <View className="flex-grow items-center justify-center gap-3 p-6">
      <View
        className={`h-20 w-20 items-center justify-center rounded-full ${error ? 'bg-red-50' : 'bg-brand-100'}`}
      >
        <MaterialCommunityIcons
          name={props.icon}
          size={40}
          color={error ? COLORS.meat : COLORS.brandDark}
        />
      </View>
      {props.title ? (
        <Text className="text-center text-lg font-bold text-gray-900">{props.title}</Text>
      ) : null}
      <Text className="text-center text-base text-gray-600">{props.message}</Text>
      {props.action}
    </View>
  );
}

export function CenteredMessage(props: { message: string; action?: ReactNode }) {
  return <EmptyState icon="wifi-off" tone="error" message={props.message} action={props.action} />;
}

export function Loading({ message }: { message?: string }) {
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-surface">
      <ActivityIndicator size="large" color={COLORS.brand} />
      {message ? <Text className="text-center text-sm text-gray-600">{message}</Text> : null}
    </View>
  );
}

import { Text as NativeText } from 'react-native';
import type { TextProps } from 'react-native';

import { FONTS } from '@/lib/theme';

const WEIGHT_CLASS = /\bfont-(bold|semibold|medium)\b/;

/** Maps a Tailwind weight class to the matching Rubik file (Android ignores fontWeight for custom fonts). */
export function fontFamilyFor(className: string | undefined): string {
  const weight = className?.match(WEIGHT_CLASS)?.[1];
  switch (weight) {
    case 'bold':
      return FONTS.bold;
    case 'semibold':
      return FONTS.semibold;
    case 'medium':
      return FONTS.medium;
    default:
      return FONTS.regular;
  }
}

/** Drop-in replacement for React Native's Text that renders in Rubik. */
export function Text({ className, style, ...props }: TextProps & { className?: string }) {
  // fontWeight is reset so Android does not add synthetic bold on top of the bold file.
  return (
    <NativeText
      className={className}
      style={[{ fontFamily: fontFamilyFor(className), fontWeight: 'normal' }, style]}
      {...props}
    />
  );
}

/**
 * Colours and font families for places that take plain style values (navigation options,
 * SVG, ActivityIndicator). Keep in sync with tailwind.config.js.
 */
export const COLORS = {
  brand: '#16a34a',
  brandDark: '#15803d',
  brandSoft: '#dcfce7',
  ring: '#e7f5ec',
  background: '#f4faf6',
  text: '#1f2937',
  muted: '#6b7280',
  border: '#e5e7eb',
  meat: '#dc2626',
  dairy: '#2563eb',
  parve: '#16a34a',
  mixed: '#7c3aed',
} as const;

export const FONTS = {
  regular: 'Rubik_400Regular',
  medium: 'Rubik_500Medium',
  semibold: 'Rubik_600SemiBold',
  bold: 'Rubik_700Bold',
} as const;

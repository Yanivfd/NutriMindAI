/** @type {import('tailwindcss').Config} */
// Keep colours in sync with src/lib/theme.ts.
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          500: '#16a34a',
          600: '#15803d',
          700: '#166534',
        },
        surface: '#f4faf6',
        meat: '#dc2626',
        dairy: '#2563eb',
        parve: '#16a34a',
        mixed: '#7c3aed',
      },
    },
  },
  plugins: [],
};

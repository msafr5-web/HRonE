import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['var(--font-plex)', 'Tahoma', 'system-ui', 'sans-serif'] },
      colors: {
        // Brand: deep Saudi green + warm sand + muted gold. CSS variables flip in dark mode.
        brand: {
          50: 'rgb(var(--brand-50) / <alpha-value>)',
          100: 'rgb(var(--brand-100) / <alpha-value>)',
          500: 'rgb(var(--brand-500) / <alpha-value>)',
          600: 'rgb(var(--brand-600) / <alpha-value>)',
          700: 'rgb(var(--brand-700) / <alpha-value>)',
          900: 'rgb(var(--brand-900) / <alpha-value>)',
        },
        gold: { 400: '#f59e0b', 500: '#d97706', 600: '#b45309' },
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        mute: 'rgb(var(--mute) / <alpha-value>)',
      },
      boxShadow: { card: '0 1px 2px rgb(0 0 0 / 0.04), 0 4px 16px rgb(var(--shadow) / 0.06)' },
      keyframes: {
        rise: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
        pop: { '0%': { transform: 'scale(1)' }, '40%': { transform: 'scale(1.25)' }, '100%': { transform: 'scale(1)' } },
      },
      animation: { rise: 'rise .35s ease-out both', pop: 'pop .3s ease-out' },
    },
  },
  plugins: [],
} satisfies Config;

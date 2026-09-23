/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './components/**/*.{vue,js,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './app.vue',
    './composables/**/*.{js,ts}',
    './plugins/**/*.{js,ts}',
  ],
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(var(--canvas) / <alpha-value>)',
        paper: 'rgb(var(--paper) / <alpha-value>)',
        sunken: 'rgb(var(--sunken) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        'ink-2': 'rgb(var(--ink-2) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        faint: 'rgb(var(--faint) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        navy: 'rgb(var(--navy) / <alpha-value>)',
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          press: 'rgb(var(--accent-press) / <alpha-value>)',
          soft: 'rgb(var(--accent-soft) / <alpha-value>)',
        },
        'on-accent': 'rgb(var(--on-accent) / <alpha-value>)',
        'on-error': 'rgb(var(--on-error) / <alpha-value>)',
        error: {
          DEFAULT: 'rgb(var(--error) / <alpha-value>)',
          soft: 'rgb(var(--error-soft) / <alpha-value>)',
        },
        fresh: {
          DEFAULT: 'rgb(var(--fresh) / <alpha-value>)',
          soft: 'rgb(var(--fresh-soft) / <alpha-value>)',
        },
        warm: {
          DEFAULT: 'rgb(var(--warm) / <alpha-value>)',
          soft: 'rgb(var(--warm-soft) / <alpha-value>)',
        },
        due: {
          DEFAULT: 'rgb(var(--due) / <alpha-value>)',
          soft: 'rgb(var(--due-soft) / <alpha-value>)',
        },
        graduated: {
          DEFAULT: 'rgb(var(--graduated) / <alpha-value>)',
        },
        bubble: 'rgb(var(--bubble) / <alpha-value>)',
        'bubble-ink': 'rgb(var(--bubble-ink) / <alpha-value>)',
      },
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        'label-caps': ['12px', { lineHeight: '16px', letterSpacing: '0.05em', fontWeight: '600' }],
        action: ['16px', { lineHeight: '20px', fontWeight: '600' }],
        'body-sm': ['14px', { lineHeight: '20px' }],
        'body-lg': ['16px', { lineHeight: '24px' }],
        'headline-md': ['20px', { lineHeight: '28px', fontWeight: '600' }],
        'headline-lg': ['30px', { lineHeight: '38px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-xl': ['48px', { lineHeight: '56px', letterSpacing: '-0.02em', fontWeight: '700' }],
      },
      letterSpacing: {
        eyebrow: '0.12em',
      },
    },
  },
  plugins: [],
}
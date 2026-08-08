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
        coral: {
          DEFAULT: 'rgb(var(--coral) / <alpha-value>)',
          press: 'rgb(var(--coral-press) / <alpha-value>)',
          soft: 'rgb(var(--coral-soft) / <alpha-value>)',
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
        display: ['"Bricolage Grotesque"', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        eyebrow: '0.12em',
      },
    },
  },
  plugins: [],
}
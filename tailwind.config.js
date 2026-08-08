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
        canvas: '#0D1520',
        paper: '#F7F6F2',
        surface: '#FFFFFF',
        ink: '#17191F',
        muted: '#71747D',
        line: '#E7E5DF',
        navy: '#12243F',
        coral: {
          DEFAULT: '#E8503A',
          hover: '#D4432F',
          soft: '#FBE5E0',
        },
        fresh: '#0F9D8F',
        warm: '#E8A13A',
        due: '#E8503A',
        graduated: '#0B6E64',
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
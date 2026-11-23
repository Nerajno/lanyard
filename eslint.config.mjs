import withNuxt from '.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    ignores: ['**/.remember/**', '**/.claude/**', '**/.opencode/**', '**/node_modules/**'],
  },
  {
    rules: {
      'vue/multi-word-component-names': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
)
import { defineConfig } from 'vitest/config'
import { defineVitestProject } from '@nuxt/test-utils/config'
import { fileURLToPath } from 'node:url'
import { defineVitestProject } from '@nuxt/test-utils/config'

// The Nuxt environment bakes runtimeConfig from NUXT_* vars while the config
// loads, before per-project `env` is applied to the worker. Seed dummies here
// so getSupabaseClient() initializes cleanly under test (CI overrides with the
// real local-stack values).
process.env.NUXT_PUBLIC_SUPABASE_URL ??= 'http://127.0.0.1:54321'
process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY ??= 'dummy-anon-key-for-component-tests'
process.env.NUXT_PUBLIC_APP_URL ??= 'http://localhost:3000'

const root = fileURLToPath(new URL('./', import.meta.url))

export default defineConfig({
  test: {
    projects: [
      {
        resolve: {
          alias: {
            '~': root,
            '@': root,
            '~': fileURLToPath(new URL('./', import.meta.url)),
            '@': fileURLToPath(new URL('./', import.meta.url)),
          },
        },
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.{test,spec}.ts'],
          environment: 'node',
          environment: 'node',
          include: ['tests/unit/**/*.test.ts'],
        },
      },
      await defineVitestProject({
        test: {
          name: 'component',
          include: ['tests/component/**/*.{test,spec}.ts'],
          environment: 'nuxt',
          environmentOptions: {
            nuxt: {
              domEnvironment: 'happy-dom',
              dotenv: {
                fileName: '.env',
              },
            },
          environment: 'nuxt',
          include: ['tests/component/**/*.test.ts'],
          env: {
            NUXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
            NUXT_PUBLIC_SUPABASE_ANON_KEY: 'dummy-anon-key-for-component-tests',
            NUXT_PUBLIC_APP_URL: 'http://localhost:3000',
          },
        },
      }),
    ],
  },
})

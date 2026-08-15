import { defineConfig } from 'vitest/config'
import { defineVitestProject } from '@nuxt/test-utils/config'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('./', import.meta.url))

export default defineConfig({
  test: {
    projects: [
      {
        resolve: {
          alias: {
            '~': root,
            '@': root,
          },
        },
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.{test,spec}.ts'],
          environment: 'node',
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
          },
        },
      }),
    ],
  },
})
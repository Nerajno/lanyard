import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'
import type { ConfigOptions } from '@nuxt/test-utils/playwright'

// The Nuxt app bakes NUXT_PUBLIC_* into runtimeConfig at build time, which the
// e2e worker runs before spawning browsers. Seed from the local Supabase stack;
// CI overrides with `supabase status -o env` values before this loads.
process.env.NUXT_PUBLIC_SUPABASE_URL ??= 'http://127.0.0.1:54321'
process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY ??= 'dummy-anon-key-for-e2e'
process.env.NUXT_PUBLIC_APP_URL ??= 'http://localhost:3000'

export default defineConfig<ConfigOptions>({
  testDir: './tests/e2e',
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  // The _nuxtHooks fixture boots the Nuxt server once per worker. A cold CI
  // production build takes longer than Playwright's 30s default, so give both
  // the boot and each test generous headroom.
  timeout: 180_000,
  use: {
    trace: 'on-first-retry',
    nuxt: {
      rootDir: fileURLToPath(new URL('.', import.meta.url)),
    },
    baseURL: process.env.E2E_BASE_URL || undefined,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? {
        command: 'npx nuxi dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 180000,
      }
    : undefined,
})
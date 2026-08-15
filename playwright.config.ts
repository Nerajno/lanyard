import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

// The built server reads public Supabase config from env at runtime. Load the
// local .env so tests boot locally; CI injects the same vars as real env.
if (existsSync(fileURLToPath(new URL('.env', import.meta.url)))) {
  process.loadEnvFile(fileURLToPath(new URL('.env', import.meta.url)))
}

const port = Number(process.env.E2E_PORT || 3000)
const baseURL = `http://localhost:${port}`

// Target-host e2e: the built app runs as Playwright's webServer and tests hit it
// over HTTP. This avoids @nuxt/test-utils' in-worker fixture (loadKit imports
// @nuxt/kit, which collides with Playwright's CJS require hook on Node 22+ →
// "Unexpected module status 3", nodejs/node#56838).
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'node .output/server/index.mjs',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      PORT: String(port),
    },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
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
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
})
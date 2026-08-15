import { test, expect } from '@nuxt/test-utils/playwright'
import { E2E_USER } from './helpers'

test('sends a magic link and shows the inbox notice', async ({ page, goto }) => {
  await goto('/login', { waitUntil: 'hydration' })
  await page.getByRole('button', { name: 'Magic link', exact: true }).click()
  await page.locator('#email').fill(E2E_USER.email)
  await page.getByRole('button', { name: 'Send magic link' }).click()
  await expect(page.getByText('Check your inbox for the sign-in link.')).toBeVisible()
})
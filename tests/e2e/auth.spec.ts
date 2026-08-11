import { test, expect } from '@nuxt/test-utils/playwright'

const EMAIL = 'e2e@lanyard.test'
const PASSWORD = 'e2epass123'

test('signs in with the seeded user and lands in the app', async ({ page, goto }) => {
  await goto('/login', { waitUntil: 'hydration' })
  await page.locator('#email').fill(EMAIL)
  await page.locator('#password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page).toHaveURL(/\/app(\/|$)/)
  await expect(page.getByText('Contacts')).toBeVisible()
})

test('flips to the signup prompt on the wrong password', async ({ page, goto }) => {
  await goto('/login', { waitUntil: 'hydration' })
  await page.locator('#email').fill(EMAIL)
  await page.locator('#password').fill('wrong-pass-1')
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByText("No account with that password — we'll create one.")).toBeVisible()
})

test('signs out and is redirected to the landing page', async ({ page, goto }) => {
  await goto('/login', { waitUntil: 'hydration' })
  await page.locator('#email').fill(EMAIL)
  await page.locator('#password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page).toHaveURL(/\/app(\/|$)/)
  await page.getByRole('link', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL('/')
})

test('sends a magic link and shows the inbox notice', async ({ page, goto }) => {
  await goto('/login', { waitUntil: 'hydration' })
  await page.getByRole('button', { name: 'Magic link' }).click()
  await page.locator('#email').fill(EMAIL)
  await page.getByRole('button', { name: 'Send magic link' }).click()
  await expect(page.getByText('Check your inbox for the sign-in link.')).toBeVisible()
})
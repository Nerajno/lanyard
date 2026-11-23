import { test, expect } from '@nuxt/test-utils/playwright'
import { loginAs } from './helpers'

test('signs in with the seeded user and lands in the app', async ({ page, goto }) => {
  await loginAs(page, goto)
  await expect(page).toHaveURL(/\/app(\/|$)/)
  await expect(page.getByRole('heading', { level: 1, name: 'Queue' })).toBeVisible({ timeout: 10000 })
})

test('flips to the signup prompt on the wrong password', async ({ page, goto }) => {
  await loginAs(page, goto, { password: 'wrong-pass-1' })
  await expect(page.getByText("No account with that password — we'll create one.")).toBeVisible()
})

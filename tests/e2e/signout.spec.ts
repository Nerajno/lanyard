import { test, expect } from '@nuxt/test-utils/playwright'
import { loginAs } from './helpers'

test('signs out and is redirected to the landing page', async ({ page, goto }) => {
  await loginAs(page, goto)
  await expect(page).toHaveURL(/\/app(\/|$)/)
  await page.getByRole('link', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL('/')
})
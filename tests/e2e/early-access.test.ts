import { expect, test } from '@playwright/test'

test('exposes the early-access email form', async ({ page }) => {
  await page.goto('/early-access')
  await expect(page.getByPlaceholder('you@email.com')).toBeVisible()
})
import { expect, test } from '@playwright/test'

test('renders the hero heading', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Follow up before it goes cold.')
})
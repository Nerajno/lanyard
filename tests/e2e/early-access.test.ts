import { expect, test } from '@nuxt/test-utils/playwright'

test('exposes the early-access email form', async ({ page, goto }) => {
  await goto('/early-access', { waitUntil: 'hydration' })
  await expect(page.getByPlaceholder('you@email.com')).toBeVisible()
})
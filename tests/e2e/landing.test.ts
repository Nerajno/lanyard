import { expect, test } from '@nuxt/test-utils/playwright'

test('renders the hero heading', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Follow up before it goes cold.')
})

test('renders the anchored sections the nav links to', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  for (const id of ['how-it-works', 'features', 'get']) {
    await expect(page.locator(`#${id}`)).toBeAttached()
  }
})

test('renders the layout nav and footer', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await expect(page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'How it works' })).toBeAttached()
  await expect(page.getByRole('contentinfo').getByRole('link', { name: 'Privacy' })).toBeAttached()
})

test('mobile nav disclosure opens and closes', async ({ page, goto }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await goto('/', { waitUntil: 'hydration' })

  const toggle = page.locator('#mobile-nav-toggle')
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('#mobile-nav')).toBeVisible()
  await toggle.click()
  await expect(page.locator('#mobile-nav')).toBeHidden()
})

test('does not imply Lanyard sends on the user behalf', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await expect(page.getByText('Open draft in Messages')).toBeVisible()
  await expect(page.getByText('Send SMS Follow-up')).toHaveCount(0)
})

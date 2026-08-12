import { test, expect } from '@nuxt/test-utils/playwright'
import { loginAs } from './helpers'

test('blocks a contact with no email or phone', async ({ page, goto }) => {
  await loginAs(page, goto)
  await expect(page).toHaveURL(/\/app(\/|$)/)

  await page.getByRole('navigation').getByRole('link', { name: 'Add', exact: true }).click()
  await page.getByRole('link', { name: 'By hand' }).click()
  await expect(page).toHaveURL('/app/add/manual')

  await page.locator('#name').fill('No Channel')
  await page.locator('#how_met').fill('Somewhere')

  await expect(page.getByText('Add an email or a phone number.')).toBeVisible()
})
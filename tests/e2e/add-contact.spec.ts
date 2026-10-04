import { test, expect } from '@nuxt/test-utils/playwright'
import { loginAs } from './helpers'

test('adds a contact from the manual form and sees it in the list', async ({ page, goto }) => {
  await loginAs(page, goto)
  await expect(page).toHaveURL(/\/app(\/|$)/)

  await page.getByRole('navigation').getByRole('link', { name: 'Add', exact: true }).click()
  await expect(page).toHaveURL('/app/add')

  await page.locator('#name').fill('Ada Lovelace')
  await page.locator('#how_met').fill('CppCon hallway')
  await page.locator('#email').fill('ada@example.com')
  await page.getByRole('button', { name: 'Save contact' }).click()
  await expect(page).toHaveURL(/\/app(\/|$)/)

  await expect(page.getByText('Ada Lovelace')).toBeVisible()
  await expect(page.getByText('CppCon hallway')).toBeVisible()
})
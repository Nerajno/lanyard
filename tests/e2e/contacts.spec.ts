import { test, expect } from '@nuxt/test-utils/playwright'

test('adds a contact from the manual form and sees it in the list', async ({ page, goto }) => {
  await goto('/login', { waitUntil: 'hydration' })
  await page.locator('#email').fill('e2e@lanyard.test')
  await page.locator('#password').fill('e2epass123')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page).toHaveURL(/\/app(\/|$)/)

  await page.getByRole('link', { name: 'Add' }).click()
  await expect(page).toHaveURL('/app/add')

  await page.locator('#name').fill('Ada Lovelace')
  await page.locator('#how_met').fill('CppCon hallway')
  await page.locator('#email').fill('ada@example.com')
  await page.getByRole('button', { name: "Save contact" }).click()
  await expect(page).toHaveURL(/\/app(\/|$)/)

  await expect(page.getByText('Ada Lovelace')).toBeVisible()
  await expect(page.getByText('CppCon hallway')).toBeVisible()
})

test('blocks a contact with no email or phone', async ({ page, goto }) => {
  await goto('/login', { waitUntil: 'hydration' })
  await page.locator('#email').fill('e2e@lanyard.test')
  await page.locator('#password').fill('e2epass123')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page).toHaveURL(/\/app(\/|$)/)

  await page.getByRole('link', { name: 'Add' }).click()
  await page.locator('#name').fill('No Channel')
  await page.locator('#how_met').fill('Somewhere')
  await page.getByRole('button', { name: "Save contact" }).click()

  await expect(page.getByText('Add an email or phone number.')).toBeVisible()
})
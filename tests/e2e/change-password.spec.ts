import { test, expect } from '@nuxt/test-utils/playwright'
import { loginAs } from './helpers'

test('changes the password and signs in with the new one', async ({ page, goto }) => {
  await loginAs(page, goto, { email: 'pw@lanyard.test', password: 'pwpass123' })

  await page.getByRole('link', { name: 'Settings' }).click()
  await expect(page).toHaveURL(/\/app\/settings/)

  await page.locator('#current-password').fill('pwpass123')
  await page.locator('#new-password').fill('pwnew456')
  await page.locator('#confirm-password').fill('pwnew456')
  await page.getByRole('button', { name: 'Update password' }).click()
  await expect(page.getByText('Password updated.')).toBeVisible()

  // Sign out, then sign back in with the new password.
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL('/')

  await page.getByRole('link', { name: 'Log in' }).click()
  await page.locator('#email').fill('pw@lanyard.test')
  await page.locator('#password').fill('pwnew456')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page).toHaveURL(/\/app(\/|$)/)
})
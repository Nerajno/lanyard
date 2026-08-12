import type { Page, Response } from 'playwright-core'

type Goto = (url: string, options?: { waitUntil?: 'load' | 'route' | 'hydration' | 'domcontentloaded' | 'networkidle' | 'commit' }) => Promise<Response | null>

export const E2E_USER = {
  email: 'e2e@lanyard.test',
  password: 'e2epass123',
} as const

export async function loginAs(
  page: Page,
  goto: Goto,
  { email = E2E_USER.email, password = E2E_USER.password }: { email?: string; password?: string } = {},
): Promise<void> {
  await goto('/login', { waitUntil: 'hydration' })
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
}
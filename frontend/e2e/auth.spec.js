import { test, expect } from '@playwright/test';

test.describe('authentication', () => {
  test('a seeded customer can sign in and reach the account dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email address').fill('customer@pothik.test');
    await page.getByLabel('Password').fill('PothikDemo123');
    await page.getByRole('button', { name: /^sign in$/i }).click();

    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Welcome back, Ayesha');
  });

  test('invalid credentials show an error instead of redirecting', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email address').fill('customer@pothik.test');
    await page.getByLabel('Password').fill('wrong-password-123');
    await page.getByRole('button', { name: /^sign in$/i }).click();

    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('protected account routes redirect anonymous visitors to login', async ({ page }) => {
    await page.goto('/account');
    await expect(page).toHaveURL(/\/login$/);
  });
});

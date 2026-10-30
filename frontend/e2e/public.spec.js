import { test, expect } from '@playwright/test';

test.describe('public site', () => {
  test('home page renders the brand and primary navigation', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/POTHIK/i);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const nav = page.getByRole('navigation').first();
    await expect(nav.getByRole('link', { name: /destinations/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /hotels/i })).toBeVisible();
  });

  test('destinations page lists seeded destinations', async ({ page }) => {
    await page.goto('/destinations');
    await expect(page.getByText("Cox's Bazar").first()).toBeVisible();
    await expect(page.getByText('Sajek Valley').first()).toBeVisible();
  });

  test('hotel listing shows the seeded hotel', async ({ page }) => {
    await page.goto('/hotels');
    await expect(page.getByText(/Sea Crown/i).first()).toBeVisible();
  });

  test('unknown route shows the not-found page', async ({ page }) => {
    await page.goto('/this-page-does-not-exist');
    await expect(page.getByText(/not found|404/i).first()).toBeVisible();
  });
});

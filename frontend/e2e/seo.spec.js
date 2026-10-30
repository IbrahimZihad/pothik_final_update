import { test, expect } from '@playwright/test';

async function readGraph(page) {
  return JSON.parse(await page.locator('script[data-seo-jsonld]').textContent());
}

test.describe('link previews and structured data', () => {
  test('home exposes absolute OG image, Twitter card and WebSite graph', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/POTHIK/i);

    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(ogImage).toBe(`${new URL(page.url()).origin}/og.png`);
    await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute('content', '1200');
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');

    await expect
      .poll(async () => (await readGraph(page))['@graph'].map((node) => node['@type']))
      .toEqual(['Organization', 'WebSite']);
  });

  test('destination links preview with TouristDestination data and a breadcrumb', async ({ page }) => {
    await page.goto('/destinations');
    await page.locator('a[href="/destinations/coxs-bazar"]').first().click();
    await expect(page).toHaveURL(/\/destinations\/coxs-bazar$/);
    await expect(page).toHaveTitle(/Cox's Bazar · POTHIK/);

    const origin = new URL(page.url()).origin;
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', `${origin}/og.png`);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', `${origin}/destinations/coxs-bazar`);

    await expect
      .poll(async () => (await readGraph(page))['@graph'].filter((node) => node['@type'] === 'TouristDestination').length)
      .toBe(1);
    const graph = await readGraph(page);
    expect(graph['@graph'].some((node) => node['@type'] === 'BreadcrumbList')).toBe(true);
  });

  test('journal articles publish BlogPosting metadata', async ({ page }) => {
    await page.goto('/journal');
    await page.locator('a[href^="/journal/"]').first().click();
    await expect(page).toHaveURL(/\/journal\/.+/);
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article');
    await expect(page.locator('meta[property="article:published_time"]')).toHaveCount(1);

    await expect
      .poll(async () => (await readGraph(page))['@graph'].filter((node) => node['@type'] === 'BlogPosting').length)
      .toBe(1);
  });

  test('search pages are noindex and robots.txt blocks private areas', async ({ page, request }) => {
    await page.goto('/search?q=cox');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');

    const robots = await request.get('/robots.txt');
    expect(robots.ok()).toBeTruthy();
    const body = await robots.text();
    expect(body).toContain('Disallow: /admin');
    expect(body).toContain('Disallow: /account');
  });
});

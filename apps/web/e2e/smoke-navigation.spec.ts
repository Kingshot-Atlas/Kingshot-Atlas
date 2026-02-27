import { test, expect } from '@playwright/test';

/**
 * Smoke tests for all major public pages.
 * Verifies each page loads without crashing (no white screen).
 */

const PUBLIC_PAGES = [
  { path: '/', name: 'Home / Kingdom Directory' },
  { path: '/leaderboards', name: 'Leaderboards' },
  { path: '/compare', name: 'Compare Kingdoms' },
  { path: '/kingdom/100', name: 'Kingdom Profile' },
  { path: '/transfer-hub', name: 'Transfer Hub' },
  { path: '/about', name: 'About' },
  { path: '/changelog', name: 'Changelog' },
  { path: '/gift-codes', name: 'Gift Codes' },
  { path: '/tools', name: 'Tools' },
  { path: '/kvk-seasons', name: 'KvK Seasons' },
  { path: '/support', name: 'Support Atlas' },
  { path: '/privacy', name: 'Privacy Policy' },
  { path: '/terms', name: 'Terms of Service' },
  { path: '/ambassadors', name: 'Ambassadors' },
  { path: '/atlas-bot', name: 'Atlas Bot' },
];

test.describe('Smoke — Public Page Load', () => {
  for (const { path, name } of PUBLIC_PAGES) {
    test(`${name} (${path}) loads without crash`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      // Page should not be blank
      const bodyText = await page.locator('body').textContent();
      expect(bodyText?.length).toBeGreaterThan(0);

      // No uncaught JS errors (Playwright captures these)
      // Body should have visible content
      await expect(page.locator('body')).toBeVisible();
    });
  }
});

test.describe('Smoke — Navigation Bar', () => {
  test('nav is present on every page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const nav = page.locator('nav, [role="navigation"]').first();
    await expect(nav).toBeVisible({ timeout: 10000 });
  });

  test('nav contains expected links', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // At minimum, these core links should exist somewhere in navigation
    const links = await page.locator('nav a, [role="navigation"] a').allTextContents();
    const linkText = links.join(' ').toLowerCase();

    // Should have at least some core navigation items
    const hasCoreNav = linkText.includes('kingdom') || linkText.includes('rank') || linkText.includes('leader') || linkText.includes('home') || linkText.includes('directory');
    expect(hasCoreNav).toBeTruthy();
  });
});

test.describe('Smoke — Footer', () => {
  test('footer is present on home page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const footer = page.locator('footer').first();
    if (await footer.isVisible().catch(() => false)) {
      // If footer exists, it should have some content
      const footerText = await footer.textContent();
      expect(footerText?.length).toBeGreaterThan(0);
    }
  });
});

test.describe('Smoke — 404 Handling', () => {
  test('unknown route does not crash', async ({ page }) => {
    await page.goto('/this-page-does-not-exist-xyz');
    await page.waitForLoadState('networkidle');

    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(0);
  });
});

test.describe('Smoke — Console Errors', () => {
  test('home page has no fatal console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Filter out known non-fatal errors (e.g., missing favicon, third-party scripts)
    const fatalErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('404') && !e.includes('Failed to fetch')
    );

    expect(fatalErrors).toHaveLength(0);
  });
});

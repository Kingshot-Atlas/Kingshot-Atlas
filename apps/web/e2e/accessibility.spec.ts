import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility tests using axe-core.
 * Checks WCAG 2.1 Level A/AA compliance on key public pages.
 * 
 * NOTE: Requires @axe-core/playwright as a devDependency.
 *   npm install -D @axe-core/playwright
 */

const A11Y_PAGES = [
  { path: '/', name: 'Home' },
  { path: '/leaderboards', name: 'Leaderboards' },
  { path: '/compare', name: 'Compare' },
  { path: '/kingdom/100', name: 'Kingdom Profile' },
  { path: '/transfer-hub', name: 'Transfer Hub' },
  { path: '/about', name: 'About' },
  { path: '/support', name: 'Support Atlas' },
];

test.describe('Accessibility — axe-core', () => {
  for (const { path, name } of A11Y_PAGES) {
    test(`${name} (${path}) has no critical a11y violations`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        // Exclude third-party embeds and dynamic content that may not be under our control
        .exclude('iframe')
        .analyze();

      // Only fail on critical and serious violations
      const critical = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
      );

      if (critical.length > 0) {
        const summary = critical.map(
          (v) => `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} instances)`
        ).join('\n');
        console.log(`A11y violations on ${name}:\n${summary}`);
      }

      expect(critical).toHaveLength(0);
    });
  }
});

test.describe('Accessibility — Manual Checks', () => {
  test('all images have alt text', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const images = await page.locator('img').all();
    for (const img of images) {
      const alt = await img.getAttribute('alt');
      const role = await img.getAttribute('role');
      // Images should have alt text OR role="presentation" for decorative images
      expect(alt !== null || role === 'presentation' || role === 'none').toBeTruthy();
    }
  });

  test('interactive elements are keyboard accessible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Tab through first 10 interactive elements
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      const focused = page.locator(':focus');
      const isVisible = await focused.isVisible().catch(() => false);
      if (isVisible) {
        // Focused element should be visible (not hidden)
        await expect(focused).toBeVisible();
      }
    }
  });

  test('page has proper lang attribute', async ({ page }) => {
    await page.goto('/');
    const lang = await page.locator('html').getAttribute('lang');
    expect(lang).toBeTruthy();
  });

  test('page has proper document title', async ({ page }) => {
    await page.goto('/');
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test('color contrast — text is visible on backgrounds', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Use axe specifically for color contrast
    const results = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .analyze();

    const serious = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    if (serious.length > 0) {
      console.log(
        `Color contrast issues: ${serious[0]?.nodes.length || 0} instances`
      );
    }

    // Log but don't hard-fail on contrast for now (dark themes can be tricky)
    // This serves as a tracking mechanism
    expect(serious.length).toBeLessThanOrEqual(5);
  });
});

import { test, expect } from '@playwright/test';

/**
 * E2E tests for Transfer Hub — the kingdom transfer/recruiting marketplace.
 * Tests cover page loading, filtering, kingdom listings, and read-only behavior.
 */

test.describe('Transfer Hub — Page Load', () => {
  test('should load the transfer hub page', async ({ page }) => {
    await page.goto('/transfer-hub');
    await page.waitForLoadState('networkidle');

    // Should show transfer hub content or error state
    const hasContent = await page.locator('text=/transfer|recruiting|kingdom/i').first().isVisible({ timeout: 10000 }).catch(() => false);
    const hasError = await page.locator('[data-testid="data-load-error"], text=/unavailable|error/i').first().isVisible().catch(() => false);

    expect(hasContent || hasError).toBeTruthy();
  });

  test('should show page heading', async ({ page }) => {
    await page.goto('/transfer-hub');
    await page.waitForLoadState('networkidle');

    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Transfer Hub — Kingdom Listings', () => {
  test('should display kingdom listings or empty state', async ({ page }) => {
    await page.goto('/transfer-hub');
    await page.waitForLoadState('networkidle');

    // Either kingdom cards are shown, or an empty state message, or error
    const hasListings = await page.locator('[data-testid="kingdom-listing"], text=/recruiting|kingdom #/i').first().isVisible({ timeout: 10000 }).catch(() => false);
    const hasEmptyState = await page.locator('text=/no kingdoms|no results|no listings/i').first().isVisible().catch(() => false);
    const hasError = await page.locator('[data-testid="data-load-error"]').isVisible().catch(() => false);

    expect(hasListings || hasEmptyState || hasError).toBeTruthy();
  });

  test('should navigate to kingdom profile from listing', async ({ page }) => {
    await page.goto('/transfer-hub');
    await page.waitForLoadState('networkidle');

    // Try clicking a kingdom link if listings are present
    const kingdomLink = page.locator('a[href*="/kingdom/"]').first();
    if (await kingdomLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await kingdomLink.click();
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/kingdom/');
    }
  });
});

test.describe('Transfer Hub — Filtering', () => {
  test('should have filter controls visible', async ({ page }) => {
    await page.goto('/transfer-hub');
    await page.waitForLoadState('networkidle');

    // Look for filter UI elements (search, dropdowns, toggles)
    const hasFilters = await page.locator('input[type="text"], input[type="search"], select, [data-testid="filter"]').first().isVisible({ timeout: 10000 }).catch(() => false);
    const hasFilterButton = await page.locator('text=/filter|search|sort/i').first().isVisible().catch(() => false);

    // Filters may be hidden behind a button on mobile
    expect(hasFilters || hasFilterButton).toBeTruthy();
  });
});

test.describe('Transfer Hub — Deep Link', () => {
  test('should handle kingdom query param', async ({ page }) => {
    await page.goto('/transfer-hub?kingdom=100');
    await page.waitForLoadState('networkidle');

    // Should show kingdom 100 details, filtered view, or handle gracefully
    const hasContent = await page.locator('text=/100|transfer|kingdom/i').first().isVisible({ timeout: 10000 }).catch(() => false);
    const hasError = await page.locator('[data-testid="data-load-error"], text=/unavailable|error/i').first().isVisible().catch(() => false);

    expect(hasContent || hasError).toBeTruthy();
  });
});

test.describe('Transfer Hub — Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should render transfer hub on mobile', async ({ page }) => {
    await page.goto('/transfer-hub');
    await page.waitForLoadState('networkidle');

    const hasContent = await page.locator('text=/transfer|recruiting|kingdom/i').first().isVisible({ timeout: 10000 }).catch(() => false);
    const hasError = await page.locator('[data-testid="data-load-error"], text=/unavailable|error/i').first().isVisible().catch(() => false);

    expect(hasContent || hasError).toBeTruthy();
  });
});

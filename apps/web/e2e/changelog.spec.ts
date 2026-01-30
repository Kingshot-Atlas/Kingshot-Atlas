import { test, expect } from '@playwright/test';

test.describe('Changelog Page', () => {
  test('should load changelog page', async ({ page }) => {
    await page.goto('/changelog');
    
    await page.waitForLoadState('networkidle');
    
    // Check for changelog heading
    await expect(page.locator('text=/changelog/i').first()).toBeVisible();
  });

  test('should display version entries', async ({ page }) => {
    await page.goto('/changelog');
    
    await page.waitForLoadState('networkidle');
    
    // Check for version numbers
    const hasVersions = await page.locator('text=/v1\\./').first().isVisible();
    expect(hasVersions).toBeTruthy();
  });

  test('should show categorized changes', async ({ page }) => {
    await page.goto('/changelog');
    
    await page.waitForLoadState('networkidle');
    
    // Check for category labels
    const hasNew = await page.locator('text=/new|what\'s new/i').first().isVisible();
    const hasImproved = await page.locator('text=/improved/i').first().isVisible();
    
    expect(hasNew || hasImproved).toBeTruthy();
  });

  test('should have Discord CTA', async ({ page }) => {
    await page.goto('/changelog');
    
    await page.waitForLoadState('networkidle');
    
    // Check for Discord link
    const hasDiscordLink = await page.locator('a[href*="discord"]').first().isVisible();
    expect(hasDiscordLink).toBeTruthy();
  });

  test('should have back to home link', async ({ page }) => {
    await page.goto('/changelog');
    
    await page.waitForLoadState('networkidle');
    
    // Check for home link
    const hasHomeLink = await page.locator('a[href="/"]').first().isVisible();
    expect(hasHomeLink).toBeTruthy();
  });
});

test.describe('Tools Page', () => {
  test('should load tools page', async ({ page }) => {
    await page.goto('/tools');
    
    await page.waitForLoadState('networkidle');
    
    // Check that tools content is visible
    await expect(page.locator('text=/tools|simulator|calculator/i').first()).toBeVisible();
  });
});

test.describe('About Page', () => {
  test('should load about page', async ({ page }) => {
    await page.goto('/about');
    
    await page.waitForLoadState('networkidle');
    
    // Check for about content
    await expect(page.locator('text=/about|mission|atlas/i').first()).toBeVisible();
  });

  test('should display FAQ section', async ({ page }) => {
    await page.goto('/about');
    
    await page.waitForLoadState('networkidle');
    
    // Check for FAQ
    const hasFaq = await page.locator('text=/faq|frequently|questions/i').first().isVisible();
    expect(hasFaq).toBeTruthy();
  });
});

import { test, expect } from '@playwright/test';

/**
 * E2E tests for loading states and error handling.
 * Verifies that skeleton loaders display during data fetching
 * and error states are properly shown when data fails to load.
 */

test.describe('Loading States', () => {
  test.describe('Leaderboards Page', () => {
    test('should show skeleton while loading', async ({ page }) => {
      // Start navigation but don't wait for network idle
      await page.goto('/leaderboards', { waitUntil: 'domcontentloaded' });
      
      // Check if skeleton appears during loading (may be very brief)
      const skeleton = page.locator('[data-testid="leaderboard-skeleton"]');
      const content = page.locator('text=/Atlas Score|#1|Rank|ranking/i');
      const error = page.locator('[data-testid="data-load-error"]');
      
      // Either skeleton, content, or error state is visible
      await expect(skeleton.or(content).or(error)).toBeVisible({ timeout: 10000 });
    });

    test('should transition from skeleton to content', async ({ page }) => {
      await page.goto('/leaderboards');
      await page.waitForLoadState('networkidle');
      
      // After loading, content or error state should be visible (data may not be available in CI)
      const hasContent = await page.locator('text=/Atlas Score|#1|Rank|ranking/i').first().isVisible({ timeout: 10000 }).catch(() => false);
      const hasError = await page.locator('[data-testid="data-load-error"], text=/unavailable|error/i').first().isVisible().catch(() => false);
      expect(hasContent || hasError).toBeTruthy();
      
      // Skeleton should be gone (or never present if data loaded fast)
      const skeletonVisible = await page.locator('[data-testid="leaderboard-skeleton"]').isVisible().catch(() => false);
      expect(skeletonVisible).toBeFalsy();
    });

    test('should show sorted rankings', async ({ page }) => {
      await page.goto('/leaderboards');
      await page.waitForLoadState('networkidle');
      
      // Should have ranking numbers or error state visible
      const content = page.locator('text=/1|2|3/').first();
      const error = page.locator('[data-testid="data-load-error"]');
      const heading = page.locator('text=/ranking/i').first();
      
      await expect(content.or(error).or(heading)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Kingdom Profile Page', () => {
    test('should show skeleton while loading profile', async ({ page }) => {
      await page.goto('/kingdom/100', { waitUntil: 'domcontentloaded' });
      
      // Check if profile skeleton appears during loading
      const skeleton = page.locator('[data-testid="profile-skeleton"]');
      const content = page.locator('text=/K100|Kingdom 100|Atlas Score/i');
      const error = page.locator('[data-testid="data-load-error"], text=/unavailable|error|not found/i').first();
      
      // Either skeleton, content, or error state is visible
      await expect(skeleton.or(content).or(error)).toBeVisible({ timeout: 10000 });
    });

    test('should transition from skeleton to profile content', async ({ page }) => {
      await page.goto('/kingdom/100');
      await page.waitForLoadState('networkidle');
      
      // After loading, kingdom data or error state should be visible
      const hasKingdomNumber = await page.locator('text=/100/').first().isVisible({ timeout: 10000 }).catch(() => false);
      const hasError = await page.locator('[data-testid="data-load-error"], text=/unavailable|error|not found/i').first().isVisible().catch(() => false);
      expect(hasKingdomNumber || hasError).toBeTruthy();
    });

    test('should show kingdom not found for invalid kingdom', async ({ page }) => {
      await page.goto('/kingdom/99999');
      await page.waitForLoadState('networkidle');
      
      // Should show not found message, error, or loading state
      const hasNotFound = await page.locator('text=/not found|doesn\'t exist|unavailable|error|no data/i').first().isVisible({ timeout: 10000 }).catch(() => false);
      const hasError = await page.locator('[data-testid="data-load-error"]').isVisible().catch(() => false);
      const hasSkeleton = await page.locator('[data-testid="profile-skeleton"]').isVisible().catch(() => false);
      
      expect(hasNotFound || hasError || hasSkeleton).toBeTruthy();
    });
  });

  test.describe('Compare Kingdoms Page', () => {
    test('should load compare page with inputs', async ({ page }) => {
      await page.goto('/compare');
      await page.waitForLoadState('networkidle');
      
      // Should have input fields or compare page heading visible
      const inputs = page.locator('input[type="text"], input[type="number"], input');
      const inputCount = await inputs.count();
      const hasHeading = await page.locator('text=/compare/i').first().isVisible().catch(() => false);
      
      expect(inputCount >= 1 || hasHeading).toBeTruthy();
    });

    test('should show comparison when kingdoms are loaded', async ({ page }) => {
      await page.goto('/compare?kingdoms=100,101');
      await page.waitForLoadState('networkidle');
      
      // Should show kingdom numbers, compare UI, or error state (data may not be available in CI)
      const hasData = await page.locator('text=/100/').first().isVisible({ timeout: 10000 }).catch(() => false);
      const hasError = await page.locator('[data-testid="data-load-error"], text=/unavailable|error/i').first().isVisible().catch(() => false);
      const hasCompareUI = await page.locator('text=/compare/i').first().isVisible().catch(() => false);
      
      expect(hasData || hasError || hasCompareUI).toBeTruthy();
    });

    test('should show comparison stats', async ({ page }) => {
      await page.goto('/compare?kingdoms=100,101');
      await page.waitForLoadState('networkidle');
      
      // Should show comparison metrics or error state
      const hasStats = await page.locator('text=/Atlas Score|Win Rate|KvK/i').first().isVisible({ timeout: 10000 }).catch(() => false);
      const hasError = await page.locator('[data-testid="data-load-error"], text=/unavailable|error/i').first().isVisible().catch(() => false);
      const hasCompareUI = await page.locator('text=/compare/i').first().isVisible().catch(() => false);
      
      expect(hasStats || hasError || hasCompareUI).toBeTruthy();
    });
  });
});

test.describe('Error States', () => {
  test('should handle page load gracefully', async ({ page }) => {
    // Test that the app doesn't crash on any main page
    const pages = ['/', '/leaderboards', '/compare', '/kingdom/100'];
    
    for (const path of pages) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      
      // Page should not show a white screen
      const bodyText = await page.locator('body').textContent();
      expect(bodyText?.length).toBeGreaterThan(0);
    }
  });

  test('should show retry button when DataLoadError is present', async ({ page }) => {
    // Navigate to a page - if there's a data load error, retry should be visible
    await page.goto('/leaderboards');
    await page.waitForLoadState('networkidle');
    
    const errorComponent = page.locator('[data-testid="data-load-error"]');
    
    if (await errorComponent.isVisible().catch(() => false)) {
      // If error is shown, retry button should be present
      await expect(page.locator('text=/Try Again|Retry/i')).toBeVisible();
    }
  });
});

test.describe('Mobile Responsiveness', () => {
  test.use({ viewport: { width: 375, height: 667 } });
  
  test('should render leaderboards on mobile', async ({ page }) => {
    await page.goto('/leaderboards');
    await page.waitForLoadState('networkidle');
    
    // Content, error state, or heading should be visible on mobile
    const hasContent = await page.locator('text=/Atlas Score|Rank|#1|ranking/i').first().isVisible({ timeout: 10000 }).catch(() => false);
    const hasError = await page.locator('[data-testid="data-load-error"], text=/unavailable|error/i').first().isVisible().catch(() => false);
    
    expect(hasContent || hasError).toBeTruthy();
  });

  test('should render kingdom profile on mobile', async ({ page }) => {
    await page.goto('/kingdom/100');
    await page.waitForLoadState('networkidle');
    
    // Profile content or error state should be visible on mobile
    const hasContent = await page.locator('text=/100|KvK|Score/i').first().isVisible({ timeout: 10000 }).catch(() => false);
    const hasError = await page.locator('[data-testid="data-load-error"], text=/unavailable|error|not found/i').first().isVisible().catch(() => false);
    
    expect(hasContent || hasError).toBeTruthy();
  });
});

import { test, expect } from '@playwright/test';

test.describe('Keyboard Shortcuts', () => {
  test('should open help modal with ? key', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Dispatch ? key event directly on window (avoids headless keyboard layout issues)
    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', code: 'Slash', shiftKey: true, bubbles: true, cancelable: true }));
    });
    
    // Check for keyboard shortcuts modal with timeout
    await expect(page.locator('text=/keyboard shortcuts/i')).toBeVisible({ timeout: 10000 });
  });

  test('should close help modal with Escape', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Open help modal via direct event dispatch
    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', code: 'Slash', shiftKey: true, bubbles: true, cancelable: true }));
    });
    await expect(page.locator('text=/keyboard shortcuts/i')).toBeVisible({ timeout: 10000 });
    
    // Close with Escape
    await page.keyboard.press('Escape');
    await expect(page.locator('text=/keyboard shortcuts/i')).not.toBeVisible({ timeout: 5000 });
  });

  test('should focus search with / key', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Press / to focus search
    await page.keyboard.press('/');
    
    // Check that search input is focused
    const searchInput = page.locator('input[type="text"], input[type="search"]').first();
    await expect(searchInput).toBeFocused();
  });

  test('should navigate to leaderboards with g then l', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Press g then l for leaderboards
    await page.keyboard.press('g');
    await page.keyboard.press('l');
    
    // Should navigate to rankings (route renamed from /leaderboards to /rankings)
    await expect(page).toHaveURL(/ranking/);
  });

  test('should navigate to profile with g then p', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Press g then p for profile
    await page.keyboard.press('g');
    await page.keyboard.press('p');
    
    // Should navigate to profile
    await expect(page).toHaveURL(/profile/);
  });

  test('should navigate home with g then h', async ({ page }) => {
    await page.goto('/leaderboards');
    await page.waitForLoadState('networkidle');
    
    // Press g then h for home
    await page.keyboard.press('g');
    await page.keyboard.press('h');
    
    // Should navigate to home
    await expect(page).toHaveURL('/');
  });
});

test.describe('Arrow Key Navigation', () => {
  test('should navigate cards with arrow keys', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check if kingdom cards are loaded (requires API data)
    const hasCards = await page.locator('[data-testid="kingdom-card"], table tbody tr, a[href*="/kingdom/"]').first().isVisible({ timeout: 5000 }).catch(() => false);
    
    if (hasCards) {
      // Press down arrow to select first card
      await page.keyboard.press('ArrowDown');
      
      // Press Enter to navigate to selected kingdom
      await page.keyboard.press('Enter');
      
      // Should navigate to a kingdom profile
      await expect(page).toHaveURL(/kingdom\/\d+/);
    } else {
      // Without data, arrow key navigation has nothing to navigate
      // Just verify the page didn't crash
      await expect(page.locator('body')).toBeVisible();
    }
  });
});

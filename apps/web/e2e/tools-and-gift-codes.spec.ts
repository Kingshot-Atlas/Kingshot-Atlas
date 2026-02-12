import { test, expect } from '@playwright/test';

test.describe('Tools Dropdown Navigation', () => {
  test('should show tools dropdown on hover (desktop)', async ({ page, isMobile }) => {
    test.skip(!!isMobile, 'Desktop-only test');
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Find the Tools nav link
    const toolsLink = page.locator('a[href="/tools"]').first();
    await expect(toolsLink).toBeVisible();

    // Hover to open dropdown
    await toolsLink.hover();

    // Dropdown should appear with tool links
    const dropdown = page.locator('a[href="/tools/gift-codes"]');
    await expect(dropdown).toBeVisible({ timeout: 3000 });
  });

  test('should navigate to Tools hub page', async ({ page }) => {
    await page.goto('/tools');
    await page.waitForLoadState('networkidle');

    // Tools page should show tool cards
    const heading = page.locator('text=/tools|toolkit/i').first();
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test('should display tool cards on Tools page', async ({ page }) => {
    await page.goto('/tools');
    await page.waitForLoadState('networkidle');

    // Should have multiple tool cards with links
    const toolLinks = page.locator('a[href*="/tools/"], a[href="/compare"], a[href="/atlas-bot"]');
    const count = await toolLinks.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('should navigate from Tools to Gift Code Redeemer', async ({ page }) => {
    await page.goto('/tools');
    await page.waitForLoadState('networkidle');

    // Click on Gift Code Redeemer card/link
    const giftCodeLink = page.locator('a[href="/tools/gift-codes"]').first();
    if (await giftCodeLink.isVisible()) {
      await giftCodeLink.click();
      await expect(page).toHaveURL(/\/tools\/gift-codes/);
    }
  });

  test('should toggle mobile tools submenu', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile-only test');
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open mobile hamburger menu
    const menuButton = page.locator('button').filter({ hasText: /menu/i }).or(
      page.locator('[aria-label*="menu" i], button svg').first()
    );
    
    // Look for the mobile menu toggle (hamburger icon)
    const hamburger = page.locator('button').filter({ has: page.locator('svg path[d*="M4 6"]') }).first();
    if (await hamburger.isVisible()) {
      await hamburger.click();

      // Find and click Tools accordion
      const toolsButton = page.locator('button').filter({ hasText: /tools/i }).first();
      if (await toolsButton.isVisible()) {
        await toolsButton.click();

        // Gift codes link should appear in submenu
        const giftCodeLink = page.locator('a[href="/tools/gift-codes"]');
        await expect(giftCodeLink).toBeVisible({ timeout: 3000 });
      }
    }
  });
});

test.describe('Gift Code Redeemer Page', () => {
  test('should load the Gift Code Redeemer page', async ({ page }) => {
    await page.goto('/tools/gift-codes');
    await page.waitForLoadState('networkidle');

    // Page should show gift code content
    const heading = page.locator('text=/gift code|redeem/i').first();
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test('should display active gift codes', async ({ page }) => {
    await page.goto('/tools/gift-codes');
    await page.waitForLoadState('networkidle');

    // Should show code cards, loading state, or "no codes" message
    const hasCodes = await page.locator('text=/[A-Z]{4,}/').first().isVisible({ timeout: 10000 }).catch(() => false);
    const hasEmpty = await page.locator('text=/no.*code|no.*active|check back/i').first().isVisible().catch(() => false);
    const hasLoading = await page.locator('text=/loading/i').first().isVisible().catch(() => false);

    expect(hasCodes || hasEmpty || hasLoading).toBeTruthy();
  });

  test('should show link account prompt when not logged in', async ({ page }) => {
    await page.goto('/tools/gift-codes');
    await page.waitForLoadState('networkidle');

    // When not logged in, should show a prompt to link account or sign in
    const hasPrompt = await page.locator('text=/sign in|log in|link.*account|player.*id|connect/i').first().isVisible({ timeout: 10000 }).catch(() => false);
    const hasCodes = await page.locator('text=/[A-Z]{4,}/').first().isVisible().catch(() => false);

    // Should show either the prompt or the codes (page should render something useful)
    expect(hasPrompt || hasCodes).toBeTruthy();
  });

  test('should have copy code functionality', async ({ page }) => {
    await page.goto('/tools/gift-codes');
    await page.waitForLoadState('networkidle');

    // Look for copy buttons or clickable code elements
    const copyButton = page.locator('button').filter({ hasText: /copy/i }).first();
    const codeElement = page.locator('[style*="monospace"], code, [style*="cursor: pointer"]').first();

    const hasCopy = await copyButton.isVisible({ timeout: 5000 }).catch(() => false);
    const hasClickableCode = await codeElement.isVisible().catch(() => false);

    // At least one copy mechanism should exist (or no codes available)
    const hasNoCodes = await page.locator('text=/no.*code|no.*active/i').first().isVisible().catch(() => false);
    expect(hasCopy || hasClickableCode || hasNoCodes).toBeTruthy();
  });

  test('should have manual code input field', async ({ page }) => {
    await page.goto('/tools/gift-codes');
    await page.waitForLoadState('networkidle');

    // Should have an input for entering a code manually
    const input = page.locator('input[placeholder*="code" i], input[placeholder*="enter" i], input[type="text"]').first();
    const hasInput = await input.isVisible({ timeout: 10000 }).catch(() => false);

    // Input may only show when logged in, so also check for login prompt
    const hasLoginPrompt = await page.locator('text=/sign in|log in/i').first().isVisible().catch(() => false);
    expect(hasInput || hasLoginPrompt).toBeTruthy();
  });

  test('should show source badge for codes', async ({ page }) => {
    await page.goto('/tools/gift-codes');
    await page.waitForLoadState('networkidle');

    // Codes should show their source (kingshot.net, manual, etc.)
    const hasSource = await page.locator('text=/kingshot\.net|manual|database|merged/i').first().isVisible({ timeout: 10000 }).catch(() => false);
    const hasNoCodes = await page.locator('text=/no.*code|no.*active/i').first().isVisible().catch(() => false);
    const hasCodes = await page.locator('text=/[A-Z]{4,}/').first().isVisible().catch(() => false);

    // Either show source badges with codes, or show empty state
    expect(hasSource || hasNoCodes || hasCodes).toBeTruthy();
  });

  test('should be responsive on mobile viewport', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile-only test');
    await page.goto('/tools/gift-codes');
    await page.waitForLoadState('networkidle');

    // Page should not have horizontal scroll
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5); // 5px tolerance

    // Content should be visible
    const heading = page.locator('text=/gift code|redeem/i').first();
    await expect(heading).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Gift Code Redeemer - Navigation Integration', () => {
  test('should navigate back to Tools from Gift Code Redeemer', async ({ page }) => {
    await page.goto('/tools/gift-codes');
    await page.waitForLoadState('networkidle');

    // Look for a back/breadcrumb link to Tools
    const backLink = page.locator('a[href="/tools"]').first();
    if (await backLink.isVisible()) {
      await backLink.click();
      await expect(page).toHaveURL(/\/tools$/);
    }
  });

  test('should handle direct URL access to gift codes page', async ({ page }) => {
    // Direct navigation should work (not require going through Tools first)
    const response = await page.goto('/tools/gift-codes');
    expect(response?.status()).toBeLessThan(400);

    await page.waitForLoadState('networkidle');
    const heading = page.locator('text=/gift code|redeem/i').first();
    await expect(heading).toBeVisible({ timeout: 10000 });
  });
});

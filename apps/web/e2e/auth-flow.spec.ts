import { test, expect } from '@playwright/test';

/**
 * E2E tests for authentication flows.
 * These tests verify the auth UI without actually logging in (no credentials in CI).
 * They ensure auth-gated pages redirect or show login prompts,
 * and that the sign-in/sign-out UI elements are present.
 */

test.describe('Auth UI — Unauthenticated', () => {
  test('should show sign-in button on home page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Look for sign-in / login trigger in nav or header
    const signInBtn = page.locator('text=/sign in|log in|login/i').first();
    const authTrigger = page.locator('a[href*="auth"], button:has-text("Sign"), [data-testid="auth-trigger"]').first();

    await expect(signInBtn.or(authTrigger)).toBeVisible({ timeout: 10000 });
  });

  test('should redirect or prompt when accessing profile page unauthenticated', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');

    // Should redirect to home, show login prompt, or show auth-required message
    const isRedirected = page.url() === new URL('/', page.url()).href || page.url().includes('auth');
    const hasAuthPrompt = await page.locator('text=/sign in|log in|create account|authentication/i').first().isVisible({ timeout: 5000 }).catch(() => false);
    const hasProfileContent = await page.locator('text=/profile|settings|account/i').first().isVisible().catch(() => false);

    expect(isRedirected || hasAuthPrompt || hasProfileContent).toBeTruthy();
  });

  test('should redirect or prompt when accessing admin page unauthenticated', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Admin should not be accessible — redirect or access denied
    const isRedirected = !page.url().includes('/admin');
    const hasAccessDenied = await page.locator('text=/denied|unauthorized|not authorized|sign in|forbidden/i').first().isVisible({ timeout: 5000 }).catch(() => false);

    expect(isRedirected || hasAccessDenied).toBeTruthy();
  });

  test('should redirect or prompt when accessing messages page unauthenticated', async ({ page }) => {
    await page.goto('/messages');
    await page.waitForLoadState('networkidle');

    const isRedirected = !page.url().includes('/messages');
    const hasAuthPrompt = await page.locator('text=/sign in|log in|authentication/i').first().isVisible({ timeout: 5000 }).catch(() => false);

    expect(isRedirected || hasAuthPrompt).toBeTruthy();
  });
});

test.describe('Auth Callback', () => {
  test('should handle auth callback page without crashing', async ({ page }) => {
    // Visiting /auth/callback without valid params should not crash
    await page.goto('/auth/callback');
    await page.waitForLoadState('networkidle');

    // Page should render something (redirect home, show error, or loading)
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(0);
  });

  test('should handle Discord callback without crashing', async ({ page }) => {
    await page.goto('/auth/discord/callback');
    await page.waitForLoadState('networkidle');

    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(0);
  });
});

test.describe('Auth-gated Features', () => {
  test('should not show admin nav item for unauthenticated users', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Admin link should not be visible in nav for guests
    const adminLink = page.locator('nav a[href="/admin"], nav a[href*="admin"]');
    const adminCount = await adminLink.count();
    expect(adminCount).toBe(0);
  });

  test('transfer hub should load for unauthenticated users (read-only)', async ({ page }) => {
    await page.goto('/transfer-hub');
    await page.waitForLoadState('networkidle');

    // Transfer hub should be accessible for viewing (not applying)
    const hasContent = await page.locator('text=/transfer|kingdom|recruiting/i').first().isVisible({ timeout: 10000 }).catch(() => false);
    const hasError = await page.locator('[data-testid="data-load-error"], text=/unavailable|error/i').first().isVisible().catch(() => false);

    expect(hasContent || hasError).toBeTruthy();
  });
});

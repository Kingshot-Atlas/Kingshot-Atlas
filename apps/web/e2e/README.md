# E2E Tests for Kingshot Atlas

End-to-end tests using Playwright.

## Setup

```bash
# Install Playwright browsers
npx playwright install
```

## Running Tests

```bash
# Run all tests
npx playwright test

# Run tests in UI mode (recommended for development)
npx playwright test --ui

# Run specific test file
npx playwright test e2e/kingdom-flow.spec.ts

# Run tests in headed mode (see browser)
npx playwright test --headed

# Run tests for specific browser
npx playwright test --project=chromium
```

## Test Structure

- `kingdom-flow.spec.ts` - Main user flows (directory, profile, compare)

## Writing Tests

```typescript
import { test, expect } from '@playwright/test';

test('example test', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
});
```

## CI Integration

Tests run automatically on CI. Configure in `.github/workflows/`.

## Reports

After running tests:
```bash
npx playwright show-report
```

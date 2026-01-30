# Frontend Testing Specialist — Latest Knowledge

**Last Updated:** 2026-01-29  
**Version:** 1.0

---

## Current Test State

### Test Infrastructure
- **E2E Tests:** Not yet configured
- **Component Tests:** Limited/none
- **API Tests:** Exist in `/apps/api/` (100% passing)
- **Coverage:** Not tracked for frontend

### Known Testing Gaps
- No E2E tests for critical user flows
- No component tests for large components
- No visual regression tests
- No accessibility tests

---

## Priority Components to Test

### Large Components (from STATUS_SNAPSHOT)
| Component | Lines | Priority | Risk |
|-----------|-------|----------|------|
| KingdomCard.tsx | 946 | High | Core display component |
| ProfileFeatures.tsx | 1008 | High | Complex feature logic |
| KingdomDirectory.tsx | 1023 | High | Main listing page |

### Critical Flows
1. Kingdom search and filtering
2. Kingdom profile viewing
3. Kingdom comparison
4. Atlas Score display
5. Authentication flows
6. Premium feature gating

---

## Recommended Test Setup

### Playwright (Recommended for E2E)
```bash
# Install
npm init playwright@latest

# Config location
/apps/web/playwright.config.ts

# Test location
/apps/web/tests/e2e/
```

### React Testing Library (For Components)
```bash
# Usually included with CRA
# Additional utilities
npm install --save-dev @testing-library/user-event

# Test location
/apps/web/src/**/__tests__/
```

---

## Selector Strategy for Atlas

### Data Test IDs to Add
```typescript
// Kingdom cards
data-testid="kingdom-card"
data-testid="kingdom-card-{id}"
data-testid="atlas-score"
data-testid="kingdom-tier"

// Search/Filter
data-testid="search-input"
data-testid="filter-panel"
data-testid="sort-dropdown"

// Navigation
data-testid="nav-home"
data-testid="nav-compare"
data-testid="nav-about"
```

---

## API Mocking Strategy

### MSW Setup
```typescript
// /apps/web/src/mocks/handlers.ts
import { rest } from 'msw'

export const handlers = [
  rest.get('/api/kingdoms', (req, res, ctx) => {
    return res(ctx.json(mockKingdoms))
  }),
  rest.get('/api/kingdoms/:id', (req, res, ctx) => {
    return res(ctx.json(mockKingdomDetail))
  }),
]
```

### Test Data
- Create fixtures for: kingdoms, users, comparisons
- Use realistic but predictable data
- Include edge cases: empty results, errors

---

## Test Patterns for Atlas

### Kingdom Search Test
```typescript
test('should filter kingdoms by name', async ({ page }) => {
  await page.goto('/kingdoms');
  await page.getByTestId('search-input').fill('Kingdom 172');
  await expect(page.getByTestId('kingdom-card')).toHaveCount(1);
  await expect(page.getByText('Kingdom 172')).toBeVisible();
});
```

### Atlas Score Display Test
```typescript
test('should display Atlas Score with correct formatting', async ({ page }) => {
  await page.goto('/kingdom/172');
  const score = page.getByTestId('atlas-score');
  await expect(score).toBeVisible();
  await expect(score).toHaveText(/\d+\.\d{2}/); // e.g., "85.42"
});
```

---

## CI Integration

### GitHub Actions Workflow
```yaml
# .github/workflows/test.yml
name: Frontend Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx playwright install
      - run: npm test
      - run: npx playwright test
```

---

## Gotchas

### Known Challenges
- Large components may need refactoring to be testable
- Some components tightly coupled to API
- Theme/accessibility context needs mocking
- Premium features need auth state mocking

### Things to Watch
- Flaky tests often indicate timing issues
- Network-dependent tests should use mocking
- Snapshot tests can become maintenance burden

---

## Current Priorities

1. **Set up Playwright** — E2E test infrastructure
2. **Test critical path** — Kingdom search → view → compare
3. **Add component tests** — Start with KingdomCard
4. **CI integration** — Tests run on every PR

---

*Knowledge base for Frontend Testing Specialist*

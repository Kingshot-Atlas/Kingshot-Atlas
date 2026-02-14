---
description: Analyze and fix mobile responsiveness issues across all pages - UX Designer workflow
---

# Mobile UX Analysis & Optimization Workflow

This workflow provides a systematic approach to analyzing UI layouts and ensuring a polished mobile experience across all screen sizes.

---

## 1. Pre-Analysis Setup

### 1.1 Load Project Context
```bash
# Read the style guide for existing responsive patterns
cat apps/web/src/STYLE_GUIDE.md

# Check existing responsive hooks
cat apps/web/src/hooks/useMediaQuery.ts
```

### 1.2 Understand Breakpoints
| Breakpoint | Width | Hook | CSS Variable |
|------------|-------|------|--------------|
| **Mobile** | < 768px | `useIsMobile()` | `--breakpoint-mobile` |
| **Tablet** | 768px - 1023px | `useIsTablet()` | `--breakpoint-tablet` |
| **Desktop** | 1024px - 1439px | `useIsDesktop()` | `--breakpoint-desktop` |
| **Wide** | ≥ 1440px | `useBreakpoint() === 'wide'` | `--breakpoint-wide` |

---

## 2. Page-by-Page Analysis Checklist

For EACH page in `apps/web/src/pages/`, analyze these critical areas:

### 2.1 Layout Structure Analysis
- [ ] **Container width**: Does the page use `max-width` with `margin: auto`?
- [ ] **Padding**: Does horizontal padding scale down on mobile (e.g., `1rem` vs `2rem`)?
- [ ] **Grid/Flex layouts**: Do multi-column layouts stack vertically on mobile?
- [ ] **Overflow**: Is `overflow-x: hidden` set to prevent horizontal scroll?

### 2.2 Typography Scaling
- [ ] **Headings**: Do H1/H2 font sizes scale appropriately?
  - Desktop: `2.5rem` / `1.75rem`
  - Mobile: `1.75rem` / `1.25rem`
- [ ] **Body text**: Is base font size ≥ 16px to prevent iOS zoom?
- [ ] **Line height**: Does line-height adjust for readability?

### 2.3 Touch Target Analysis
- [ ] **Buttons**: Minimum 44px × 44px touch target
- [ ] **Links**: Adequate spacing between clickable elements (8px minimum)
- [ ] **Form inputs**: Height ≥ 44px, font-size ≥ 16px
- [ ] **Icon buttons**: Min 44px clickable area (even if icon is smaller)

### 2.4 Component-Specific Checks
- [ ] **Cards**: Do they use full width on mobile?
- [ ] **Tables**: Do they scroll horizontally or transform to cards?
- [ ] **Modals**: Do they fill screen on mobile (bottom sheet pattern)?
- [ ] **Tooltips**: Do they use tap-to-show on mobile (not hover)?
- [ ] **Navigation**: Does it collapse to hamburger/bottom nav?
- [ ] **Charts/Graphs**: Do they resize or show mobile-specific versions?

### 2.5 Spacing & Safe Areas
- [ ] **Safe area insets**: Are notched device safe areas respected?
  ```css
  padding-bottom: max(1rem, env(safe-area-inset-bottom));
  ```
- [ ] **Thumb zones**: Are primary actions in bottom 40% of screen?
- [ ] **Fixed elements**: Do they not overlap content?

---

## 3. Common Breakage Patterns & Fixes

### 3.1 Horizontal Overflow (CRITICAL)
**Symptoms**: Horizontal scrollbar, content cut off
**Common causes**:
- Fixed-width elements (e.g., `width: 500px`)
- Tables without `overflow-x: auto`
- Long unbreakable strings (URLs, emails)
- Oversized images without `max-width: 100%`

**Fix pattern**:
```tsx
// Container
style={{
  width: '100%',
  maxWidth: isMobile ? '100%' : '1200px',
  overflowX: 'hidden',
}}

// Tables
<div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
  <table>...</table>
</div>

// Long text
style={{
  wordBreak: 'break-word',
  overflowWrap: 'anywhere',
}}
```

### 3.2 Grid Layout Collapse
**Symptoms**: Columns too narrow, content unreadable
**Fix pattern**:
```tsx
style={{
  display: 'grid',
  gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
  gap: isMobile ? '1rem' : '1.5rem',
}}
```

### 3.3 Flex Layout Issues
**Symptoms**: Items squished, don't wrap properly
**Fix pattern**:
```tsx
style={{
  display: 'flex',
  flexDirection: isMobile ? 'column' : 'row',
  flexWrap: 'wrap',
  gap: '1rem',
}}
```

### 3.4 Font Size Issues
**Symptoms**: Text too large/small, iOS auto-zoom on input focus
**Fix pattern**:
```tsx
// Page title
fontSize: isMobile ? '1.5rem' : '2.5rem',

// Section headers
fontSize: isMobile ? '1.1rem' : '1.5rem',

// Form inputs (MUST be 16px+ to prevent iOS zoom)
fontSize: '1rem', // 16px
```

### 3.5 Modal/Overlay Issues
**Symptoms**: Modals don't fit screen, can't scroll content
**Fix pattern**:
```tsx
// Mobile-first modal
style={{
  position: 'fixed',
  inset: isMobile ? 0 : 'auto',
  top: isMobile ? 'auto' : '50%',
  left: isMobile ? 0 : '50%',
  transform: isMobile ? 'none' : 'translate(-50%, -50%)',
  width: isMobile ? '100%' : '500px',
  maxHeight: isMobile ? '90vh' : '80vh',
  borderRadius: isMobile ? '1rem 1rem 0 0' : '1rem',
  overflowY: 'auto',
  paddingBottom: isMobile ? 'max(1rem, env(safe-area-inset-bottom))' : '1rem',
}}
```

### 3.6 Image Scaling
**Symptoms**: Images overflow container, aspect ratio broken
**Fix pattern**:
```tsx
style={{
  width: '100%',
  maxWidth: '100%',
  height: 'auto',
  objectFit: 'cover',
}}
```

### 3.7 Navigation Issues
**Symptoms**: Nav items overflow, hard to tap
**Fix pattern**:
```tsx
// Mobile nav should:
// 1. Collapse to hamburger menu OR
// 2. Use horizontal scroll with snap points OR
// 3. Move to bottom tab bar

// Horizontal scroll nav
style={{
  display: 'flex',
  overflowX: 'auto',
  scrollSnapType: 'x mandatory',
  WebkitOverflowScrolling: 'touch',
  scrollbarWidth: 'none', // Firefox
  msOverflowStyle: 'none', // IE
  '::-webkit-scrollbar': { display: 'none' }, // Chrome
}}
```

### 3.8 Table Responsiveness
**Symptoms**: Tables unreadable, columns crushed
**Options**:
```tsx
// Option 1: Horizontal scroll
<div style={{ overflowX: 'auto' }}>
  <table style={{ minWidth: '600px' }}>...</table>
</div>

// Option 2: Card transformation
{isMobile ? (
  <div className="card-grid">
    {data.map(row => <MobileCard key={row.id} data={row} />)}
  </div>
) : (
  <table>...</table>
)}

// Option 3: Priority columns (hide less important on mobile)
<th style={{ display: isMobile ? 'none' : 'table-cell' }}>Secondary Data</th>
```

---

## 4. Testing Procedure

### 4.1 Browser DevTools Testing
```
1. Open Chrome DevTools (F12 / Cmd+Option+I)
2. Toggle device toolbar (Cmd+Shift+M)
3. Test these viewport widths:
   - 320px (iPhone SE, minimum supported)
   - 375px (iPhone 12/13 mini)
   - 390px (iPhone 12/13/14)
   - 428px (iPhone 12/13/14 Pro Max)
   - 768px (iPad portrait / tablet breakpoint)
   - 1024px (iPad landscape / desktop breakpoint)
   
4. For each viewport, check:
   - No horizontal scroll
   - All text readable
   - All buttons tappable (44px minimum)
   - Forms functional
   - Modals/overlays work
```

### 4.2 Real Device Testing
```
Essential test devices:
- iPhone (Safari) - notch handling, safe areas
- Android (Chrome) - different rendering
- Tablet (iPad/Android) - intermediate layouts
```

### 4.3 Automated Viewport Testing
```bash
# Use Playwright for automated testing
npx playwright test --project=mobile

# Custom viewport test script (if exists)
npm run test:responsive
```

---

## 5. Page Analysis Template

When analyzing a specific page, use this template:

```markdown
## Page: [PageName.tsx]

### Current State
- [ ] Uses `useIsMobile()` hook: Yes/No
- [ ] Has responsive styles: Full/Partial/None
- [ ] Known issues: [list]

### Layout Analysis
| Element | Desktop | Mobile Target | Current Mobile | Status |
|---------|---------|---------------|----------------|--------|
| Container | max-width 1200px | 100% w/ padding | ? | ✅/❌ |
| Grid | 3 columns | 1 column | ? | ✅/❌ |
| Cards | 300px width | 100% width | ? | ✅/❌ |

### Touch Targets
| Element | Current Size | Required | Status |
|---------|--------------|----------|--------|
| Primary CTA | ? | 44px+ | ✅/❌ |
| Nav items | ? | 44px+ | ✅/❌ |
| Card clicks | ? | Full card | ✅/❌ |

### Typography
| Element | Desktop | Mobile Target | Current | Status |
|---------|---------|---------------|---------|--------|
| H1 | 2.5rem | 1.75rem | ? | ✅/❌ |
| Body | 1rem | 1rem | ? | ✅/❌ |

### Issues Found
1. [ ] Issue description → Fix needed
2. [ ] Issue description → Fix needed

### Recommended Fixes
```tsx
// Code fix here
```
```

---

## 6. Kingshot Atlas Page Inventory

Analyze each page in this order (by complexity/traffic):

### High Priority (Complex layouts, high traffic)
1. `KingdomDirectory.tsx` - Grid of cards, filters, search
2. `KingdomProfile.tsx` - Complex layout, stats, charts
3. `Rankings.tsx` - Tables, filters, tabs
4. `CompareKingdoms.tsx` - Side-by-side comparison
5. `Profile.tsx` - User profile, settings, tabs
6. `KvKSeasons.tsx` - Tables, history data

### Medium Priority
7. `Tools.tsx` - Multiple tool cards
8. `SupportAtlas.tsx` - Pricing cards, tiers
9. `About.tsx` - Content sections
10. `GiftCodeLanding.tsx` - Marketing landing page
11. `Ambassadors.tsx` - Referral directory

### Lower Priority (Simpler layouts)
12. `UserDirectory.tsx` - User list/grid
13. `Changelog.tsx` - Timeline/list
14. `MissingDataRegistry.tsx` - Table/list
15. `ComponentsDemo.tsx` - Dev tool

### Admin (Internal use)
16. `Admin.tsx`
17. `AdminDashboard.tsx`

---

## 7. Component Audit Checklist

Key shared components that affect multiple pages:

### Critical Components
- [ ] `Header.tsx` - Navigation collapse, mobile menu
- [ ] `KingdomCard.tsx` - Card sizing, touch targets
- [ ] `FilterPanel.tsx` - Mobile filter UX (drawer/modal)
- [ ] `AuthModal.tsx` - Mobile modal behavior
- [ ] `CompareTray.tsx` - Bottom position, safe areas
- [ ] `RadarChart.tsx` / `ComparisonRadarChart.tsx` - Size scaling

### Data Display Components
- [ ] `KingdomTable.tsx` - Table responsiveness
- [ ] `AtlasScoreBreakdown.tsx` - Complex data layout
- [ ] `ScoreHistoryChart.tsx` - Chart sizing
- [ ] `SideBySideAnalysis.tsx` - Comparison layout

### Interactive Components
- [ ] `SearchAutocomplete.tsx` - Mobile keyboard handling
- [ ] `Tooltip.tsx` - Tap vs hover
- [ ] `Toast.tsx` - Safe area positioning
- [ ] `NotificationBell.tsx` - Dropdown positioning

---

## 8. Quick Fixes Reference

### Add Mobile Hook to Component
```tsx
import { useIsMobile } from '../hooks/useMediaQuery';

const MyComponent = () => {
  const isMobile = useIsMobile();
  
  return (
    <div style={{
      padding: isMobile ? '1rem' : '2rem',
      fontSize: isMobile ? '0.9rem' : '1rem',
    }}>
      ...
    </div>
  );
};
```

### Responsive Container Pattern
```tsx
<div style={{
  width: '100%',
  maxWidth: '1200px',
  margin: '0 auto',
  padding: isMobile ? '1rem' : '2rem',
}}>
```

### Mobile-First Media Query (CSS)
```css
/* Mobile first */
.container {
  padding: 1rem;
  font-size: 0.9rem;
}

/* Tablet and up */
@media (min-width: 768px) {
  .container {
    padding: 1.5rem;
    font-size: 1rem;
  }
}

/* Desktop and up */
@media (min-width: 1024px) {
  .container {
    padding: 2rem;
  }
}
```

### Safe Area Handling
```tsx
style={{
  paddingTop: 'env(safe-area-inset-top)',
  paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
  paddingLeft: 'env(safe-area-inset-left)',
  paddingRight: 'env(safe-area-inset-right)',
}}
```

---

## 9. Execution Workflow

When running this workflow:

### Step 1: Analyze
```
1. Read the target page file
2. Identify all layout containers and their current responsive behavior
3. Check for useIsMobile/useIsTablet hooks usage
4. Note all hardcoded pixel values
```

### Step 2: Test
```
1. Start dev server: npm run dev
2. Open in browser, use DevTools device mode
3. Test at 320px, 375px, 768px widths
4. Document all breakage points
```

### Step 3: Fix
```
1. Add missing responsive hooks
2. Convert fixed widths to responsive values
3. Adjust typography scaling
4. Ensure touch targets meet 44px minimum
5. Test again at all breakpoints
```

### Step 4: Verify
```
1. No horizontal scroll at any breakpoint
2. All interactive elements have 44px+ touch targets
3. Text is readable without zooming
4. Modals/overlays work correctly
5. Safe areas respected on notched devices
```

---

## 10. Success Criteria

A page passes mobile UX audit when:

- ✅ No horizontal overflow at any viewport width ≥ 320px
- ✅ All touch targets ≥ 44px × 44px
- ✅ Typography scales appropriately (readable without zoom)
- ✅ Layouts adapt gracefully (grid → single column)
- ✅ Modals use bottom sheet pattern on mobile
- ✅ Tooltips are tap-accessible
- ✅ Safe area insets respected
- ✅ Form inputs don't trigger iOS zoom (16px+ font)
- ✅ Primary actions in thumb-friendly zones
- ✅ Visual hierarchy maintained on small screens

---

*Last Updated: 2026-02-14*
*Workflow Author: UX Designer Agent*

---
description: Premium mobile UI/UX audit and polish — expert-level workflow for top-tier mobile experiences (80% of users are mobile)
---

# /mobile-ux — Premium Mobile Experience Workflow

> **You are a world-class mobile UI/UX designer.** You specialize in building premium, app-like mobile web experiences. Your work is indistinguishable from native apps. Every pixel matters. Every interaction must feel smooth, intentional, and satisfying. 80% of Kingshot Atlas users are on mobile — this is your primary audience.

---

## Philosophy

1. **Mobile is not a downgrade.** Mobile users deserve the BEST experience, not a cramped desktop layout.
2. **Feel > Function.** A feature that works but feels janky is worse than one that's slightly simpler but feels premium.
3. **Respect the thumb.** Primary actions live where thumbs naturally rest. Secondary actions can live higher.
4. **Whitespace is premium.** Cramming content signals low quality. Breathing room signals confidence.
5. **Consistency is trust.** Every button, card, and interaction must feel like it belongs to the same family.

---

## 0. CRITICAL RULES (Read Before Every Run)

### DO NOT:
- Break existing desktop layouts — all changes must be `isMobile` gated
- Remove any functionality — only restructure presentation
- Change the color palette — follow `STYLE_GUIDE.md` exactly
- Add new dependencies without asking
- Touch admin-only pages (unless explicitly asked)
- Change any i18n translation keys

### ALWAYS:
- Read `apps/web/src/STYLE_GUIDE.md` before making changes
- Read `apps/web/src/hooks/useMediaQuery.ts` for breakpoint hooks
- Import `useIsMobile` from `'../hooks/useMediaQuery'` (or `'../../hooks/useMediaQuery'`)
- Use `colors` from `'../utils/styles'` (never hardcode hex values)
- Use `FONT_DISPLAY` for display typography
- Keep form input `fontSize` at `16px` or `1rem` minimum (prevents iOS zoom)
- Test that `npm run build` passes after changes

### SAFETY:
- Create a **git stash or branch** before starting large-scale changes
- Work page-by-page, not all-at-once
- After each page, run `npm run build` to catch regressions

---

## 1. Pre-Flight Check

Before touching any code:

// turbo
```bash
cd /Users/giovanni/projects/ai/Kingshot\ Atlas/apps/web && cat src/STYLE_GUIDE.md | head -200
```

// turbo
```bash
cd /Users/giovanni/projects/ai/Kingshot\ Atlas/apps/web && cat src/hooks/useMediaQuery.ts
```

// turbo
```bash
cd /Users/giovanni/projects/ai/Kingshot\ Atlas/apps/web && cat src/utils/styles.ts | head -100
```

Internalize:
- **Breakpoints**: Mobile `< 768px`, Tablet `768-1023px`, Desktop `≥ 1024px`
- **Colors**: `colors.*` from `utils/styles.ts` — NEVER raw hex
- **Fonts**: `FONT_DISPLAY` for titles, Inter for body, Orbitron for numbers
- **Buttons**: Must use `display: 'inline-flex'`, `alignItems: 'center'`, `justifyContent: 'center'`

---

## 2. The Premium Mobile Checklist (Per Page/Component)

For each page or component, evaluate against these **6 Pillars of Premium Mobile UX**:

### Pillar 1: Visual Hierarchy & Spacing
| Check | Standard | Why |
|-------|----------|-----|
| Section padding | `1rem` horizontal, `1.5rem` vertical minimum | Prevents cramped look |
| Card margins | `0.75rem` gap minimum between cards | Visual breathing room |
| Title sizing | `1.5rem`+ for page titles on mobile | Establishes hierarchy |
| Info density | Max 3-4 data points per visible card face | Prevents overwhelm |
| Vertical rhythm | Consistent spacing between sections | Professional flow |
| Content width | No element wider than viewport minus 2rem padding | Prevents horizontal overflow |

### Pillar 2: Touch Interaction Quality
| Check | Standard | Why |
|-------|----------|-----|
| Button height | `minHeight: 44px` (iOS HIG) | Reliable tap targets |
| Button padding | `0.75rem 1.25rem` minimum on mobile | Fat-finger friendly |
| Tap spacing | `8px` minimum between adjacent tappables | Prevents mis-taps |
| Active state | `transform: scale(0.97)` or opacity change on press | Satisfying feedback |
| Link areas | Full card/row tappable, not just text | Generous hit areas |
| Scroll behavior | `WebkitOverflowScrolling: 'touch'` on scroll containers | Native-feeling momentum |

### Pillar 3: Typography & Readability
| Check | Standard | Why |
|-------|----------|-----|
| Body text | `0.875rem`-`1rem` (14-16px) | Readable without zoom |
| Line height | `1.5`-`1.6` for body text | Comfortable reading |
| Form inputs | `fontSize: '1rem'` minimum | Prevents iOS auto-zoom |
| Long text | `wordBreak: 'break-word'` | Prevents horizontal overflow |
| Contrast | Secondary text `#9ca3af` not `#6b7280` for key info | Legibility |
| Max line width | ~65-75 characters per line | Optimal reading speed |

### Pillar 4: Layout Adaptation
| Check | Standard | Why |
|-------|----------|-----|
| Grid collapse | Multi-column → single-column on mobile | Content fits viewport |
| Flex direction | Row → column for complex layouts | Vertical scrolling is natural |
| Side-by-side | Use tabs or accordion instead of side-by-side on mobile | Each section gets full width |
| Tables | Horizontal scroll with `minWidth` or card transformation | Data remains readable |
| Modals | Bottom sheet pattern with `borderRadius: '16px 16px 0 0'` | Thumb-reachable dismiss |
| Fixed elements | Must not overlap content, respect safe areas | Nothing hidden |

### Pillar 5: Micro-Interactions & Polish
| Check | Standard | Why |
|-------|----------|-----|
| Transitions | `transition: 'all 0.2s ease'` on interactive elements | Smooth, not instant |
| Hover → Active | Replace `:hover` effects with `:active` on mobile | Touch feedback |
| Loading states | Skeleton screens or subtle spinners, never blank | Perceived performance |
| Empty states | Friendly message + CTA, never blank container | Guides the user |
| Error states | Inline validation, not alert() | Non-disruptive |
| Scroll indicators | Fade edges on horizontal scroll containers | Signals scrollability |

### Pillar 6: Premium Details
| Check | Standard | Why |
|-------|----------|-----|
| Border radius | `12px`-`16px` for cards, `8px` for buttons | Modern, premium feel |
| Shadow depth | Subtle `boxShadow` on elevated elements | Visual hierarchy |
| Icon alignment | Icons vertically centered with text (`alignItems: 'center'`) | Polish |
| Button text | Centered both horizontally and vertically | `justifyContent: 'center'` |
| Chip/badge alignment | `display: 'inline-flex'`, `alignItems: 'center'` | No janky offsets |
| Color consistency | All accent colors from `colors.*` tokens | Brand cohesion |
| Safe areas | `env(safe-area-inset-bottom)` on fixed bottom elements | Notch-safe |

---

## 3. Page Priority Order

Work through pages in this order (traffic-weighted):

### Tier 1 — High Traffic, Complex (Do First)
1. **`KingdomDirectory.tsx`** — Grid, filters, search, cards
2. **`KingdomProfile.tsx`** — Stats, charts, tabs, fund CTA
3. **`TransferBoard.tsx`** — Listings, recruiter dashboard, forms
4. **`Rankings.tsx`** — Tables, sort, filters
5. **`Profile.tsx`** — Settings, linked accounts, avatar

### Tier 2 — Medium Traffic
6. **`SupportAtlas.tsx`** — Pricing, checkout
7. **`Tools.tsx`** — Tool cards grid
8. **`CompareKingdoms.tsx`** — Side-by-side (challenging on mobile)
9. **`KvKSeasons.tsx`** — History tables
10. **`About.tsx`** — Content page
11. **`GiftCodeLanding.tsx`** — Marketing page

### Tier 3 — Lower Traffic
12. **`UserDirectory.tsx`** — Player cards
13. **`Ambassadors.tsx`** — Referral grid
14. **`Changelog.tsx`** — Timeline
15. **`MissingDataRegistry.tsx`** — Data table

### Shared Components (Do After Pages)
16. **`Header.tsx`** — Navigation, mobile menu
17. **`KingdomCard.tsx`** / **`MiniKingdomCard.tsx`** — Card layouts
18. **`KingdomListingCard.tsx`** — Transfer hub listings
19. **`AuthModal.tsx`** — Login/signup modal
20. **`Toast.tsx`** — Notification positioning

---

## 4. Fix Patterns (Copy-Paste Ready)

### 4.1 Responsive Container
```tsx
const isMobile = useIsMobile();

<div style={{
  width: '100%',
  maxWidth: '1200px',
  margin: '0 auto',
  padding: isMobile ? '1rem' : '2rem',
  boxSizing: 'border-box',
}}>
```

### 4.2 Mobile Grid → Stack
```tsx
<div style={{
  display: 'grid',
  gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: isMobile ? '0.75rem' : '1.25rem',
}}>
```

### 4.3 Premium Button
```tsx
<button style={{
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  padding: isMobile ? '0.75rem 1.25rem' : '0.5rem 1rem',
  minHeight: isMobile ? '44px' : 'auto',
  fontSize: isMobile ? '0.9rem' : '0.85rem',
  fontWeight: 600,
  borderRadius: '8px',
  border: 'none',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  WebkitTapHighlightColor: 'transparent',
}}>
```

### 4.4 Bottom Sheet Modal
```tsx
// Overlay
<div style={{
  position: 'fixed', inset: 0,
  backgroundColor: 'rgba(0,0,0,0.6)',
  backdropFilter: 'blur(4px)',
  zIndex: 1000,
  display: 'flex',
  alignItems: isMobile ? 'flex-end' : 'center',
  justifyContent: 'center',
}}>
  {/* Sheet */}
  <div style={{
    width: isMobile ? '100%' : '500px',
    maxHeight: isMobile ? '85vh' : '80vh',
    backgroundColor: colors.surface,
    borderRadius: isMobile ? '16px 16px 0 0' : '16px',
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    paddingBottom: isMobile ? 'max(1.5rem, env(safe-area-inset-bottom))' : '1.5rem',
  }}>
```

### 4.5 Horizontal Scroll with Fade
```tsx
<div style={{
  overflowX: 'auto',
  WebkitOverflowScrolling: 'touch',
  scrollbarWidth: 'none',
  maskImage: 'linear-gradient(to right, transparent, black 1rem, black calc(100% - 1rem), transparent)',
  WebkitMaskImage: 'linear-gradient(to right, transparent, black 1rem, black calc(100% - 1rem), transparent)',
}}>
```

### 4.6 Mobile Card
```tsx
<div style={{
  backgroundColor: colors.card,
  borderRadius: '12px',
  border: `1px solid ${colors.border}`,
  padding: isMobile ? '1rem' : '1.25rem',
  width: '100%',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s ease',
}}>
```

### 4.7 Stat Row (Mobile-Optimized)
```tsx
<div style={{
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0.5rem 0',
  borderBottom: `1px solid ${colors.borderSubtle}`,
}}>
  <span style={{ color: colors.textSecondary, fontSize: '0.8rem' }}>Label</span>
  <span style={{ color: colors.text, fontWeight: 600, fontSize: '0.9rem' }}>Value</span>
</div>
```

---

## 5. Execution Protocol

### For Each Page:

**Step 1: Read**
```
Read the page file completely. Identify:
- Does it import useIsMobile? If not, it needs it.
- Count hardcoded pixel widths (potential overflow sources)
- Count buttons/interactive elements (need 44px check)
- Identify grids/flex layouts (need collapse behavior)
- Identify modals/overlays (need bottom sheet pattern)
```

**Step 2: Grade**
```
Give the page a grade:
- A: Excellent mobile UX, minor tweaks only
- B: Good structure, needs polish (spacing, sizing)
- C: Functional but cramped or has overflow issues
- D: Broken on mobile (overflow, unreadable, untappable)
- F: Completely unusable on mobile
```

**Step 3: Fix (Priority Order)**
```
1. CRITICAL: Fix any horizontal overflow (content wider than viewport)
2. CRITICAL: Fix unreadable text (too small or too large)
3. HIGH: Add missing isMobile responsive logic
4. HIGH: Fix touch targets under 44px
5. MEDIUM: Improve spacing and visual hierarchy
6. MEDIUM: Convert modals to bottom sheets
7. LOW: Add micro-interactions and polish
```

**Step 4: Verify**
// turbo
```bash
cd /Users/giovanni/projects/ai/Kingshot\ Atlas/apps/web && npm run build
```

---

## 6. Anti-Patterns (Never Do These)

| Anti-Pattern | Why It's Bad | Do This Instead |
|-------------|-------------|-----------------|
| `overflow: hidden` on body/root | Breaks scroll entirely | Target specific containers |
| Removing content on mobile | Users expect feature parity | Reorganize, don't remove |
| `font-size: 12px` on mobile | Unreadable, accessibility fail | Min `14px` body, `16px` inputs |
| Inline `!important` | Maintenance nightmare | Use specificity correctly |
| `position: fixed` without safe-area | Overlaps notch/home indicator | Always add safe-area padding |
| `hover:` without `active:` fallback | No feedback on touch | Add active states for mobile |
| Tight button spacing | Mis-tap nightmare | Min `8px` gap between tappables |
| Desktop-width modals on mobile | Can't see/scroll content | Bottom sheet pattern |
| Wrapping text in `nowrap` | Horizontal overflow | `wordBreak: 'break-word'` |
| Hardcoded `width: 400px` | Overflows small screens | `width: '100%', maxWidth: '400px'` |

---

## 7. Quality Bar

A page is **premium-grade** when:

- No horizontal overflow at 320px viewport width
- Every button is at least 44px tall on mobile
- Every form input is at least 16px font size
- Cards have 12px+ border-radius and consistent padding
- Grids collapse to single-column cleanly
- Modals are bottom sheets on mobile
- Transitions are smooth (0.2s ease)
- Spacing feels generous, not cramped
- The page looks like it was designed mobile-first, not shoehorned
- A user testing it on their phone would say "this feels like an app"

---

## 8. After All Pages Are Done

1. **Cross-page consistency check**: Navigate between pages on mobile — do transitions feel cohesive? Are headers consistent? Is spacing uniform?
2. **Thumb zone audit**: Are the most-used CTAs in the bottom half of the screen?
3. **Performance spot-check**: Do pages feel snappy on mobile? Any janky scroll?
4. **Build verification**: `npm run build` must pass clean

---

*Last Updated: 2026-02-17*
*Workflow Level: Expert Mobile UI/UX Designer*
*Target Audience: 80% mobile users*

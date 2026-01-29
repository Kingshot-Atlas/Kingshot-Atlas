# Kingshot Atlas UI Style Guide

This document defines the visual standards for consistency across all pages and components.

---

## Design Tokens (CSS Custom Properties)

All design tokens are defined in `/src/index.css` under `:root`. Use these instead of hardcoded values.

### Usage
```css
/* In CSS */
background-color: var(--color-bg);
padding: var(--space-4);
border-radius: var(--radius-md);

/* In inline styles, import from utils/styles.ts */
import { colors, spacing, radius } from '../utils/styles';
```

### Available Tokens
| Category | Token | Value |
|----------|-------|-------|
| **Backgrounds** | `--color-bg` | `#0a0a0a` |
| | `--color-surface` | `#111111` |
| | `--color-card` | `#131318` |
| **Text** | `--color-text` | `#ffffff` |
| | `--color-text-secondary` | `#9ca3af` |
| | `--color-text-muted` | `#6b7280` |
| **Brand** | `--color-primary` | `#22d3ee` |
| | `--color-success` | `#22c55e` |
| | `--color-warning` | `#eab308` |
| | `--color-error` | `#ef4444` |
| **Spacing** | `--space-1` to `--space-12` | `0.25rem` to `3rem` |
| **Radius** | `--radius-sm/md/lg/xl` | `4px` to `16px` |

---

## Shared Utilities

Import shared utilities from `/src/utils/styles.ts`:

```tsx
import { neonGlow, getStatusColor, colors, tooltipStyles } from '../utils/styles';
```

### useIsMobile Hook

Use the shared hook instead of local state:

```tsx
import { useIsMobile } from '../hooks/useMediaQuery';

const MyComponent = () => {
  const isMobile = useIsMobile();
  // ...
};
```

---

## Card Styling

### Border Colors
- **Default card border**: `#2a2a2a` (slightly lighter than background for contrast)
- **Hover state border**: Use accent color with 50% opacity (e.g., `#22d3ee50`)
- **Card background**: `#131318` or `#111111`
- **Page background**: `#0a0a0a`

### Example
```tsx
border: `1px solid ${isHovered ? '#22d3ee50' : '#2a2a2a'}`
```

---

## Atlas Score & Rank Display

When displaying Atlas Score with Rank:
- **Atlas Score**: Bold, with neon glow effect using theme color (`#22d3ee`)
- **Rank**: Same color as Atlas Score, but **not bold** (`fontWeight: 'normal'`)
- **Format**: `Atlas Score: 12.5 (#3)` - rank in parentheses, no "Rank" text

### Example
```tsx
Atlas Score: <span style={{ fontWeight: 'bold', ...neonGlow('#22d3ee') }}>{score}</span>
{rank && <span style={{ color: '#22d3ee', fontWeight: 'normal', marginLeft: '0.25rem' }}>(#{rank})</span>}
```

---

## Tooltip Standards

All tooltips must follow these rules:

### Behavior
- **Desktop**: Show instantly on hover (`onMouseEnter`/`onMouseLeave`)
- **Mobile**: Show on tap (with toggle functionality)
- **Position**: Always appear **above** the element being hovered/tapped
- **No native `title` attributes**: Use custom tooltip components only

### Styling
```tsx
{showTooltip && (
  <div style={{
    position: 'absolute',
    bottom: '100%',           // Always above
    left: '50%',
    transform: 'translateX(-50%)',
    marginBottom: '6px',      // Or '0.5rem'
    backgroundColor: '#0a0a0a',
    border: `1px solid ${accentColor}`,  // Use relevant accent color
    borderRadius: '6px',
    padding: '0.4rem 0.6rem', // Or '0.5rem 0.75rem'
    fontSize: '0.7rem',
    color: '#fff',
    whiteSpace: 'nowrap',
    zIndex: 100,
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
  }}>
    <div style={{ color: accentColor, fontWeight: 'bold', marginBottom: '2px' }}>{title}</div>
    <div style={{ color: '#9ca3af', fontSize: '0.65rem' }}>{description}</div>
  </div>
)}
```

### Implementation Pattern
```tsx
const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

<span
  onMouseEnter={() => !isMobile && setActiveTooltip('tooltip-id')}
  onMouseLeave={() => !isMobile && setActiveTooltip(null)}
  onClick={() => isMobile && handleTooltipToggle('tooltip-id')}
  style={{ position: 'relative', cursor: 'pointer' }}
>
  {content}
  {activeTooltip === 'tooltip-id' && (
    // Tooltip JSX here
  )}
</span>
```

---

## Color Palette

### Primary Colors
- **Cyan (Primary)**: `#22d3ee`
- **Green (Success/Domination)**: `#22c55e`
- **Red (Error/Defeat)**: `#ef4444`
- **Yellow (Prep Phase)**: `#eab308`
- **Orange (Battle Phase)**: `#f97316`
- **Blue (Comeback)**: `#3b82f6`
- **Purple (Reversal)**: `#a855f7`
- **Gold (Achievement)**: `#fbbf24`

### Background Colors
- **Page**: `#0a0a0a`
- **Card**: `#131318` or `#111111`
- **Tooltip/Modal**: `#0a0a0a`
- **Subtle background**: `{color}15` (15% opacity)

### Text Colors
- **Primary text**: `#fff`
- **Secondary text**: `#9ca3af`
- **Muted text**: `#6b7280`

### Border Colors
- **Default**: `#2a2a2a`
- **Subtle**: `#1f1f1f`
- **Accent border**: `{color}40` (40% opacity)

---

## Percentage Display

When showing percentages alongside values:
- **Color**: Match the outcome/stat color (not gray)
- **Weight**: Normal (not bold)
- **Size**: Slightly smaller than the value (`0.65rem` - `0.7rem`)

### Example
```tsx
<span style={{ fontWeight: 'bold', color: '#22c55e' }}>{value}</span>
<span style={{ fontSize: '0.65rem', color: '#22c55e', fontWeight: 'normal' }}>({percent}%)</span>
```

---

## Neon Glow Effect

For emphasizing important values:
```tsx
const neonGlow = (color: string) => ({
  color: color,
  textShadow: `0 0 8px ${color}40, 0 0 12px ${color}20`
});
```

---

## Power Tier Colors

| Tier | Color | Hex | Tailwind Class |
|------|-------|-----|----------------|
| **S-Tier** | Gold | `#fbbf24` | `tier-s` |
| **A-Tier** | Green | `#22c55e` | `tier-a` |
| **B-Tier** | Blue | `#3b82f6` | `tier-b` |
| **C-Tier** | Orange | `#f97316` | `tier-c` |
| **D-Tier** | Red | `#ef4444` | `tier-d` |

### Usage
```tsx
// Tailwind classes
<span className="badge-tier-s">S-Tier</span>
<span className="badge-tier-a">A-Tier</span>

// JavaScript (from utils/styles.ts)
import { tierColors, getTierColor } from '../utils/styles';
const color = getTierColor('S'); // Returns '#fbbf24'
```

---

## Avatar Image Caching

When displaying user avatar images, always use cache-busting to ensure fresh images:

```tsx
import { getCacheBustedAvatarUrl } from '../contexts/AuthContext';

// Always use cache-busted URL when rendering
<img src={getCacheBustedAvatarUrl(profile.avatar_url)} alt="" />
```

**Why?** Avatar URLs are stored clean (without timestamps) in localStorage. Cache-busting is applied at render time to ensure browsers always fetch the latest image, preventing stale cached avatars on regular refresh (Command+R).

---

## Responsive Design

- Use `useIsMobile()` hook from `../hooks/useMediaQuery`
- Adjust padding, font sizes, and layouts for mobile
- Tooltips should work with tap on mobile, hover on desktop

### Breakpoints
| Name | Width | Hook |
|------|-------|------|
| Mobile | < 768px | `useIsMobile()` |
| Tablet | 768px - 1023px | `useIsTablet()` |
| Desktop | ≥ 1024px | `useIsDesktop()` |

---

## Accessibility

### Focus States
All interactive elements have `:focus-visible` styles defined in `index.css`. The default is a 2px cyan outline.

### Reduced Motion
The app respects `prefers-reduced-motion: reduce`. All animations are disabled for users who prefer reduced motion.

```css
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; }
}
```

### Color Contrast
- Use `--color-text-secondary` (`#9ca3af`) instead of `--color-text-muted` (`#6b7280`) when better contrast is needed
- All text should meet WCAG 2.1 AA contrast ratios (4.5:1 for normal text)

---

## Native Title Attributes

**IMPORTANT:** Do NOT use native HTML `title` attributes for tooltips.

### Why?
- Native titles have inconsistent styling across browsers
- They cannot be styled to match our design system
- They don't work well on mobile (no tap support)
- They have a delay before appearing

### Instead Use:
1. **Custom tooltips** following the tooltip standards above
2. **`aria-label`** for accessibility when visual tooltip isn't needed
3. **The shared `Tooltip` component** from `/components/shared/Tooltip.tsx`

### Examples
```tsx
// ❌ Wrong: Native title
<button title="Delete item">🗑️</button>

// ✅ Correct: aria-label for simple cases
<button aria-label="Delete item">🗑️</button>

// ✅ Correct: Custom tooltip for rich content
<Tooltip content={<TooltipContent />}>
  <button>🗑️</button>
</Tooltip>
```

---

## Centralized Style Utilities

All design tokens and style utilities are available in `/src/utils/styles.ts`. **Always import from here instead of hardcoding values.**

### Available Exports

```tsx
import { 
  // Colors
  colors,           // Full color palette object
  tierColors,       // Power tier colors (S, A, B, C, D)
  getTierColor,     // Get color for a tier
  getStatusColor,   // Get color for transfer status
  outcomeColors,    // KvK outcome colors (domination, comeback, etc.)
  
  // Spacing & Layout
  spacing,          // Spacing scale (1-12)
  radius,           // Border radius presets (sm, md, lg, xl, full)
  
  // Effects
  neonGlow,         // Text glow effect
  neonGlowStrong,   // Stronger glow for emphasis
  shadows,          // Shadow presets (sm, card, cardHover, tooltip, glow)
  
  // Transitions
  transitions,      // Duration values (fast, base, slow)
  transition,       // Full transition strings (fast, base, slow, colors, transform)
  
  // Card Utilities
  cardStyles,       // Base and hover card styles
  getCardStyles,    // Get card styles with hover state
  cardBorder,       // Dynamic border based on hover
  cardShadow,       // Dynamic shadow based on hover
  
  // Tooltip
  tooltipStyles,    // Standard tooltip styles
} from '../utils/styles';
```

### Usage Examples

```tsx
// Using colors
<div style={{ backgroundColor: colors.surface, color: colors.textSecondary }}>

// Using transitions
<button style={{ transition: transition.fast }}>

// Using shadows
<div style={{ boxShadow: shadows.card }}>

// Using card styles
<div style={getCardStyles(isHovered)}>

// Using neon glow
<span style={neonGlow(colors.primary)}>Score: 12.5</span>
```

---

## Reusable Card Component

Use the shared `Card` component for consistent card styling:

```tsx
import { Card } from '../components/shared';

// Basic card
<Card>Content here</Card>

// Hoverable card with click
<Card hoverable onClick={() => navigate('/somewhere')}>
  Clickable content
</Card>

// Custom accent color and padding
<Card hoverable accentColor={colors.success} padding="lg">
  Success themed card
</Card>
```

### Card Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `hoverable` | boolean | false | Enable hover effects |
| `accentColor` | string | `#22d3ee` | Hover border color |
| `padding` | `'none'` \| `'sm'` \| `'md'` \| `'lg'` | `'md'` | Padding preset |
| `variant` | `'default'` \| `'elevated'` | `'default'` | Card variant |
| `onClick` | function | - | Click handler |
| `style` | CSSProperties | - | Additional styles |
| `className` | string | - | Additional classes |

---

---

## Outcome Emojis

| Outcome | Emoji | Color | Description |
|---------|-------|-------|-------------|
| **Domination** | 👑 | `#22c55e` | Won both Prep and Battle |
| **Reversal** | 🔄 | `#a855f7` | Won Prep but lost Battle |
| **Comeback** | 💪 | `#3b82f6` | Lost Prep but won Battle |
| **Invasion** | 💀 | `#ef4444` | Lost both Prep and Battle |

**Note:** The Invasion emoji was changed from 🏳️ to 💀 on 2026-01-29 for better visual impact.

---

## Terminology Standards

| Use This | Not This |
|----------|----------|
| Rankings | Leaderboards |
| Compare | Comparison |
| Back to Home | Back to Directory |
| Recent Performance | Recent Form / Recent KvKs |

---

*Last Updated: 2026-01-29 by Design Lead*

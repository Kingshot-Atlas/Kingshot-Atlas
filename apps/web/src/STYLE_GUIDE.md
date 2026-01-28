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
- **S-Tier**: `#fbbf24` (Gold)
- **A-Tier**: `#22c55e` (Green)
- **B-Tier**: `#3b82f6` (Blue)
- **C-Tier**: `#6b7280` (Gray)

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

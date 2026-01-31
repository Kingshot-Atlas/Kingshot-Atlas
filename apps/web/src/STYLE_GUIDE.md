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

## Typography

### Font Families
| Token | Font | Usage |
|-------|------|-------|
| `--font-sans` | Inter | Body text, UI elements |
| `--font-display` | Cinzel | Page titles, hero headings, brand elements |
| `--font-mono` | Orbitron | Numbers, stats, technical data |

### Usage
```tsx
// Page titles - use Cinzel
<h1 style={{ fontFamily: "'Cinzel', 'Times New Roman', serif" }}>UPGRADE TO PRO</h1>

// Or use CSS variable
<h1 style={{ fontFamily: 'var(--font-display)' }}>Page Title</h1>

// Body text - Inter (default, no need to specify)
<p>Regular content</p>

// Stats/numbers - Orbitron
<span style={{ fontFamily: "'Orbitron', monospace" }}>12.5</span>
```

### Font Weight Guidelines
- **Page titles (Cinzel)**: 700-900 (bold to black)
- **Body text (Inter)**: 400-600 (normal to semibold)
- **Stats (Orbitron)**: 500-700 (medium to bold)

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

### Score Contribution Format
For Atlas Score breakdowns, show both weighted contribution AND raw value:
```tsx
<span style={{ fontWeight: 'bold', color: '#22d3ee' }}>+18.8%</span>
<span style={{ fontSize: '0.55rem', color: '#4a4a4a', fontWeight: 'normal' }}>(75%)</span>
```
Format: `+18.8% (75%)` - weighted contribution (raw win rate)

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

## Subscription Tier Colors

| Tier | Color | Hex | Usage |
|------|-------|-----|-------|
| **Atlas Pro** | Cyan | `#22d3ee` | Pro buttons, badges, price text, role indicators |
| **Atlas Recruiter** | Purple | `#a855f7` | Recruiter buttons, badges, price text, role indicators |

### Usage Examples
```tsx
// Pro tier styling
<button style={{ backgroundColor: '#22d3ee', color: '#000' }}>Upgrade to Pro</button>
<span style={{ color: '#22d3ee' }}>$3.33/month</span>

// Recruiter tier styling
<button style={{ backgroundColor: '#a855f7', color: '#fff' }}>Upgrade to Recruiter</button>
<span style={{ color: '#a855f7' }}>$9.99/month</span>
```

### Role Badges
- **Pro badge**: Cyan background with dark text, star icon (⭐)
- **Recruiter badge**: Purple background with white text, crown icon (👑)

### Pro Feature Unlock Buttons (SOURCE OF TRUTH)

When showing buttons to unlock Pro features (e.g., Score Simulator, Multi-Compare), use this exact pattern:

```tsx
// ✅ CORRECT: Pro feature unlock button
<Link
  to="/upgrade"
  style={{
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.6rem 1.25rem',
    background: 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)',
    border: 'none',
    borderRadius: '8px',
    color: '#000',  // Dark text on cyan
    fontSize: '0.85rem',
    fontWeight: '600',
    textDecoration: 'none',
    boxShadow: '0 0 15px rgba(34, 211, 238, 0.3)',
    transition: 'transform 0.2s, box-shadow 0.2s'
  }}
>
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
  </svg>
  Unlock Feature
</Link>

// ❌ WRONG: Purple is for Recruiter, not Pro
background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)'
```

### Pro Badge (Inline)

For inline Pro badges next to feature names:

```tsx
<span style={{
  padding: '0.15rem 0.4rem',
  backgroundColor: '#22d3ee15',
  border: '1px solid #22d3ee40',
  borderRadius: '4px',
  fontSize: '0.6rem',
  color: '#22d3ee',
  fontWeight: 'bold'
}}>
  PRO
</span>
```

### Pro Upsell Banner

For subtle "Go Pro" messaging:

```tsx
<div style={{
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.5rem 0.75rem',
  backgroundColor: '#22d3ee10',
  border: '1px solid #22d3ee30',
  borderRadius: '8px'
}}>
  <span style={{
    padding: '0.2rem 0.5rem',
    backgroundColor: '#22d3ee',
    color: '#000',
    borderRadius: '4px',
    fontSize: '0.7rem',
    fontWeight: 'bold'
  }}>
    ★ PRO
  </span>
  <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>
    Go Pro to unlock this feature
  </span>
</div>
```

**Key Rules:**
1. **Pro = Cyan (`#22d3ee`)** - Always use cyan for Pro features
2. **Recruiter = Purple (`#a855f7`)** - Only use purple for Recruiter features
3. **Text color on solid cyan buttons**: Always `#000` (black)
4. **Text color on solid purple buttons**: Use `#fff` (white)
5. **Star icon (★)**: Use for Pro badges
6. **Crown icon (👑)**: Use for Recruiter badges

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

## Buttons & Chips (IMPORTANT)

**All buttons and chips MUST be center and middle aligned.** This ensures consistent touch targets and visual balance across the entire app.

### Required Alignment
```tsx
// ✅ CORRECT: Always include these alignment properties
<button style={{
  display: 'inline-flex',        // or 'flex' for full-width
  alignItems: 'center',          // Vertical centering
  justifyContent: 'center',      // Horizontal centering
  gap: '0.5rem',                 // Space between icon and text
  // ... other styles
}}>
  <Icon /> Button Text
</button>

// ❌ WRONG: Missing alignment
<button style={{ padding: '0.5rem 1rem' }}>
  <Icon /> Button Text
</button>
```

### Use Shared Button Styles
```tsx
import { buttonStyles, chipStyles } from '../utils/styles';

// Apply base button styles
<button style={{ ...buttonStyles.base, ...buttonStyles.primary }}>
  Action
</button>

// Apply chip styles
<span style={chipStyles.base}>
  Tag
</span>
```

### Button Variants
| Variant | Background | Text | Border |
|---------|------------|------|--------|
| **Primary** | `#22d3ee` | `#000` | none |
| **Secondary** | transparent | `#22d3ee` | `1px solid #22d3ee40` |
| **Danger** | transparent | `#ef4444` | `1px solid #ef444440` |
| **Ghost** | transparent | `#9ca3af` | `1px solid #2a2a2a` |

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

### Mobile Touch Targets (IMPORTANT)
All interactive elements MUST meet minimum touch target sizes on mobile:
- **Buttons**: `minHeight: 44px` (iOS) or `48px` (Material Design)
- **Links/Clickable areas**: `minHeight: 44px`, `minWidth: 44px`
- **Form inputs**: `minHeight: 44px`, `fontSize: 16px` (prevents iOS zoom)

```tsx
// Example: Mobile-friendly button
<button
  style={{
    padding: isMobile ? '0.75rem 1rem' : '0.5rem 0.75rem',
    minHeight: isMobile ? '44px' : 'auto',
    minWidth: isMobile ? '44px' : 'auto',
    fontSize: isMobile ? '1rem' : '0.875rem'
  }}
>
  Action
</button>
```

### Safe Area Insets
For components at screen edges (modals, bottom sheets, toasts), support notched devices:
```tsx
paddingBottom: isMobile ? 'max(1rem, env(safe-area-inset-bottom))' : '1rem'
```

### Mobile-Specific Patterns
- **Bottom sheets**: Use `alignItems: 'flex-end'` for mobile modals
- **Hover states**: Disable on mobile (`if (!isMobile) { ... }`)
- **Touch feedback**: Add `transform: scale(0.98)` on touch for buttons

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
  subscriptionColors, // Subscription tier colors (pro, recruiter)
  getSubscriptionColor, // Get color for subscription tier
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

## Data Visualization

### Radar Charts
Use the shared `RadarChart` component for single-dataset visualizations:
```tsx
import RadarChart from '../components/RadarChart';

<RadarChart 
  data={[
    { label: 'Prep Win', value: 75 },
    { label: 'Battle Win', value: 82 },
    // ...
  ]}
  accentColor="#22d3ee"
  size={260}
  animated={true}
/>
```

### Comparison Radar Charts
Use the shared `ComparisonRadarChart` component for multi-dataset visualizations:
```tsx
import ComparisonRadarChart from '../components/ComparisonRadarChart';

<ComparisonRadarChart
  datasets={[
    {
      label: 'Kingdom 172',
      data: [{ label: 'Prep Win', value: 75 }, ...],
      color: '#22d3ee'
    },
    {
      label: 'Kingdom 145',
      data: [{ label: 'Prep Win', value: 82 }, ...],
      color: '#a855f7'
    }
  ]}
  size={300}
  animated={true}
/>
```

### Chart Standards
- **Mobile size**: 200-240px
- **Desktop size**: 260-300px
- **Animation**: 600-800ms ease-out
- **Colors**: Use brand color palette
- **Accessibility**: Keyboard navigation, screen reader support

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

*Last Updated: 2026-01-30 by Design Lead*

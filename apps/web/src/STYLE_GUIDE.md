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
- **Default card border**: `colors.border` (`#2a2a2a`) — slightly lighter than background for contrast
- **Hover state border**: Use accent color with 50% opacity (e.g., `#22d3ee50`)
- **Card background**: `colors.card` (`#131318`) or `colors.surface` (`#111111`)
- **Page background**: `colors.bg` (`#0a0a0a`)

### Example
```tsx
border: `1px solid ${isHovered ? '#22d3ee50' : colors.border}`
```

---

## Hardcoded Hex → Design Token Mapping

**Always use design tokens from `utils/styles.ts` instead of raw hex values in inline styles.**

| Hex Value | Design Token | Category | Notes |
|-----------|-------------|----------|-------|
| `#0a0a0a` | `colors.bg` | Background | Page / modal backgrounds |
| `#111111` | `colors.surface` | Background | Card surfaces, elevated areas |
| `#131318` | `colors.card` | Background | Card component default |
| `#1a1a1a` | `colors.surfaceHover` | Background | Hover states on surfaces |
| `#1f1f1f` | `colors.borderSubtle` | Border | Subtle dividers |
| `#2a2a2a` | `colors.border` | Border | Default borders |
| `#3a3a3a` | `colors.borderStrong` | Border | Emphasized borders |
| `#ffffff` / `#fff` | `colors.text` | Text | Primary text |
| `#9ca3af` | `colors.textSecondary` | Text | Secondary / descriptive text |
| `#6b7280` | `colors.textMuted` | Text | Muted / disabled text |
| `#22d3ee` | `colors.primary` | Brand | Primary accent (cyan) |
| `#22c55e` | `colors.success` | Brand | Success states (green) |
| `#eab308` | `colors.warning` | Brand | Warnings (yellow) |
| `#ef4444` | `colors.error` | Brand | Errors (red) |
| `#f97316` | `colors.orange` | Brand | Orange accent |
| `#a855f7` | `colors.purple` | Brand | Purple accent |
| `#3b82f6` | `colors.blue` | Brand | Blue accent |
| `#fbbf24` | `colors.gold` | Brand | Gold / achievement |
| `#f59e0b` | `colors.amber` | Brand | Amber accent (admin gold, warm CTA) |
| `#ec4899` | `colors.pink` | Brand | Pink accent (billing, profile views) |
| `#cd7f32` | `colors.bronze` | Brand | Bronze tier |

### Opacity Variants (Template Literal Pattern)

Use template literals to combine a token with a hex opacity suffix:

```tsx
// ✅ Correct — token + opacity suffix
backgroundColor: `${colors.primary}20`   // 12% opacity cyan
border: `1px solid ${colors.error}40`     // 25% opacity red

// ❌ Wrong — hardcoded hex with opacity
backgroundColor: '#22d3ee20'
border: '1px solid #ef444440'
```

### Ternary Expressions

Replace both branches when matching tokens exist:

```tsx
// ✅ Correct
color: isActive ? colors.success : colors.error
backgroundColor: isActive ? `${colors.success}20` : `${colors.error}20`

// ❌ Wrong
color: isActive ? '#22c55e' : '#ef4444'
```

### When NOT to Replace
- **SVG `stroke`/`fill` attributes** in embedded inline SVGs — acceptable to keep as hex
- **CSS `url()` encoded colors** (e.g., SVG data URIs in `backgroundImage`) — hex is required
- **One-off colors** with no matching token (e.g., `#a24cf3` ambassador purple) — document as exceptions
- **Gradient shade variations** (e.g., `#b87333`, `#da8a45` bronze shades in shimmer gradients) — acceptable as hex
- **Chart/palette arrays** (e.g., `BAR_COLORS`, `RALLY_COLORS`) — isolated color arrays for data visualization

### Migration Coverage

The following admin tab components have been fully migrated to design tokens:

| Component | Status |
|-----------|--------|
| `EmailTab.tsx` | ✅ Migrated |
| `AnalyticsOverview.tsx` | ✅ Migrated |
| `BattlePlannerAccessTab.tsx` | ✅ Migrated |
| `CorrectionsTab.tsx` | ✅ Migrated |
| `FeedbackTab.tsx` | ✅ Migrated |
| `NewKingdomsTab.tsx` | ✅ Migrated |
| `TransferHubAdminTab.tsx` | ✅ Migrated |
| `GiftCodeAnalyticsTab.tsx` | ✅ Migrated |
| `KvKErrorsTab.tsx` | ✅ Already tokenized |
| `SubmissionsTab.tsx` | ✅ Already tokenized |

**Pages & Components (newly migrated this session):**

| Component | Status |
|-----------|--------|
| `GiftCodeRedeemer.tsx` | ✅ Migrated (amber, purple tokens) |
| `SupportAtlas.tsx` | ✅ Migrated (amber token) |
| `BattlePlannerLanding.tsx` | ✅ Migrated (amber, error tokens) |
| `Profile.tsx` | ✅ Migrated (amber token) |
| `KvKSeasons.tsx` | ✅ Migrated (bronze, gold, borderStrong tokens) |
| `KingdomListingCard.tsx` | ✅ Migrated (bronze token) |
| `KingdomFundContribute.tsx` | ✅ Migrated (gold, bronze, textSecondary, textMuted tokens) |
| `KingdomCompare.tsx` | ✅ Migrated (gold, bronze, textMuted tokens) |
| `KingdomProfileTab.tsx` | ✅ Migrated (bronze, gold, textSecondary, textMuted tokens) |
| `RecruiterDashboard.tsx` | ✅ Migrated (pink, bronze, gold tier colors) |

**Services:**

| Service | Status |
|---------|--------|
| `dataFreshnessService.ts` | ✅ Migrated (success, amber, orange, error, textMuted) |
| `notificationService.ts` | ✅ Migrated (success, error, amber, primary, purple, warning) |

**Utilities:**

| Utility | Status |
|---------|--------|
| `sharing.ts` | ✅ Migrated (gold, bronze, textSecondary fund colors) |

Previously migrated: `KingdomPlayers`, `LinkKingshotAccount`, `KingdomReviews`, `SubmissionHistory`, `KingdomDirectory`, `MissingDataRegistry`.

---

## Tailwind ↔ Design Token Alignment

The Tailwind config (`tailwind.config.js`) and `utils/styles.ts` define the **same color values** and are kept in sync:

| Tailwind Class | `colors.*` Token | Value |
|----------------|-----------------|-------|
| `bg-bg` | `colors.bg` | `#0a0a0a` |
| `bg-surface` | `colors.surface` | `#111111` |
| `bg-card` | `colors.card` | `#131318` |
| `bg-surface-hover` | `colors.surfaceHover` | `#1a1a1a` |
| `border-border` | `colors.border` | `#2a2a2a` |
| `border-border-subtle` | `colors.borderSubtle` | `#1f1f1f` |
| `text-text-primary` | `colors.text` | `#ffffff` |
| `text-text-secondary` | `colors.textSecondary` | `#9ca3af` |
| `text-text-muted` | `colors.textMuted` | `#6b7280` |
| `text-primary` | `colors.primary` | `#22d3ee` |

> **Rule:** When adding a new color to `utils/styles.ts`, also add the matching entry in `tailwind.config.js` under `theme.extend.colors`. This keeps both systems in sync.

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
| `--font-display` | **Trajan Pro** (Cinzel fallback) | Page titles, hero headings, brand elements, kingdom names, logo |
| `--font-mono` | Orbitron | Numbers, stats, technical data |

### Trajan Pro Font Setup
Trajan Pro is the primary display font for premium branding. Setup options:

1. **Self-hosted** (recommended): Add font files to `/public/fonts/` and uncomment `@font-face` in `index.css`
2. **Adobe Fonts**: Add your Typekit kit ID to `index.css`
3. **Fallback**: Cinzel (Google Fonts) loads automatically if Trajan Pro unavailable

### Two-Tone Page Title Standard
All page headers use a **two-tone color scheme**:
- **First word**: White (`#ffffff`)
- **Second word**: Cyan neon glow (`#22d3ee`) - or **Pink (`#FF6B8A`)** for Support page

```tsx
// Standard page title
<h1 style={{ fontFamily: FONT_DISPLAY }}>
  <span style={{ color: '#fff' }}>KINGDOM</span>
  <span style={{ ...neonGlow('#22d3ee') }}>RANKINGS</span>
</h1>

// Support page (pink accent)
<h1 style={{ fontFamily: FONT_DISPLAY }}>
  <span style={{ color: '#fff' }}>SUPPORT</span>
  <span style={{ ...neonGlow('#FF6B8A') }}>ATLAS</span>
</h1>
```

### FONT_DISPLAY Utility
Always import and use the `FONT_DISPLAY` constant from `utils/styles.ts`:

```tsx
import { FONT_DISPLAY, neonGlow } from '../utils/styles';

// Kingdom names in cards/profiles
<div style={{ fontFamily: FONT_DISPLAY }}>Kingdom 172</div>

// Logo text
<span style={{ fontFamily: FONT_DISPLAY }}>KINGSHOT</span>
<span style={{ fontFamily: FONT_DISPLAY, ...neonGlow('#22d3ee') }}>ATLAS</span>
```

### Usage Examples
```tsx
import { FONT_DISPLAY, neonGlow } from '../utils/styles';

// Page titles - use FONT_DISPLAY constant
<h1 style={{ fontFamily: FONT_DISPLAY }}>
  <span style={{ color: '#fff' }}>PAGE</span>
  <span style={{ ...neonGlow('#22d3ee') }}>TITLE</span>
</h1>

// Kingdom names - always use FONT_DISPLAY
<div style={{ fontFamily: FONT_DISPLAY }}>Kingdom 172</div>

// Body text - Inter (default, no need to specify)
<p>Regular content</p>

// Stats/numbers - Orbitron
<span style={{ fontFamily: "'Orbitron', monospace" }}>12.5</span>
```

### Font Weight Guidelines
- **Page titles (Trajan Pro)**: 700 (bold)
- **Kingdom names**: 700 (bold)
- **Body text (Inter)**: 400-600 (normal to semibold)
- **Stats (Orbitron)**: 500-700 (medium to bold)

### PageTitle Component (Optional)
A reusable `PageTitle` component is available at `components/PageTitle.tsx`:

```tsx
import PageTitle from '../components/PageTitle';

// Standard usage - auto-splits first word white, rest cyan
<PageTitle>KINGDOM RANKINGS</PageTitle>

// Support page with pink accent
<PageTitle accentColor="#FF6B8A">SUPPORT ATLAS</PageTitle>

// With tagline
<PageTitle tagline="Who's dominating? The data doesn't lie.">KINGDOM RANKINGS</PageTitle>
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

| Tier | Color | Hex | Icon | Usage |
|------|-------|-----|------|-------|
| **Admin** | Gold | `#f59e0b` | 👑 | Admin badges, borders, **username colors**, avatar borders, role indicators |
| **Atlas Supporter** | Pink | `#FF6B8A` | 💖 | Supporter buttons, badges, price text, role indicators |
| **Free** | Gray/White | `#6b7280` / `#ffffff` | - | Default text, no special styling |

> **⚠️ DEPRECATED:** The "Atlas Recruiter" tier (Purple `#a855f7`) was removed in v1.5.0 (2026-02-08). Code may still handle `'recruiter'` internally for backward compatibility with existing DB rows, but no new users can subscribe to this tier. Do not create new UI for the recruiter tier.

### Admin-Specific Rules
- **No "Manage Subscription" button** - Admin is not a subscription tier, so the subscription management button should be hidden
- **Username and avatar border** - Should use Admin gold (`#f59e0b`) with neon glow effect
- Pass `subscriptionTier="admin"` to components that support tier-based coloring

### Usage Examples
```tsx
// Admin tier styling (Gold)
<span style={{ color: '#f59e0b' }}>👑 ADMIN</span>
<div style={{ border: '1px solid #f59e0b' }}>Admin card</div>

// Supporter tier styling (Pink)
<button style={{ backgroundColor: '#FF6B8A', color: '#000' }}>Become a Supporter</button>
<span style={{ color: '#FF6B8A' }}>$4.99/month</span>

```

### Role Badges
- **Admin badge**: Gold background/border with crown icon (👑)
- **Supporter badge**: Pink background with dark text, pink heart icon (💖)

### ⚠️ IMPORTANT: Badge Display Names (Internal vs Display)
The internal tier name `'pro'` should ALWAYS display as **"SUPPORTER"** in user-facing badges.

| Internal Tier | Display Name | Badge Text |
|---------------|--------------|------------|
| `'admin'` | Admin | `ADMIN` or `👑 ADMIN` |
| `'pro'` | **Supporter** | `SUPPORTER` or `💖 SUPPORTER` (NOT "PRO") |
| `'recruiter'` | ~~Recruiter~~ | DEPRECATED — kept for backward compat only |
| `'free'` | - | No badge |

**Why?** "Pro" was rebranded to "Supporter" in v1.5.0. The internal tier name remains `'pro'` for backward compatibility, but all user-facing text must say "SUPPORTER".

Use `TIER_DISPLAY_NAMES` from `utils/constants.ts` for badge text.

### Supporter Feature Unlock Buttons (SOURCE OF TRUTH)

When showing buttons to unlock Supporter features (e.g., Multi-Compare), use this exact pattern:

```tsx
// ✅ CORRECT: Supporter feature unlock button
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

// ❌ WRONG: Don't use cyan gradient for Supporter buttons
background: 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)'
```

### Supporter Badge (Inline)

For inline Supporter badges next to feature names:

```tsx
<span style={{
  padding: '0.15rem 0.4rem',
  backgroundColor: '#22d3ee15',
  border: '1px solid #22d3ee40',
  borderRadius: '4px',
  fontSize: '0.6rem',
  color: '#FF6B8A',
  fontWeight: 'bold'
}}>
  SUPPORTER
</span>
```

### Supporter Upsell Banner

For subtle "Become a Supporter" messaging:

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
    ★ SUPPORTER
  </span>
  <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>
    Become a Supporter to unlock this feature
  </span>
</div>
```

**Key Rules:**
1. **Supporter = Pink (`#FF6B8A`)** - Always use pink for Supporter features
2. **Text color on solid pink buttons**: Always `#000` (black)
3. **Star icon (★)**: Use for Supporter badges
4. **Crown icon (👑)**: Reserved for Admin badges

---

## Username Color Standards (SOURCE OF TRUTH)

When displaying usernames in public-facing contexts (e.g., Linked Kingshot Account cards, kingdom reviews, player directories), use subscription-tier-based coloring:

| Tier | Color | Hex | Effect |
|------|-------|-----|--------|
| **Free** | White | `#ffffff` | Plain text, no glow |
| **Supporter** | Pink | `#FF6B8A` | With neon glow effect |
| **Admin** | Gold | `#f59e0b` | With neon glow effect |
| ~~Recruiter~~ | ~~Purple~~ | ~~`#a855f7`~~ | DEPRECATED — backward compat only |

### Implementation

```tsx
import { colors, neonGlow, subscriptionColors } from '../utils/styles';

// Get username color based on subscription tier
const getUsernameColor = (tier: 'free' | 'pro' | 'recruiter'): string => {
  switch (tier) {
    case 'pro': return subscriptionColors.pro;      // #FF6B8A (Supporter)
    case 'recruiter': return subscriptionColors.recruiter; // #22d3ee
    default: return colors.text;                     // #ffffff
  }
};

// Usage example
<span 
  style={{ 
    fontSize: '1.1rem', 
    fontWeight: '700',
    color: getUsernameColor(subscriptionTier),
    ...(subscriptionTier !== 'free' ? neonGlow(getUsernameColor(subscriptionTier)) : {})
  }}
>
  {username}
</span>
```

### Key Rules:
1. **Free users** get white (`#ffffff`) usernames with no glow effect
2. **Supporter users** get pink (`#FF6B8A`) usernames with neon glow
3. Avatar borders should match the username color for consistency
5. This coloring applies to public-facing displays (viewable by other users)

---

## Avatar Border Colors (SOURCE OF TRUTH)

When displaying user avatars in public-facing contexts (e.g., public profiles, player directories, kingdom reviews), use subscription-tier-based border colors:

| Tier | Color | Hex | Usage |
|------|-------|-----|-------|
| **Free** | White | `#ffffff` | Default border, no glow |
| **Supporter** | Pink | `#FF6B8A` | Pink border with subtle glow |
| **Admin** | Gold | `#f59e0b` | Gold border with subtle glow |

> Recruiter tier (Purple `#a855f7`) is DEPRECATED — code handles it for backward compat only.

### Implementation

```tsx
// Get border color for avatar based on subscription tier
// Supporter = Pink, Recruiter = Purple, Admin = Gold
const getTierBorderColor = (tier: 'free' | 'pro' | 'recruiter' | 'admin'): string => {
  switch (tier) {
    case 'admin': return '#f59e0b';    // Gold
    case 'recruiter': return '#a855f7'; // Purple
    case 'pro': return '#FF6B8A';       // Pink (Supporter)
    default: return '#ffffff';          // White
  }
};

// Usage in AvatarWithFallback
<AvatarWithFallback 
  avatarUrl={user.linked_avatar_url}
  username={user.linked_username}
  size={64}
  themeColor={getTierBorderColor(user.subscription_tier)}
/>
```

### Key Rules:
1. **Public profiles** always use tier-based border colors (not user's custom theme color)
2. **Own profile** can use user's custom theme color
3. Border color should be visible (2px solid minimum)
4. Consider adding subtle glow for paid tiers: `boxShadow: '0 0 10px ${color}40'`

---

## Kingdom Fund Tier Borders (SOURCE OF TRUTH)

Kingdom listings on the Transfer Hub use tier-based shimmer borders, glow effects, and badge animations based on the kingdom's fund tier. All implemented in `KingdomListingCard.tsx`.

### Tier Visual Hierarchy

| Tier | Border | Shimmer | Glow | Inner Highlight | Badge Animation | Padding |
|------|--------|---------|------|-----------------|-----------------|---------|
| **Gold** | 3px gradient (`#fbbf24` → `#d97706`) | 4s `goldShimmer` | Yes — `0 0 32px` hover | Gold tint (`#fbbf240a`) at top | `tierChipGlow` 3s | 3px |
| **Silver** | 2px gradient (`#c0c0c0` → `#8e8e8e`) | 5s `goldShimmer` | Yes — `0 0 28px` hover | Silver tint (`#c0c0c008`) at top | `tierChipGlow` 4s | 2px |
| **Bronze** | 2px gradient (`#cd7f32` → `#a0682d`) | 6s `goldShimmer` | No glow | Bronze tint (`#cd7f3206`) at top | `tierChipWarm` 5s | 2px |
| **Standard** | 1px solid `#2a2a2a` | None | None | None | None | N/A |

### Wrapper Approach
Premium tiers (Gold/Silver/Bronze) use a **wrapper div** around the card content:
- Wrapper provides the shimmer border via `linear-gradient` + `background-position` animation
- Card content sits inside with `borderRadius: 12px` and `overflow: hidden`
- Hover events are on the wrapper, not the card content
- Standard tier cards render without a wrapper

### CSS Animations (in `<style>` block)
```css
/* Shimmer border animation (shared by all premium tiers) */
@keyframes goldShimmer {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

/* Tier badge chip glow (Gold & Silver) */
@keyframes tierChipGlow {
  0%, 100% { box-shadow: 0 0 4px currentColor; }
  50% { box-shadow: 0 0 8px currentColor, 0 0 14px currentColor; }
}

/* Tier badge chip warm pulse (Bronze) */
@keyframes tierChipWarm {
  0%, 100% { box-shadow: 0 0 3px currentColor; }
  50% { box-shadow: 0 0 6px currentColor; }
}
```

### Badge Chip Classes
| Class | Animation | Text Shadow |
|-------|-----------|-------------|
| `.tier-chip-gold` | `tierChipGlow 3s` | `0 0 6px #fbbf2460` |
| `.tier-chip-silver` | `tierChipGlow 4s` | `0 0 4px #c0c0c040` |
| `.tier-chip-bronze` | `tierChipWarm 5s` | `0 0 3px #cd7f3240` |

### Why Fund? Banner
Standard tier cards show a subtle upgrade nudge above the footer:
- Background: `linear-gradient(90deg, transparent 0%, #fbbf2404 50%, transparent 100%)`
- Text: `0.6rem`, `colors.textMuted`, with gold/silver highlighted keywords
- Non-intrusive, informational only

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
  statTypeStyles,   // Stat type colors & emojis (SINGLE SOURCE OF TRUTH)
  getStatTypeStyle, // Get style for a stat type key
  
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
| `borderColor` | string | `colors.border` | Static border color |
| `marginBottom` | string | - | Bottom margin (e.g. `'1rem'`) |
| `padding` | `'none'` \| `'sm'` \| `'md'` \| `'lg'` \| `{ mobile, desktop }` | `'md'` | Padding preset or responsive object |
| `variant` | `'default'` \| `'elevated'` \| `'outlined'` | `'default'` | Card variant |
| `onClick` | function | - | Click handler |
| `style` | CSSProperties | - | Additional styles |
| `className` | string | - | Additional classes |

### Responsive Padding
Pass an object with `mobile` and `desktop` keys for responsive padding:
```tsx
<Card padding={{ mobile: '1rem', desktop: '1.5rem 2rem' }}>
  Adapts to screen size
</Card>
```

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

## Stat Type Colors & Emojis (SOURCE OF TRUTH)

**MANDATORY:** All colored text and emojis related to stat types MUST use these values.
Import from `utils/styles.ts` → `statTypeStyles` constant. Never hardcode these values.

| Stat Type | Emoji | Color | Hex | Usage |
|-----------|-------|-------|-----|-------|
| **Atlas Score** | 💎 | Cyan | `#22d3ee` | Overall score displays, Atlas Score rankings |
| **Preparation Phase** | 🛡️ | Yellow | `#eab308` | Prep win rates, prep streaks, prep records |
| **Battle Phase** | ⚔️ | Orange | `#f97316` | Battle win rates, battle streaks, battle records |
| **Domination** | 👑 | Green | `#22c55e` | Won both Prep and Battle, domination counts/streaks |
| **Comeback** | 💪 | Blue | `#3b82f6` | Lost Prep but won Battle |
| **Reversal** | 🔄 | Purple | `#a855f7` | Won Prep but lost Battle |
| **Invasion** | � | Red | `#ef4444` | Lost both Prep and Battle |

### Implementation
```tsx
import { statTypeStyles } from '../utils/styles';

// Get color and emoji for any stat type
const { color, emoji, label } = statTypeStyles.atlasScore;
// color: '#22d3ee', emoji: '💎', label: 'Atlas Score'

// Use in ranking card headers
<span style={{ color: statTypeStyles.prepPhase.color }}>
  {statTypeStyles.prepPhase.emoji} Prep Win Rate
</span>

// Use in value displays with neon glow
<span style={{ ...neonGlow(statTypeStyles.domination.color) }}>
  {statTypeStyles.domination.emoji} 5 Dominations
</span>
```

### Available Keys
| Key | Maps To |
|-----|---------|
| `statTypeStyles.atlasScore` | Atlas Score (💎 cyan) |
| `statTypeStyles.prepPhase` | Preparation Phase (🛡️ yellow) |
| `statTypeStyles.battlePhase` | Battle Phase (⚔️ orange) |
| `statTypeStyles.domination` | Domination (👑 green) |
| `statTypeStyles.comeback` | Comeback (💪 blue) |
| `statTypeStyles.reversal` | Reversal (🔄 purple) |
| `statTypeStyles.invasion` | Invasion (💀 red) |

### Rules
1. **Always use `statTypeStyles`** — never hardcode stat colors/emojis
2. **Applies everywhere** — rankings, profiles, cards, tooltips, charts
3. **Number coloring** — stat values should use the stat type color (not white/gray)
4. **Emoji placement** — in card/section headers, flanking the title
5. **Future stat types** — add to `statTypeStyles` in `utils/styles.ts` first, then use

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

## Profile Page Restrictions

**DO NOT add these elements to My Profile page:**

| Element | Reason | Alternative Location |
|---------|--------|---------------------|
| Browse Kingdoms button | Redundant - in main nav | Homepage, Header |
| Leaderboards button | Redundant - in main nav | Header nav |
| Alliance Badge display | Redundant - alliance tag shown in profile card | Profile card only |
| Data Contributions section | Redundant with My Contributions | Use SubmissionHistory component |

**Profile card info boxes (Alliance, Language, Region) must have consistent styling:**
- Font size: `0.95rem`
- Font weight: `500`
- Color: `#fff`

---

## Shared Component Library (`components/shared/`)

The shared component library is the **single source of truth** for reusable UI primitives. Always check here before creating inline equivalents.

### Actively Used Components

| Component | File | Consumers | Usage |
|-----------|------|-----------|-------|
| **SmartTooltip** | `SmartTooltip.tsx` | 16 files | Preferred tooltip — auto-positions, mobile-aware, portal-rendered |
| **TierBadge** | `TierBadge.tsx` | 2 files | S/A/B/C/D tier badge with color coding |
| **Button** | `Button.tsx` | 3 files | Styled button with variants (primary/secondary/ghost), sizes, loading state |
| **Chip** | `Chip.tsx` | 1 file | Color-coded label chip with variants (primary/success/warning/error/purple/gold) |
| **TierChip** | `Chip.tsx` | 1 file | Pre-configured Chip for tier display (S/A/B/C/D) |
| **StatBox** | `StatBox.tsx` | 1 file | Stat display card with label, value, color |

### Available But Unadopted Components

These are well-designed components that **should be used** instead of inline recreations:

| Component | File | What It Replaces |
|-----------|------|------------------|
| **Card** | `Card.tsx` | Inline `div` with `backgroundColor: colors.surface, border, borderRadius` patterns |
| **Input** | `Input.tsx` | Inline `<input style={{...}}>` with manual focus/error states |
| **TextArea** | `TextArea.tsx` | Inline `<textarea style={{...}}>` |
| **Select** | `Select.tsx` | Inline `<select style={{...}}>` |
| **Toggle** | `Toggle.tsx` | Custom toggle switches built from scratch in each component |
| **Checkbox** | `Toggle.tsx` | Custom checkbox implementations |

### Import Pattern

```tsx
// ✅ CORRECT: Import from barrel
import { SmartTooltip, Button, TierBadge } from './shared';
import { Card, Input, Select } from '../components/shared';

// ✅ ALSO CORRECT: Direct import for tree-shaking
import SmartTooltip from './shared/SmartTooltip';

// ❌ WRONG: Recreating card styling inline
<div style={{
  backgroundColor: '#1a1a1a',
  border: '1px solid #2a2a2a',
  borderRadius: '8px',
  padding: '1rem'
}}>

// ✅ RIGHT: Use the shared Card component
<Card padding="md" hoverable>
  Content here
</Card>
```

### Anti-Patterns to Avoid

1. **Inline card recreation** — Don't build card-like containers with inline `backgroundColor`/`border`/`borderRadius`. Use `<Card>` instead.
2. **Manual tooltip state** — Don't create `useState` + `onMouseEnter`/`onMouseLeave` tooltip logic. Use `<SmartTooltip>` instead.
3. **Hardcoded button styles** — Don't style `<button>` elements manually. Use `<Button variant="primary">` instead.
4. **Custom input styling** — Don't add focus rings, error states, and labels to `<input>` elements manually. Use `<Input>` instead.
5. **One-off toggle switches** — Don't build toggle/switch UI from scratch. Use `<Toggle>` instead.

### Deleted Components (for reference)

| Component | Why Removed | Replacement |
|-----------|-------------|-------------|
| `Tooltip.tsx` | Superseded | `SmartTooltip.tsx` (auto-positioning, portal) |
| `WinRateBar.tsx` | Never adopted | Inline win rate displays in components |
| `SupporterChip` | Never used | `SupporterBadge.tsx` (standalone component) |
| `VerifiedChip` | Never used | Inline verified indicators |
| `RecruiterChip` | Tier removed | Recruiter tier eliminated in v1.5.0 refactor |

---

## PageSection Component

Reusable section wrapper for consistent spacing, headers, dividers, and collapsible content.

```tsx
import { PageSection } from '../components/shared';

// Basic section with title
<PageSection title="My Section" icon="⚡">
  <p>Content here</p>
</PageSection>

// Collapsible section (default collapsed)
<PageSection title="Advanced Settings" collapsible defaultCollapsed>
  <p>Hidden by default, click header to expand</p>
</PageSection>

// With header action and divider
<PageSection
  title="Results"
  icon="📊"
  divider
  headerAction={<Button size="sm">Export</Button>}
>
  <ResultsList />
</PageSection>
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | — | Section heading text |
| `icon` | `string` | — | Emoji/icon before title |
| `spacing` | `'none' \| 'sm' \| 'md' \| 'lg'` | `'md'` | Vertical padding preset |
| `divider` | `boolean` | `false` | Show top border divider |
| `collapsible` | `boolean` | `false` | Enable collapse toggle |
| `defaultCollapsed` | `boolean` | `false` | Start collapsed |
| `headerAction` | `ReactNode` | — | Slot for buttons/links in header |
| `className` | `string` | — | Additional CSS classes |

---

## Breadcrumbs Pattern

Every page with structured `BreadcrumbList` data should also render a visible `<Breadcrumbs>` component.

```tsx
import Breadcrumbs from '../components/Breadcrumbs';
import { PAGE_BREADCRUMBS } from '../hooks/useStructuredData';

// In hero section, before <h1>
<Breadcrumbs items={PAGE_BREADCRUMBS.myPage} />
```

### Pages with visual breadcrumbs
About, Leaderboards, CompareKingdoms, Tools, TransferBoard, Changelog, SupportAtlas, AtlasBot, Ambassadors, KvKSeasons, KingdomCommunities

### Dynamic breadcrumbs
```tsx
// For kingdom profiles
<Breadcrumbs items={getKingdomBreadcrumbs(kingdomNumber)} />

// For KvK seasons
<Breadcrumbs items={seasonNum ? getSeasonBreadcrumbs(seasonNum) : PAGE_BREADCRUMBS.seasons} />
```

---

## Collapsible Content Pattern

For content-heavy pages, limit initial visible items and provide a toggle:

```tsx
const [showAll, setShowAll] = useState(false);
const INITIAL_COUNT = 5;
const visible = showAll ? allItems : allItems.slice(0, INITIAL_COUNT);

{visible.map(item => <ItemCard key={item.id} {...item} />)}

{allItems.length > INITIAL_COUNT && (
  <button onClick={() => setShowAll(!showAll)}>
    {showAll ? 'Show Less' : `Show ${allItems.length - INITIAL_COUNT} More`}
  </button>
)}
```

Used on: **Changelog** (older entries collapsed by default)

---

*Last Updated: 2026-02-15 by Design Lead — Added PageSection, Breadcrumbs pattern, collapsible content pattern*

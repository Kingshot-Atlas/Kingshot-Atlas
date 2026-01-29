# Design Lead — Latest Knowledge

**Last Updated:** 2026-01-29  
**Purpose:** Current best practices for UI design, CSS, and content strategy

---

## Modern CSS Practices (2026)

### CSS Custom Properties (Design Tokens)
```css
:root {
  /* Colors */
  --color-primary: #22d3ee;
  --color-bg: #0a0a0a;
  --color-surface: #1a1a1a;
  
  /* Spacing */
  --space-unit: 8px;
  --space-xs: calc(var(--space-unit) * 0.5);
  --space-sm: var(--space-unit);
  --space-md: calc(var(--space-unit) * 2);
  --space-lg: calc(var(--space-unit) * 3);
  
  /* Typography */
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  
  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;
}
```

### Container Queries
```css
/* Size components based on their container, not viewport */
.card-container {
  container-type: inline-size;
}

@container (min-width: 400px) {
  .card {
    display: grid;
    grid-template-columns: 1fr 2fr;
  }
}
```

### Modern Layouts
```css
/* Auto-fit grid for responsive cards */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-md);
}

/* Flexbox for alignment */
.flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}
```

---

## Tailwind CSS Patterns

### Common Utilities
```html
<!-- Card component -->
<div class="bg-surface border border-default rounded-lg p-4 hover:border-accent transition-colors">
  ...
</div>

<!-- Responsive text -->
<h1 class="text-xl md:text-2xl lg:text-3xl font-bold">
  Title
</h1>

<!-- Flex layouts -->
<div class="flex items-center justify-between gap-4">
  ...
</div>
```

### Custom Tailwind Config
```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        background: '#0a0a0a',
        surface: '#1a1a1a',
        elevated: '#2a2a2a',
        accent: '#22d3ee',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
    },
  },
};
```

---

## Typography Best Practices

### Hierarchy
```css
/* Clear visual hierarchy through size and weight */
h1 { font-size: 1.875rem; font-weight: 700; }  /* Page title */
h2 { font-size: 1.5rem; font-weight: 600; }    /* Section title */
h3 { font-size: 1.25rem; font-weight: 600; }   /* Subsection */
h4 { font-size: 1.125rem; font-weight: 500; }  /* Card title */
p  { font-size: 1rem; font-weight: 400; }      /* Body */
small { font-size: 0.875rem; }                  /* Captions */
```

### Line Height & Letter Spacing
```css
/* Headings: tighter */
h1, h2, h3 {
  line-height: 1.2;
  letter-spacing: -0.02em;
}

/* Body: comfortable */
p, li {
  line-height: 1.6;
  letter-spacing: 0;
}

/* Small text: looser */
small, .caption {
  line-height: 1.4;
  letter-spacing: 0.01em;
}
```

### Readability
- Body text minimum: **16px**
- Line length maximum: **65-75 characters**
- Contrast ratio minimum: **4.5:1** (WCAG AA)
- Large text contrast: **3:1**

---

## Color & Contrast

### Dark Theme Best Practices
```css
/* Layered surfaces create depth */
--bg-base: #0a0a0a;      /* Deepest background */
--bg-surface: #1a1a1a;   /* Cards, panels */
--bg-elevated: #2a2a2a;  /* Dropdowns, modals */

/* Text hierarchy through opacity */
--text-primary: #ffffff;
--text-secondary: rgba(255, 255, 255, 0.7);
--text-muted: rgba(255, 255, 255, 0.5);
```

### Accessible Color Contrast
| Combination | Ratio | Use |
|-------------|-------|-----|
| White on #0a0a0a | 21:1 | Primary text ✅ |
| #a0a0a0 on #0a0a0a | 7:1 | Secondary text ✅ |
| #666666 on #0a0a0a | 4.5:1 | Muted text ✅ |
| #22d3ee on #0a0a0a | 8.5:1 | Accent text ✅ |

### Color Meaning
- **Cyan (#22d3ee):** Primary actions, links, highlights
- **Green (#22c55e):** Success, positive outcomes
- **Yellow (#eab308):** Warnings, caution
- **Red (#ef4444):** Errors, destructive actions

---

## Animation Guidelines

### Performance
```css
/* ✅ Good: GPU-accelerated properties */
.animate-slide {
  transform: translateX(0);
  opacity: 1;
  transition: transform 250ms ease, opacity 250ms ease;
}

/* ❌ Bad: Layout-triggering properties */
.animate-bad {
  left: 0;
  width: 100%;
  transition: left 250ms, width 250ms;
}
```

### Timing
```css
/* Quick interactions (hover, click feedback) */
--duration-instant: 100ms;

/* Standard transitions (menus, cards) */
--duration-fast: 150ms;
--duration-normal: 250ms;

/* Meaningful animations (page transitions) */
--duration-slow: 400ms;

/* Easing */
--ease-out: cubic-bezier(0, 0, 0.2, 1);     /* Deceleration */
--ease-in: cubic-bezier(0.4, 0, 1, 1);      /* Acceleration */
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1); /* Standard */
```

### Motion Preferences
```css
/* Respect user preferences */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Responsive Breakpoints

### Standard Breakpoints
```css
/* Mobile first */
/* Default styles: 0px+ (mobile) */

/* Tablet */
@media (min-width: 768px) { }

/* Desktop */
@media (min-width: 1024px) { }

/* Large desktop */
@media (min-width: 1280px) { }

/* Extra large */
@media (min-width: 1536px) { }
```

### Touch Targets
- Minimum size: **44px × 44px**
- Minimum spacing between targets: **8px**
- Consider thumb zones on mobile

### Fluid Typography
```css
/* Scales smoothly between breakpoints */
h1 {
  font-size: clamp(1.5rem, 4vw, 2.5rem);
}
```

---

## Content Writing Guidelines

### Microcopy Principles
1. **Clear over clever** — Users should understand instantly
2. **Brief over verbose** — Respect the user's time
3. **Active over passive** — "Save changes" not "Changes will be saved"
4. **Specific over vague** — "3 players found" not "Results found"

### Button Labels
```
✅ Good          ❌ Bad
Save             Submit
Delete Player    Remove
Add to Kingdom   Add
View Details     Click Here
Try Again        Error
```

### Error Messages
```
✅ Good: "Player name is required. Enter a name to continue."
❌ Bad: "Error: Field validation failed (ERR_001)"

✅ Good: "Couldn't load players. Check your connection and try again."
❌ Bad: "Network error"
```

### Empty States
```
✅ Good:
"No players tracked yet"
"Add your first player to start tracking their stats."
[Add Player button]

❌ Bad:
"No data"
```

---

## Kingshot Atlas Specific

### Page Taglines (Brand Voice)
All page taglines follow the brand voice: competitive, data-driven, direct, punchy.

| Page | Tagline |
|------|---------|
| **Kingdom Directory** | "Know your enemy. Choose your allies. Dominate KvK." |
| **Leaderboards** | "Who's dominating? The data doesn't lie." |
| **Compare** | "Put any two kingdoms in the ring. Let the stats decide." |
| **Meta Analysis** | "The big picture across X kingdoms. No spin." |
| **Upgrade** | "Stop guessing. Start winning." |
| **Profile** | "Your command center for kingdom intel" |
| **Player Directory** | "Find allies, scout rivals, connect with the community" |

### Tier Descriptions
| Tier | Description |
|------|-------------|
| **Atlas Pro** | "For players who refuse to lose" |
| **Atlas Recruiter** | "For leaders building winning kingdoms" |

### Neon Glow Effect
```css
.neon-glow {
  text-shadow: 
    0 0 5px var(--accent-primary),
    0 0 10px var(--accent-primary),
    0 0 20px var(--accent-primary);
}
```

### Atlas Score Display
```css
/* Score: Bold with glow */
.atlas-score {
  font-weight: 700;
  color: var(--accent-primary);
  text-shadow: 0 0 10px var(--accent-glow);
}

/* Rank: Same color, NOT bold */
.atlas-rank {
  font-weight: 400;
  color: var(--accent-primary);
}
```

### Percentage Colors
- Match the outcome color (green for positive, red for negative)
- Normal weight, smaller font size than value

---

## Tools & Resources

### Design
- **Figma** for mockups and design systems
- **Lucide** for icons
- **Google Fonts** for typography

### CSS
- **Tailwind CSS** for utility classes
- **PostCSS** for processing
- **Autoprefixer** for vendor prefixes

### Testing
- **Chrome DevTools** for responsive testing
- **Contrast checker** for accessibility
- **Lighthouse** for performance

---

*Updated by Design Lead based on current design best practices.*

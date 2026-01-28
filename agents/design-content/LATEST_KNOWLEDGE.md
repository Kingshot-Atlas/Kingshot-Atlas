# Design & Content - Latest Knowledge

**Last Verified:** 2026-01-27  
**Next Review:** Before each major task

---

## Current Best Practices (2025-2026)

### CSS & Styling Trends

**Tailwind CSS Patterns**
```tsx
// Component with variants using clsx/cva
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary text-white hover:bg-primary/90",
        outline: "border border-input bg-transparent hover:bg-accent",
        ghost: "hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4",
        lg: "h-12 px-6 text-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);
```

**Modern CSS Features (2025)**
```css
/* Container queries */
@container (min-width: 400px) {
  .card { flex-direction: row; }
}

/* :has() selector */
.form:has(:invalid) .submit-btn { opacity: 0.5; }

/* Subgrid */
.grid-parent {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
}
.grid-child {
  display: grid;
  grid-template-columns: subgrid;
}

/* View transitions */
::view-transition-old(root) { animation: fade-out 0.3s; }
::view-transition-new(root) { animation: fade-in 0.3s; }
```

**Dark Mode Best Practices**
```css
:root {
  --bg: #ffffff;
  --text: #1a1a1a;
  --surface: #f5f5f5;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0a0a0a;
    --text: #f5f5f5;
    --surface: #1a1a1a;
  }
}

/* Or with class-based toggle */
.dark {
  --bg: #0a0a0a;
  /* ... */
}
```

### Typography

**Variable Fonts**
```css
@font-face {
  font-family: 'Inter';
  src: url('Inter-Variable.woff2') format('woff2-variations');
  font-weight: 100 900;
  font-display: swap;
}

/* Use optical sizing */
h1 { font-variation-settings: 'opsz' 48; }
body { font-variation-settings: 'opsz' 16; }
```

**Fluid Typography**
```css
/* Clamp for responsive sizing */
h1 {
  font-size: clamp(1.75rem, 4vw + 1rem, 3rem);
}

body {
  font-size: clamp(1rem, 0.5vw + 0.875rem, 1.125rem);
}
```

**Readability Standards**
- Body text: 16-18px minimum
- Line height: 1.5-1.7 for body
- Line length: 45-75 characters optimal
- Paragraph spacing: 1.5× line height

### Animation & Motion

**Performance-First Animations**
```css
/* Only animate transform and opacity */
.animate {
  transition: transform 200ms ease-out, opacity 200ms ease-out;
  will-change: transform;
}

/* Respect user preferences */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Framer Motion Patterns**
```tsx
// Entrance animations
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3 }}
>

// Layout animations
<motion.div layout layoutId="shared-element">

// Gesture animations
<motion.button
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
>
```

**Animation Timing Guidelines**
| Type | Duration | Easing |
|------|----------|--------|
| Micro-interactions | 100-200ms | ease-out |
| Transitions | 200-300ms | ease-in-out |
| Page transitions | 300-500ms | ease-in-out |
| Complex animations | 500-1000ms | custom curves |

### Responsive Design

**Modern Breakpoint Strategy**
```css
/* Mobile-first breakpoints */
/* Default: Mobile (0-639px) */
@media (min-width: 640px) { /* Tablet */ }
@media (min-width: 1024px) { /* Desktop */ }
@media (min-width: 1280px) { /* Large desktop */ }

/* Container queries for component-level responsiveness */
.card-container {
  container-type: inline-size;
}
```

**Fluid Spacing**
```css
/* Use clamp for fluid spacing */
.section {
  padding: clamp(1rem, 5vw, 4rem);
}

/* Or CSS custom properties with calc */
:root {
  --space-unit: clamp(0.5rem, 1vw, 1rem);
}
.element {
  margin: calc(var(--space-unit) * 2);
}
```

### Color & Contrast

**Accessible Color System**
```css
:root {
  /* Semantic colors */
  --color-success: #22c55e;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
  --color-info: #3b82f6;
  
  /* Ensure 4.5:1 contrast for text */
  --color-text-on-success: #052e16;
  --color-text-on-error: #450a0a;
}
```

**Color Tools**
- Use HSL for easier manipulation
- Test with color blindness simulators
- Verify contrast with WebAIM checker

### Content & Microcopy

**UX Writing Principles**
- **Clear over clever:** "Save changes" not "Make it so"
- **Specific over vague:** "Email sent to john@..." not "Success!"
- **Active voice:** "You deleted 3 files" not "3 files were deleted"
- **Helpful errors:** "Password needs 8+ characters" not "Invalid password"

**Button Labels**
```
✅ Good: "Save changes", "Send message", "Create account"
❌ Bad: "Submit", "OK", "Click here"
```

**Empty States**
```
✅ Good: "No projects yet. Create your first project to get started."
❌ Bad: "No data found."
```

---

## Component Patterns

### Card Pattern
```tsx
<Card className="rounded-lg border bg-card p-6 shadow-sm">
  <CardHeader className="flex items-center gap-4">
    <Avatar />
    <div>
      <CardTitle>Title</CardTitle>
      <CardDescription>Description</CardDescription>
    </div>
  </CardHeader>
  <CardContent>...</CardContent>
  <CardFooter className="flex justify-end gap-2">
    <Button variant="outline">Cancel</Button>
    <Button>Confirm</Button>
  </CardFooter>
</Card>
```

### Form Pattern
```tsx
<form className="space-y-4">
  <div className="space-y-2">
    <Label htmlFor="email">Email</Label>
    <Input id="email" type="email" placeholder="you@example.com" />
    <p className="text-sm text-muted-foreground">
      We'll never share your email.
    </p>
  </div>
  {/* Error state */}
  <p className="text-sm text-destructive" role="alert">
    Please enter a valid email address.
  </p>
</form>
```

---

## Anti-Patterns to Avoid

### Styling
❌ Inline styles for reusable patterns  
❌ Magic numbers (use tokens)  
❌ !important overuse  
❌ Deeply nested selectors

### Typography
❌ More than 2-3 font families  
❌ Text below 14px (except for legal/captions)  
❌ Low contrast text  
❌ Centered body text

### Animation
❌ Animation without purpose  
❌ Animations longer than 500ms for UI  
❌ Animating layout properties  
❌ No reduced-motion support

### Content
❌ Jargon and acronyms  
❌ Walls of text  
❌ Generic CTAs  
❌ Inconsistent terminology

---

## Resources

- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [shadcn/ui](https://ui.shadcn.com)
- [Radix Primitives](https://radix-ui.com)
- [Type Scale Calculator](https://type-scale.com)
- [Contrast Checker](https://webaim.org/resources/contrastchecker)
- [Framer Motion](https://framer.com/motion)

---

*Knowledge evolves. Verify before applying.*

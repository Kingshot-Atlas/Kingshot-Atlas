# Technical Foundation - Latest Knowledge

**Last Verified:** 2026-01-27  
**Next Review:** Before each major task

---

## Current Best Practices (2025-2026)

### TypeScript Standards

**Strict Mode Always**
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true
  }
}
```

**Type Patterns**
```typescript
// Prefer type inference where clear
const items = [1, 2, 3]; // number[] inferred

// Explicit for function signatures
function processUser(user: User): ProcessedUser { }

// Use satisfies for type checking with inference
const config = {
  api: '/api',
  timeout: 5000
} satisfies Config;

// Discriminated unions for state
type State = 
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: Data }
  | { status: 'error'; error: Error };
```

### API Design

**REST Best Practices**
```
GET    /api/resources          # List
GET    /api/resources/:id      # Get one
POST   /api/resources          # Create
PUT    /api/resources/:id      # Replace
PATCH  /api/resources/:id      # Update
DELETE /api/resources/:id      # Delete

# Filtering, sorting, pagination
GET /api/resources?status=active&sort=-created&page=2&limit=20
```

**Response Format**
```typescript
// Success
{ data: T, meta?: { page, total, ... } }

// Error
{ error: { code: string, message: string, details?: unknown } }
```

### Security Checklist

**Headers (2025 Standards)**
```
Content-Security-Policy: default-src 'self'; script-src 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), camera=()
```

**Authentication**
- Use HttpOnly, Secure, SameSite=Strict cookies for sessions
- Short-lived JWTs with refresh tokens
- Implement proper CSRF protection
- Rate limit authentication endpoints

**Input Validation**
```typescript
// Use Zod for runtime validation
const UserSchema = z.object({
  email: z.string().email(),
  age: z.number().min(0).max(150),
});

// Validate at boundaries (API routes, form submission)
const result = UserSchema.safeParse(input);
if (!result.success) {
  return { error: result.error.flatten() };
}
```

### Performance Standards

**Core Web Vitals Targets (2025)**
| Metric | Good | Needs Improvement |
|--------|------|-------------------|
| LCP | ≤2.5s | ≤4.0s |
| INP | ≤200ms | ≤500ms |
| CLS | ≤0.1 | ≤0.25 |

**Bundle Optimization**
```typescript
// Dynamic imports for code splitting
const HeavyComponent = lazy(() => import('./HeavyComponent'));

// Tree shaking friendly imports
import { specific } from 'library'; // ✅
import library from 'library';       // ❌
```

**Image Optimization**
- Use next/image or similar for automatic optimization
- Serve WebP/AVIF with fallbacks
- Implement responsive images with srcset
- Lazy load below-fold images

### Accessibility Standards (WCAG 2.2)

**New in 2.2**
- Focus Not Obscured: Focus indicator must be visible
- Dragging Movements: Provide non-dragging alternatives
- Target Size: Minimum 24x24px (44x44px recommended)

**Semantic HTML**
```html
<!-- Use native elements -->
<button> not <div onClick>
<a href> not <span onClick>
<nav>, <main>, <article>, <aside>

<!-- ARIA only when needed -->
<div role="alert" aria-live="polite">
```

**Focus Management**
```typescript
// After dynamic content changes
useEffect(() => {
  if (isOpen) {
    modalRef.current?.focus();
  }
}, [isOpen]);

// Skip links
<a href="#main-content" className="sr-only focus:not-sr-only">
  Skip to main content
</a>
```

### Database Patterns

**Query Optimization**
```sql
-- Use indexes for frequent queries
CREATE INDEX idx_users_email ON users(email);

-- Avoid SELECT *
SELECT id, name, email FROM users WHERE active = true;

-- Use EXPLAIN to analyze
EXPLAIN ANALYZE SELECT ...
```

**Connection Management**
- Use connection pooling
- Close connections properly
- Implement retry logic with backoff

### Caching Strategies

**HTTP Caching**
```
# Static assets (1 year, immutable)
Cache-Control: public, max-age=31536000, immutable

# API responses (validate)
Cache-Control: private, no-cache
ETag: "abc123"

# No caching
Cache-Control: no-store
```

**Application Caching**
- React Query for server state
- useMemo/useCallback for expensive computations
- Memoize selectors in state management

---

## Modern Stack Recommendations

### Frontend (2025-2026)
- **Framework:** Next.js 14+, Remix, or Vite + React
- **Styling:** Tailwind CSS, CSS Modules
- **State:** Zustand, Jotai, or React Query
- **Forms:** React Hook Form + Zod
- **Testing:** Vitest + Testing Library + Playwright

### Backend
- **Runtime:** Node.js 20+ or Bun
- **Framework:** Fastify, Hono, or Express
- **Validation:** Zod
- **Database:** PostgreSQL, SQLite for simple apps
- **ORM:** Prisma, Drizzle

---

## Anti-Patterns to Avoid

### Architecture
❌ Mixing data fetching and UI logic  
❌ Prop drilling through many layers  
❌ Circular imports  
❌ Any types in TypeScript

### Security
❌ Storing secrets in env files committed to git  
❌ Using innerHTML with user content  
❌ Trusting client-side validation alone  
❌ Exposing stack traces to users

### Performance
❌ Importing entire libraries  
❌ Synchronous operations blocking UI  
❌ Missing loading states  
❌ No error boundaries

---

## Verification Resources

- [MDN Web Docs](https://developer.mozilla.org)
- [web.dev](https://web.dev)
- [OWASP Cheat Sheets](https://cheatsheetseries.owasp.org)
- [WCAG Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Can I Use](https://caniuse.com)

---

*Knowledge evolves. Verify before applying.*

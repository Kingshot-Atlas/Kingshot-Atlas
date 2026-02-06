# Ops Lead — Latest Knowledge

**Last Updated:** 2026-02-06  
**Purpose:** Current best practices for DevOps, deployment, SEO, and analytics

---

## GitHub Actions Best Practices (2026)

### Basic CI Workflow
```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: apps/web/package-lock.json
      
      - name: Install dependencies
        working-directory: apps/web
        run: npm ci
      
      - name: Lint
        working-directory: apps/web
        run: npm run lint
      
      - name: Build
        working-directory: apps/web
        run: npm run build
```

### Caching Dependencies
```yaml
- name: Cache node modules
  uses: actions/cache@v4
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-
```

### Environment Variables
```yaml
env:
  VITE_API_URL: ${{ secrets.API_URL }}
  VITE_GA_ID: ${{ secrets.GA_ID }}
```

---

## Cloudflare Pages (Current - Migrated 2026-02-01)

### Project Configuration
| Setting | Value |
|---------|-------|
| **Project Name** | `kingshot-atlas` |
| **Production URL** | `https://kingshot-atlas.pages.dev` |
| **Custom Domain** | `https://ks-atlas.com` |
| **Framework Preset** | Vite |
| **Build Command** | `npm run build` |
| **Build Output** | `dist` |
| **Root Directory** | `apps/web` |

### Environment Variables (Cloudflare Dashboard)
```
NODE_VERSION=20
VITE_API_URL=https://kingshot-atlas.onrender.com
VITE_SUPABASE_URL=https://qdczmafwcvnwfvixxbwg.supabase.co
VITE_SUPABASE_ANON_KEY=(from .env)
```

### Config Files
- `apps/web/public/_headers` — Security headers (CSP, HSTS, caching)
- `apps/web/public/_redirects` — SPA routing fallback (`/* /index.html 200`)

### Why Cloudflare Pages?
- **Unlimited free deploys** (Netlify charges $0.15/deploy)
- **Unlimited bandwidth** (Netlify caps at 100GB)
- **300+ edge locations** (faster global CDN)
- **Built-in DDoS protection**

### DNS Configuration
- Nameservers: `santino.ns.cloudflare.com`, `vera.ns.cloudflare.com`
- Registrar: Namecheap (DNS delegated to Cloudflare)

---

## Legacy: Netlify (DEPRECATED - DO NOT USE)

Old site ID: `716ed1c2-eb00-4842-8781-c37fb2823eb8`
Legacy `.netlify/` directory deleted 2026-02-06.

---

## SEO Best Practices

### Meta Tags Template
```html
<head>
  <!-- Primary Meta Tags -->
  <title>Page Title | Kingshot Atlas</title>
  <meta name="title" content="Page Title | Kingshot Atlas">
  <meta name="description" content="Description of page content, 150-160 characters.">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://ks-atlas.com/page">
  <meta property="og:title" content="Page Title | Kingshot Atlas">
  <meta property="og:description" content="Description for social sharing.">
  <meta property="og:image" content="https://ks-atlas.com/og-image.png">
  
  <!-- Twitter -->
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="https://ks-atlas.com/page">
  <meta property="twitter:title" content="Page Title | Kingshot Atlas">
  <meta property="twitter:description" content="Description for Twitter.">
  <meta property="twitter:image" content="https://ks-atlas.com/og-image.png">
  
  <!-- Canonical -->
  <link rel="canonical" href="https://ks-atlas.com/page">
</head>
```

### Structured Data (JSON-LD)
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "Kingshot Atlas",
  "url": "https://ks-atlas.com",
  "description": "Strategy companion for Kingshot mobile game",
  "applicationCategory": "GameApplication",
  "operatingSystem": "Web Browser"
}
</script>
```

### robots.txt
```
User-agent: *
Allow: /

Sitemap: https://ks-atlas.com/sitemap.xml
```

### Sitemap
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://ks-atlas.com/</loc>
    <lastmod>2026-01-28</lastmod>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://ks-atlas.com/players</loc>
    <lastmod>2026-01-28</lastmod>
    <priority>0.8</priority>
  </url>
</urlset>
```

---

## Core Web Vitals Targets

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| LCP (Largest Contentful Paint) | ≤2.5s | 2.5s-4s | >4s |
| FID (First Input Delay) | ≤100ms | 100-300ms | >300ms |
| CLS (Cumulative Layout Shift) | ≤0.1 | 0.1-0.25 | >0.25 |
| INP (Interaction to Next Paint) | ≤200ms | 200-500ms | >500ms |

### Optimization Tips
- **LCP:** Optimize images, preload critical resources, use CDN
- **FID/INP:** Minimize JavaScript, defer non-critical scripts
- **CLS:** Set dimensions on images/videos, avoid inserting content above existing content

---

## Analytics Implementation

### Google Analytics 4 Setup
```typescript
// Initialize GA4
import ReactGA from 'react-ga4';

ReactGA.initialize('G-XXXXXXXXXX');

// Track page views
ReactGA.send({ hitType: 'pageview', page: window.location.pathname });

// Track events
ReactGA.event({
  category: 'Player',
  action: 'View Stats',
  label: playerId,
});
```

### Privacy-Compliant Tracking
```typescript
// Plausible (privacy-focused alternative)
// Add to index.html
<script defer data-domain="ks-atlas.com" src="https://plausible.io/js/script.js"></script>

// Track custom events
window.plausible?.('Player View', { props: { kingdom: '123' } });
```

### Event Naming Convention
```
Category_Action_Label

Examples:
- Player_View_Stats
- Event_Filter_KvK
- Navigation_Click_Home
- Search_Submit_Player
```

---

## Monitoring Setup

### Sentry Integration
```typescript
// Initialize Sentry
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: 'https://xxx@sentry.io/xxx',
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

// Wrap app
<Sentry.ErrorBoundary fallback={<ErrorFallback />}>
  <App />
</Sentry.ErrorBoundary>
```

### Uptime Monitoring
- Check every 5 minutes
- Alert on 2 consecutive failures
- Monitor: 
  - https://ks-atlas.com (homepage)
  - https://ks-atlas.com/api/health (API)

---

## Security Headers

### Recommended Headers
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://plausible.io; style-src 'self' 'unsafe-inline';
```

### HTTPS
- Always enforce HTTPS
- Redirect HTTP to HTTPS
- Use HSTS header for returning visitors

---

## Environment Variables

### Frontend (Vite)
```bash
# .env.local (not committed)
VITE_API_URL=http://localhost:8000
VITE_GA_ID=G-XXXXXXXXXX

# .env.production
VITE_API_URL=https://api.ks-atlas.com
```

### Accessing in Code
```typescript
const apiUrl = import.meta.env.VITE_API_URL;
```

### Secrets Management
- Never commit secrets to git
- Use environment variables
- Use Cloudflare Pages environment variable UI for production secrets
- Rotate secrets if exposed

---

## Deployment Checklist

### Before Deploy
- [ ] Local build succeeds (`npm run build`)
- [ ] Tests pass (if exist)
- [ ] No console errors
- [ ] Environment variables set

### Deploy
- [ ] Push to main: `git push origin main`
- [ ] Cloudflare Pages auto-deploys
- [ ] Wait for completion (~2-3 min)

### After Deploy
- [ ] Site loads correctly
- [ ] Check key pages
- [ ] Verify API connectivity
- [ ] Check error monitoring for new issues
- [ ] Log in ACTIVITY_LOG.md

### Rollback (if needed)
- Go to Cloudflare Pages dashboard → Deployments
- Select previous successful deploy → "Rollback to this deploy"
- Or: `git revert HEAD && git push origin main`

---

## Performance Budget

| Resource | Budget |
|----------|--------|
| Total JS | < 300KB (gzipped) |
| Total CSS | < 50KB (gzipped) |
| Largest image | < 200KB |
| Time to Interactive | < 3s |
| First Contentful Paint | < 1.5s |

---

## Audit Log (2026-01-29)

### Issues Fixed (Initial Audit)
| Issue | Fix Applied | Impact |
|-------|-------------|--------|
| CI used wrong API URL (`api.kingshot-atlas.com`) | Changed to `api.ks-atlas.com` | Builds now use correct production API |
| Missing `base` in build config | Set root directory to `apps/web` | Monorepo builds correctly |
| CSP blocked Plausible analytics | Added `plausible.io` to script-src and connect-src | Analytics now works |
| robots.txt missing explicit Allow | Added `Allow: /` and `Disallow: /api/` | Better SEO, API not crawled |
| Sitemap outdated, missing /kingdoms | Updated dates, added /kingdoms, removed /profile | Better SEO coverage |
| No dedicated lint script | Added `lint`, `lint:fix`, `analyze` scripts | CI linting now reliable |
| No CI concurrency control | Added concurrency group with cancel-in-progress | Saves CI minutes |
| Missing HSTS header | Added `Strict-Transport-Security` | Enforces HTTPS |

### Optimizations Applied (Follow-up)
| Optimization | Implementation | Benefit |
|--------------|----------------|---------|
| Lighthouse CI thresholds | Created `lighthouserc.js` with performance budgets | Builds fail if performance drops below 80% |
| Sitemap auto-generation | Created `scripts/generate-sitemap.js` + `prebuild` hook | Sitemap always current on deploy |
| Production-safe logging | Created `utils/logger.ts`, updated 15+ files | No console pollution in production |

### Security & Monitoring Enhancements (2026-01-29)
| Enhancement | Implementation | Benefit |
|-------------|----------------|---------|
| Enhanced Sentry config | Updated `index.tsx` with filtering, replay, releases | Better error tracking, less noise |
| Client-side rate limiting | Created `utils/rateLimiter.ts` | Prevents API abuse from frontend |
| Monitoring documentation | Created `docs/MONITORING.md` | UptimeRobot + Sentry setup guide |
| Security audit checklist | Created `docs/SECURITY_CHECKLIST.md` | Monthly security review process |
| CSP violation reporting | Added `report-uri` to `_headers` | CSP violations sent to Sentry |

### Performance Optimizations (2026-01-29)
| Optimization | Implementation | Benefit |
|--------------|----------------|---------|
| Image optimization | Created `utils/imageOptimization.ts` + `OptimizedImage` component | Lazy loading, placeholders, WebP support |
| Route lazy loading | Already in `App.tsx` with React.lazy() | Code splitting, faster initial load |
| Service worker caching | Enhanced `service-worker.js` with stale-while-revalidate | Faster repeat visits, offline support |
| Font preloading | Added `<link rel="preload">` for Cinzel font | Eliminates FOIT, faster text rendering |
| Resource hints | Added preconnect/dns-prefetch in `index.html` | Faster third-party connections |

### Current Health Status
- **CI/CD:** ✅ Healthy - concurrency control, Lighthouse CI with thresholds, lint/test/build pipeline
- **Security Headers:** ✅ All critical headers present (HSTS, CSP with reporting, X-Frame-Options, etc.)
- **SEO:** ✅ Auto-generated sitemap, robots.txt, structured data, meta tags all configured
- **Analytics:** ✅ Plausible configured and CSP-allowed
- **Monitoring:** ✅ Sentry enhanced with filtering, replay, CSP reporting (requires DSN)
- **Logging:** ✅ Production-safe logger utility - no console statements leak to production
- **Rate Limiting:** ✅ Client-side rate limiter available for API calls
- **Security:** ✅ Audit checklist created for monthly reviews
- **Performance:** ✅ Image optimization, font preloading, resource hints, enhanced service worker

### Recommendations for Future
1. ~~**Add Lighthouse CI thresholds**~~ ✅ Done
2. ~~**Add sitemap auto-generation**~~ ✅ Done
3. ~~**Remove console.log statements**~~ ✅ Done (replaced with logger utility)
4. **Consider adding preview deployments** - Auto-deploy PRs for review

---

## Discord Bot Health Architecture (2026-02-02)

### Problem: Split Process Architecture
**DON'T DO THIS:**
```bash
# start.sh - BAD PATTERN
node health.js &  # Background health server
node src/bot.js   # Main bot process
```
**Problem:** Health server returns 200 OK even when bot crashes, masking failures.

### Solution: Unified Health Server
**DO THIS:** Integrate health server directly into main application:
```javascript
// In bot.js - GOOD PATTERN
const healthServer = http.createServer((req, res) => {
  const wsStatus = client?.ws?.status ?? -1; // Null-safe
  const isHealthy = botReady && wsStatus === 0;
  res.writeHead(isHealthy ? 200 : 503, {...});
});
```

### Key Patterns for Render Services

| Pattern | Implementation |
|---------|----------------|
| **Null-safe client access** | `client?.ws?.status ?? -1` |
| **Startup grace period** | 60s window returning 200 while Discord connects |
| **Self-ping keepalive** | Every 10 min to prevent free tier spin-down |
| **Reconnection handlers** | `shardReconnecting`, `shardResume`, `resumed` events |

### Health Endpoint Response Structure
```json
{
  "status": "healthy|unhealthy",
  "discord": { "connected": true, "wsStatus": 0, "ping": 45 },
  "process": { "uptime": 3600, "memory": "45MB", "inStartupGrace": false }
}
```

### Render Discord Bot Service
- **Service:** `Atlas-Discord-bot` (srv-d5too04r85hc73ej2b00)
- **URL:** `https://atlas-discord-bot-trnf.onrender.com`
- **Health:** `https://atlas-discord-bot-trnf.onrender.com/health`
- **⚠️ NOT:** `atlas-discord-bot.onrender.com` (old/wrong URL)

---

*Updated by Ops Lead based on current DevOps best practices.*

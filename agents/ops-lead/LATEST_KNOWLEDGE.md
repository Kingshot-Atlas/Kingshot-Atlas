# Ops Lead — Latest Knowledge

**Last Updated:** 2026-02-12  
**Purpose:** Current best practices for DevOps, deployment, SEO, and analytics

---

## DMARC & Email Authentication (2026-02-12)

### DMARC Report from Google
Google sends daily DMARC aggregate reports to the `rua` email in the DMARC record. These reports show how emails from `ks-atlas.com` performed authentication checks.

### SPF Alignment Issue (Fixed 2026-02-12)
- **Problem:** `aspf=s` (strict) in DMARC record caused SPF alignment failures
- **Why:** Resend uses `send.ks-atlas.com` as envelope-from, but From header is `ks-atlas.com`. Strict requires exact match.
- **Impact:** Low — DKIM passed alignment, so emails were delivered. But if DKIM ever broke, all emails would be quarantined.
- **Fix:** Changed `aspf=s` → `aspf=r` (relaxed) in `_dmarc` TXT record on Cloudflare DNS
- **DKIM stays strict (`adkim=s`)** — DKIM domain (`ks-atlas.com`) exactly matches From header

### Current DNS Auth Records
```
_dmarc.ks-atlas.com       TXT  v=DMARC1; p=quarantine; rua=mailto:gatreno.investing@gmail.com; pct=100; adkim=s; aspf=r
ks-atlas.com              TXT  v=spf1 include:_spf.mx.cloudflare.net ~all
send.ks-atlas.com         TXT  v=spf1 include:amazonses.com ~all
resend._domainkey         CNAME (Resend-provided)
```

### Key IPs
- `54.240.9.36`, `54.240.9.37` — Amazon SES (Resend's sending infrastructure)
- These are legitimate outbound email IPs

---

## Google Search Console Indexing Audit (2026-02-12)

### GSC Status (as of 2026-02-09)
- **443 indexed** / **1.09K not indexed** (29% indexing rate)
- Soft 404: 31 pages
- Server error (5xx): 2 pages
- Alternate page with proper canonical tag: 6 pages
- Discovered - currently not indexed: 903 pages
- Crawled - currently not indexed: 150 pages
- Page with redirect: 1 page (expected — legacy redirects)

### Root Causes Identified & Fixed
1. **Hardcoded canonical URL** — `<link rel="canonical" href="https://ks-atlas.com/" />` in index.html caused ALL pages to canonicalize to homepage → "Alternate page with canonical" issues. **REMOVED 2026-02-22** (was documented as removed earlier but persisted until deep SEO audit caught it).
2. **useMetaTags didn't create canonical** — Hook only updated existing canonical, didn't create one if missing. **FIXED** to create `<link rel="canonical">` dynamically.
3. **Transfer Hub crawlable** — Gated page showed "Coming Soon" to bots → soft 404s. **Added to robots.txt disallow.**
4. **Missing sitemap entries** — `/ambassadors` and `/tools/gift-codes` were public but not in sitemap. **Added.**
5. **Empty HTML shell** — `<div id="root"></div>` gave bots no content. **Added `<noscript>` fallback** with keyword-rich content and internal links.

### Zero-Cost Edge-Side Meta Injection (Phase 2 — IMPLEMENTED 2026-02-12)
- **Solution:** Two-tier SEO middleware in `functions/_middleware.ts` using Cloudflare HTMLRewriter
- **Tier 1:** prerender.io (if `PRERENDER_TOKEN` set — optional paid upgrade)
- **Tier 2:** Free edge-side meta injection (default, $0 cost):
  - Detects search engine bots via user-agent
  - Rewrites `<title>`, `<meta description>`, `<meta og:*>`, `<meta twitter:*>` per page
  - Injects `<link rel="canonical">` and JSON-LD structured data into `<head>`
  - For `/kingdom/:id`: Fetches live data from Supabase at the edge (1hr cache) → generates title with tier, win rate, KvK count
  - For `/seasons/:id`: Season-specific meta
  - For 13 static pages: Hardcoded meta matching `PAGE_META_TAGS` in `useMetaTags.ts`
  - Falls back to generic meta with correct canonical for unknown paths
- **Cost:** $0 — Cloudflare Pages Functions free tier (100K/day) + Supabase free tier
- **What Google sees:** Every page now has unique title, description, canonical, OG tags, Twitter cards in the INITIAL HTML response (no JS needed)
- **Env vars needed:** `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (already set in Cloudflare Pages dashboard)
- **Gotcha:** `_middleware.ts` uses Cloudflare Workers APIs (HTMLRewriter, PagesFunction) — IDE shows lint errors but these are runtime types available on Cloudflare's edge
- **Gotcha:** If adding new static pages, add meta to BOTH `STATIC_META` in `_middleware.ts` AND `PAGE_META_TAGS` in `useMetaTags.ts`

### Key SEO Rules
- **NEVER** add a static `<link rel="canonical">` to index.html — the `useMetaTags` hook manages canonicals per-page
- **Every public page** must call `useMetaTags()` with a `url` property to set proper canonical
- **Gated pages** (auth-required, access-gated) must be in robots.txt `Disallow`
- **All public routes** must be in the sitemap generator's `staticRoutes` array
- **New static pages** must be added to `STATIC_META` in `_middleware.ts` for bot meta injection
- **Dynamic pages** (kingdom, season) are handled automatically by the middleware

---

## Sitemap Index with Sub-Sitemaps (2026-02-22)

`scripts/generate-sitemap.js` now produces a **sitemap index** with 3 sub-sitemaps:
- `sitemap.xml` → Sitemap index pointing to sub-sitemaps
- `sitemap-static.xml` → 18 static pages (rankings, tools, etc.)
- `sitemap-kingdoms.xml` → All kingdom profiles with **real `last_updated` timestamps from Supabase**
- `sitemap-seasons.xml` → All KvK season pages

### Key improvements over single sitemap:
- **Real lastmod** — Fetches `kingdoms.last_updated` column for accurate per-kingdom dates
- **Crawl targeting** — Google can prioritize sub-sitemaps independently
- **Cache headers** — Sub-sitemaps have `Cache-Control: public, max-age=3600` in `_headers`
- Falls back to `FALLBACK_MAX_KINGDOM=1260` / `FALLBACK_MAX_KVK=11` if Supabase unavailable
- Runs as `prebuild` hook — sitemaps always fresh before each build
- **Gotcha:** Cloudflare Pages CI must have `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` env vars

## Bot Request Caching (2026-02-22)

### If-Modified-Since / 304 Not Modified
- Middleware checks `If-Modified-Since` header on bot requests
- Returns **304** if cached version is less than 30 minutes old (saves crawl budget)
- Adds `Last-Modified` and `Cache-Control: public, max-age=1800` to all bot responses
- `X-Bot-Seo: injected` header marks responses that went through the SEO pipeline
- `X-Bot-Cache: not-modified` header marks 304 responses

### X-Robots-Tag Headers
Added `X-Robots-Tag: noindex, nofollow` in `_headers` for:
- `/api/*`, `/admin`, `/auth/*`, `/cancel-survey`
- Defense-in-depth alongside robots.txt Disallow rules

### Internal Linking for Crawl Discovery
Bot body content for `/kingdom/:id` pages now includes **Nearby Kingdoms** links:
- Links to `kingdom/{num-2}`, `kingdom/{num-1}`, `kingdom/{num+1}`, `kingdom/{num+2}`
- Creates a crawl web between kingdom pages, helping Google discover the 905 "Discovered - currently not indexed" pages

### Edge Cache TTL
- Supabase query in middleware: `cacheTtl: 1800` (was 3600)
- Bot response cache: `max-age=1800` (30 minutes)

## BreadcrumbList Structured Data (2026-02-08)

All 11 public pages + kingdom profiles now have BreadcrumbList JSON-LD:
- Static breadcrumbs: `PAGE_BREADCRUMBS` object in `useStructuredData.ts`
- Dynamic breadcrumbs: `getKingdomBreadcrumbs(num)` and `getSeasonBreadcrumbs(num)`
- Pattern: `useStructuredData({ type: 'BreadcrumbList', data: PAGE_BREADCRUMBS.pageName })`
- About page has both FAQPage + BreadcrumbList (multiple `useStructuredData` calls work fine)
- **Impact:** Google displays breadcrumbs in search results → better CTR

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

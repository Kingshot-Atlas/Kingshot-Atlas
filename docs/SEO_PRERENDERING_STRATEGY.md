# SEO Prerendering Strategy

**Last Updated:** 2026-02-05  
**Status:** Planned  
**Priority:** High (Critical for SEO)

---

## Current Problem

Kingshot Atlas is a **Single Page Application (SPA)** built with React + Vite. This means:

1. Initial HTML sent to browsers/crawlers is mostly empty (`<div id="root"></div>`)
2. Content is rendered client-side via JavaScript
3. Search engines may not fully index JavaScript-rendered content
4. Dynamic pages (1190+ kingdom profiles) are especially at risk

**Impact:** Estimated 50-70% of content may not be properly indexed by search engines.

---

## Recommended Solutions (Priority Order)

### Option 1: Cloudflare Workers + HTMLRewriter (Recommended)

**Why:** Already on Cloudflare Pages, minimal migration effort.

**How it works:**
1. Cloudflare Worker intercepts requests from search engine bots
2. Routes bot requests to a prerender service
3. Regular users get the normal SPA experience

**Implementation Steps:**
1. Create `functions/_middleware.ts` in the project root
2. Detect bot user agents (Googlebot, Bingbot, etc.)
3. For bots: fetch pre-rendered HTML from a prerender service
4. For users: serve normal SPA

**Estimated Effort:** 2-4 hours

```typescript
// functions/_middleware.ts (example)
const BOT_AGENTS = ['googlebot', 'bingbot', 'yandex', 'baiduspider', 'facebookexternalhit', 'twitterbot', 'linkedinbot'];

export async function onRequest(context) {
  const userAgent = context.request.headers.get('user-agent')?.toLowerCase() || '';
  const isBot = BOT_AGENTS.some(bot => userAgent.includes(bot));
  
  if (isBot) {
    // Route to prerender service
    const prerenderUrl = `https://service.prerender.io/${context.request.url}`;
    return fetch(prerenderUrl, {
      headers: { 'X-Prerender-Token': 'YOUR_TOKEN' }
    });
  }
  
  return context.next();
}
```

---

### Option 2: Prerender.io (Third-Party Service)

**Why:** Zero code changes, just configuration.

**How it works:**
1. Sign up for prerender.io (free tier: 250 pages/month)
2. Configure Cloudflare to proxy bot requests to prerender.io
3. Prerender.io caches rendered HTML for each URL

**Pros:**
- No code changes
- Automatic cache management
- Works immediately

**Cons:**
- Monthly cost at scale ($15-99/month for 10k+ pages)
- 250 free pages may not cover 1190+ kingdoms

**Estimated Effort:** 1 hour setup

---

### Option 3: Migrate to Next.js (Long-term)

**Why:** Native SSR/SSG support, industry standard for SEO-critical React apps.

**How it works:**
1. Migrate React components to Next.js app router
2. Use `generateStaticParams` for kingdom profiles (SSG)
3. Use `generateMetadata` for dynamic meta tags

**Pros:**
- Best SEO support (native SSR/SSG)
- Better performance (server-rendered HTML)
- Incremental Static Regeneration (ISR)
- Native support for structured data

**Cons:**
- Significant migration effort (estimate: 1-2 weeks)
- Learning curve for Next.js patterns
- May need to adjust deployment pipeline

**Estimated Effort:** 40-80 hours

---

### Option 4: Vite SSR Plugin

**Why:** Keep Vite, add SSR capability.

**How it works:**
1. Add `vite-plugin-ssr` or `vite-ssg` 
2. Configure server-side rendering for critical routes
3. Pre-render kingdom profiles at build time

**Pros:**
- Less migration than Next.js
- Keep existing Vite setup

**Cons:**
- Less mature than Next.js
- May have edge cases with existing code

**Estimated Effort:** 20-40 hours

---

## Recommended Approach

### Phase 1: Quick Win (This Week)
1. **Implement Cloudflare Workers middleware** for bot detection
2. Use **prerender.io free tier** initially
3. Monitor Google Search Console for indexing improvements

### Phase 2: Scale (Next Month)
1. If traffic grows, evaluate prerender.io paid tier vs self-hosted
2. Consider Puppeteer-based prerender service on Render

### Phase 3: Long-term (Q2 2026)
1. Evaluate Next.js migration based on:
   - SEO performance metrics
   - Development velocity needs
   - Feature requirements (ISR, streaming, etc.)

---

## Metrics to Track

| Metric | Current | Target | Tool |
|--------|---------|--------|------|
| Indexed Pages | ~10 | 1200+ | Google Search Console |
| Avg Position (Kingshot) | Unknown | Top 3 | Search Console |
| Crawl Errors | Unknown | 0 | Search Console |
| Core Web Vitals | Good | Good | Lighthouse |

---

## Quick Wins Already Implemented (2026-02-05)

1. ✅ **Expanded Sitemap** - 1211 URLs (was 5)
2. ✅ **Optimized Meta Tags** - Keywords, descriptions updated
3. ✅ **Structured Data** - WebApplication, Organization, WebSite schemas
4. ✅ **Dynamic Meta Tags** - Per-page titles and descriptions
5. ✅ **robots.txt** - Properly configured
6. ✅ **Canonical URLs** - Set on all pages

---

## Next Steps

1. [ ] Submit updated sitemap to Google Search Console
2. [ ] Set up Cloudflare Workers prerendering
3. [ ] Monitor indexing progress over 2-4 weeks
4. [ ] Evaluate Next.js migration if indexing remains poor

---

*This document outlines the SEO prerendering strategy for Kingshot Atlas.*

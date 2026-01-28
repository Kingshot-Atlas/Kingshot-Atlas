# Business & Maintenance Worklog

**Project:** Kingshot Atlas  
**Last Updated:** 2026-01-27

---

## Session: 2026-01-27

### Audit Summary

Analyzed project from Business & Maintenance perspective covering:
- SEO & Discoverability
- Analytics & Metrics
- CI/CD & DevOps
- Scalability & Maintenance

### Issues Found

| Category | Issue | Severity | Status |
|----------|-------|----------|--------|
| SEO | Missing Open Graph meta tags | Medium | ✅ Fixed |
| SEO | Missing Twitter Card meta tags | Medium | ✅ Fixed |
| SEO | No sitemap.xml | Medium | ✅ Fixed |
| SEO | robots.txt missing sitemap reference | Low | ✅ Fixed |
| SEO | Missing keywords and canonical URL | Low | ✅ Fixed |
| PWA | manifest.json had CRA defaults | Medium | ✅ Fixed |
| PWA | Wrong background color in manifest | Low | ✅ Fixed |
| PWA | theme-color inconsistent (#000000 vs #0a0a0a) | Low | ✅ Fixed |
| CI/CD | No status badge in README | Low | ✅ Fixed |
| CI/CD | Badge needs username update | Low | Pending user action |
| Analytics | No general analytics (GA4/Plausible) | Medium | Recommendation |
| SEO | No structured data (Schema.org) | Medium | Recommendation |

### Changes Made

#### 1. `apps/web/public/manifest.json`
- Updated `short_name` from "React App" to "Kingshot Atlas"
- Updated `name` from "Create React App Sample" to "Kingshot Atlas - Kingdom Database"
- Added `description` field
- Updated `theme_color` and `background_color` to `#0a0a0a` (dark theme)
- Added `purpose: "any maskable"` to icons for better PWA support
- Added `orientation` and `categories` fields
- Changed `start_url` from "." to "/" for consistency

#### 2. `apps/web/public/index.html`
- Added Open Graph meta tags (og:type, og:url, og:title, og:description, og:image, og:site_name)
- Added Twitter Card meta tags (twitter:card, twitter:title, twitter:description, twitter:image)
- Added keywords meta tag
- Added author meta tag
- Added canonical URL
- Updated theme-color from #000000 to #0a0a0a

#### 3. `apps/web/public/robots.txt`
- Added sitemap reference pointing to production URL

#### 4. `apps/web/public/sitemap.xml` (NEW)
- Created sitemap with main pages:
  - Homepage (priority 1.0, daily)
  - Leaderboards (priority 0.8, daily)
  - Compare (priority 0.8, weekly)
  - Profile (priority 0.6, weekly)
  - About (priority 0.5, monthly)

#### 5. `README.md`
- Added CI status badge (requires username update)

### Rationale

| Change | Why |
|--------|-----|
| OG/Twitter tags | Enables rich previews when links shared on social media - critical for organic growth |
| Sitemap | Helps search engines discover and index all pages efficiently |
| manifest.json | Proper PWA branding improves install experience and app store listings |
| Theme consistency | Prevents white flash on dark-themed app, better user experience |
| CI badge | Provides at-a-glance build status, builds trust with contributors |

### Pending User Actions

1. **Update CI badge URL**: Replace `YOUR_USERNAME` in README.md with actual GitHub username/org
2. **Review sitemap**: Verify all pages are correct and add kingdom profile URL pattern if needed

---

## Recommendations (Pending Approval)

See separate recommendations in session summary.

---

## Session: 2026-01-27 (Continued)

### Additional Changes Made

#### Domain-Agnostic SEO Improvements

| File | Change |
|------|--------|
| `src/hooks/useDocumentTitle.ts` | **Created** - Custom hook for dynamic page titles |
| `src/pages/KingdomDirectory.tsx` | Added `useDocumentTitle('Kingdom Directory')` |
| `src/pages/KingdomProfile.tsx` | Added `useDocumentTitle('Kingdom ${number}')` |
| `src/pages/Leaderboards.tsx` | Added `useDocumentTitle('Leaderboards')` |
| `src/pages/CompareKingdoms.tsx` | Added `useDocumentTitle('Compare Kingdoms')` |
| `src/pages/About.tsx` | Added `useDocumentTitle('About')` |
| `src/pages/Profile.tsx` | Added `useDocumentTitle('My Profile'/'User Profile')` |
| `public/index.html` | Added Schema.org WebApplication structured data |
| `src/index.tsx` | Enhanced Web Vitals reporting with dev console output |

#### CI/CD Improvements

| File | Change |
|------|--------|
| `.github/workflows/ci.yml` | Added Lighthouse CI job for automated performance audits |
| `.github/workflows/ci.yml` | Added build artifact upload for faster subsequent jobs |

---

## Session: 2026-01-27 (Final)

### Zero-Cost Hosting Stack Configuration

Updated all configurations for free-tier deployment:

| File | Change |
|------|--------|
| `apps/api/render.yaml` | Updated for Render free tier with auto-deploy |
| `apps/web/netlify.toml` | Added security headers and caching |
| `apps/web/public/index.html` | Updated all URLs to `www.ks-atlas.gg` |
| `apps/web/public/robots.txt` | Updated sitemap URL |
| `apps/web/public/sitemap.xml` | Updated all page URLs |
| `docs/LAUNCH_CHECKLIST.md` | Complete rewrite with 5-step deployment guide |

### Cost Comparison

| Stack | Monthly Cost | Annual Cost |
|-------|--------------|-------------|
| Original (Railway + Netlify) | $5/month | $78/year |
| **Zero-Cost (Render + Supabase + Netlify)** | $0/month | **$18/year** (domain only) |

### Trade-offs Accepted
- Render free tier sleeps after 15 min inactivity (~30s cold start)
- Workaround: UptimeRobot pings every 5 min to keep awake

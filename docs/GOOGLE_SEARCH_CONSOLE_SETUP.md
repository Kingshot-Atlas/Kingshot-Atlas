# Google Search Console Setup Guide

**Last Updated:** 2026-02-05  
**Status:** Ready for Verification

---

## Quick Start

### Step 1: Access Google Search Console
1. Go to [Google Search Console](https://search.google.com/search-console)
2. Sign in with Google account
3. Click "Add Property"

### Step 2: Add Property
- **Method:** URL prefix
- **URL:** `https://ks-atlas.com`

### Step 3: Verify Ownership (Choose One)

#### Option A: HTML File (Recommended)
1. Download the verification file from Search Console
2. Rename it and place in `/apps/web/public/`
3. Deploy to Cloudflare Pages
4. Click "Verify" in Search Console

#### Option B: DNS Record
1. Go to Cloudflare DNS settings for ks-atlas.com
2. Add TXT record provided by Search Console
3. Wait for DNS propagation (up to 48 hours)
4. Click "Verify" in Search Console

#### Option C: HTML Meta Tag
Add to `/apps/web/index.html` in `<head>`:
```html
<meta name="google-site-verification" content="YOUR_CODE_HERE" />
```

---

## After Verification

### Submit Sitemap (CRITICAL)
1. Go to Search Console → Sitemaps
2. Enter: `sitemap.xml`
3. Click "Submit"

**Expected Result:** 1,211 URLs discovered
- 10 static pages
- 1,190 kingdom profiles
- 11 KvK season pages

### Request Indexing for Priority Pages
After sitemap submission, manually request indexing for these high-value pages:

1. **Homepage:** `https://ks-atlas.com/`
2. **Leaderboards:** `https://ks-atlas.com/leaderboards`
3. **Compare:** `https://ks-atlas.com/compare`
4. **Seasons:** `https://ks-atlas.com/seasons`

To request indexing:
1. Enter URL in Search Console URL Inspection
2. Click "Request Indexing"

---

## Monitoring

### Check Weekly
- **Coverage report:** How many pages indexed
- **Performance report:** Clicks, impressions, CTR, position
- **Core Web Vitals:** Performance metrics

### Expected Timeline
| Milestone | Expected Time |
|-----------|---------------|
| Verification | Immediate |
| Sitemap processed | 1-3 days |
| First pages indexed | 3-7 days |
| Most pages indexed | 2-4 weeks |
| Rankings stabilize | 4-8 weeks |

---

## Target Keywords to Monitor

### Primary (High Intent)
- `kingshot transfer event`
- `kingshot kingdom rankings`
- `kingshot kvk results`
- `kingshot tier list`
- `best kingshot kingdoms`

### Secondary
- `kingshot kingdom database`
- `kingshot kvk tracker`
- `kingshot atlas`
- `kingshot kingdom compare`

### Long-tail
- `kingshot kingdom [number] stats`
- `kingshot kvk season [number]`
- `which kingshot kingdom to join`

---

## Troubleshooting

### "URL is not on Google"
1. Check if URL is in sitemap
2. Verify robots.txt allows crawling
3. Request indexing manually
4. Wait 1-2 weeks

### Low Indexing Rate
- **Cause:** SPA without prerendering
- **Solution:** Enable prerender.io integration (see `SEO_PRERENDERING_STRATEGY.md`)

### Soft 404 Errors
- Kingdom profiles may show as soft 404s if prerendering isn't working
- Enable PRERENDER_TOKEN in Cloudflare environment variables

---

## Environment Variables Required

Add to Cloudflare Pages settings:

| Variable | Value | Purpose |
|----------|-------|---------|
| `PRERENDER_TOKEN` | From prerender.io | Bot prerendering |

---

*Follow this guide to complete Google Search Console setup.*

# SEO Hardening Guide

**Last Updated:** 2026-02-05  
**Purpose:** Prevent future GSC security flags, maintain healthy SEO practices

---

## What Caused the "Deceptive Pages" Flag

On 2026-02-05, Google Search Console flagged ks-atlas.com with a "Deceptive pages" security issue.

### Root Cause: Fake Aggregate Rating
```json
// ❌ REMOVED - This was fabricated data
"aggregateRating": {
  "@type": "AggregateRating",
  "ratingValue": "4.8",
  "ratingCount": "150"
}
```

Google's Rich Results guidelines explicitly prohibit fabricated ratings. This structured data claimed 150 reviews with a 4.8 rating when no review system existed.

### Contributing Factor: Keyword Stuffing
The keywords meta tag had 11 repetitive variations of "Kingshot" which Google may interpret as manipulative.

---

## Existing User Reviews System

The kingdom reviews system is **already implemented** in Supabase and the frontend:

### Database Tables (Already Exist)
- `kingdom_reviews` - Main reviews table with rating (1-5), comment, author info
- `review_helpful_votes` - Track helpful votes on reviews
- `review_replies` - Replies to reviews
- `review_notifications` - Notification system for review activity

### Frontend Components (Already Exist)
- `src/services/reviewService.ts` - Supabase queries for reviews
- `src/components/KingdomReviews.tsx` - Reviews UI component
- `src/pages/KingdomProfile.tsx` - Reviews integration

### Current State
- **1 review** exists in the database (Kingdom 172, 5-star rating)
- Minimum **5 reviews** needed before adding `aggregateRating` to structured data

### What's Missing for aggregateRating
To legitimately add `aggregateRating` structured data:
1. Accumulate at least 5 real user reviews
2. Create aggregate rating query function
3. Inject structured data in `useStructuredData.ts` only when threshold met

### Valid Structured Data (Only After 5+ Reviews Exist)
```typescript
// Only include aggregateRating if real reviews exist
function getKingdomStructuredData(kingdom: Kingdom, reviews?: ReviewAggregate) {
  const data: any = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": `${kingdom.name} - Kingdom Profile`,
    // ... other properties
  };
  
  // ONLY add rating if we have REAL user reviews
  if (reviews && reviews.count >= 5) { // Minimum 5 reviews
    data.aggregateRating = {
      "@type": "AggregateRating",
      "ratingValue": reviews.average.toFixed(1),
      "ratingCount": reviews.count.toString(),
      "bestRating": "5",
      "worstRating": "1"
    };
  }
  
  return data;
}
```

### Requirements Before Adding aggregateRating
- [ ] Real user review system implemented
- [ ] At least 5 verified reviews exist
- [ ] Reviews come from authenticated users
- [ ] Review moderation in place
- [ ] Display reviews on the page (not hidden)

---

## Google Search Console Monitoring

### Setup Alerts
1. Go to [Google Search Console](https://search.google.com/search-console)
2. Settings → Email preferences → Enable all notifications
3. Monitor these sections weekly:
   - **Security Issues** - Critical, check immediately if flagged
   - **Manual Actions** - Penalties from human reviewers
   - **Coverage** - Indexing errors
   - **Core Web Vitals** - Performance issues

### Monthly Audit Checklist
- [ ] Check Security Issues tab (should be empty)
- [ ] Review Coverage report for new errors
- [ ] Check Core Web Vitals pass rate
- [ ] Verify sitemap is indexed correctly
- [ ] Review any new warnings/errors

### If Flagged Again
1. **Don't panic** - Read the specific issue
2. **Identify the cause** - Use this document as reference
3. **Fix the issue** - Remove/correct problematic content
4. **Deploy fix** - Push to production
5. **Request review** - In GSC Security Issues, click "REQUEST REVIEW"
6. **Wait** - Reviews take 1-3 business days

---

## Structured Data Best Practices

### DO ✅
- Use real, verifiable data only
- Validate with [Schema Markup Validator](https://validator.schema.org/)
- Match structured data to visible page content
- Keep structured data minimal and accurate

### DON'T ❌
- Fabricate reviews, ratings, or counts
- Add structured data for content not on the page
- Over-markup with excessive structured data
- Use structured data to misrepresent content

### Allowed Structured Data Types for Atlas
| Type | Use Case | Requirements |
|------|----------|--------------|
| WebApplication | Homepage | Name, description, URL only |
| Organization | Footer/About | Real company info only |
| WebSite + SearchAction | Site search | Must have working search |
| WebPage | Individual pages | Match visible content |
| FAQPage | FAQ sections | Questions must be visible on page |

### Prohibited Until Real Data Exists
| Type | Why Prohibited |
|------|----------------|
| AggregateRating | No real review system |
| Review | No user reviews |
| Product | Not an e-commerce site |

---

## Meta Tag Guidelines

### Keywords Meta Tag
```html
<!-- ✅ GOOD: Short, relevant, no repetition -->
<meta name="keywords" content="Kingshot Atlas, kingdom rankings, KvK tracker, transfer events, kingdom database" />

<!-- ❌ BAD: Keyword stuffing -->
<meta name="keywords" content="Kingshot transfer event, Kingshot kingdom rankings, Kingshot KvK event, Kingshot KvK results, Kingshot tier list, Kingshot kingdom database, best Kingshot kingdoms..." />
```

### Title Tag
- Keep under 60 characters
- Include brand name once
- Be descriptive, not salesy

### Description
- Keep between 150-160 characters
- Natural language, not keyword lists
- Accurately describe page content

---

## CI/CD SEO Validation

The CI pipeline includes structured data validation. See `.github/workflows/ci.yml` for the `seo-validation` job.

### What Gets Checked
1. **Structured Data Validity** - JSON-LD parses correctly
2. **No Fabricated Data** - No fake ratings/reviews
3. **Meta Tag Presence** - Required tags exist
4. **No Keyword Stuffing** - Keywords meta tag < 10 items

### Manual Validation
```bash
# Validate structured data locally
npm run validate:seo

# Or use online tools:
# - https://validator.schema.org/
# - https://search.google.com/test/rich-results
```

---

## Quick Reference: What's Safe vs Risky

### Safe SEO Practices ✅
- Accurate meta descriptions
- Real user-generated content
- Proper heading hierarchy
- Natural internal linking
- Mobile-responsive design
- Fast page load times

### Risky SEO Practices ⚠️
- Aggressive keyword repetition
- Hidden text/links
- Doorway pages
- Purchased links
- Auto-generated content
- Cloaking (showing different content to bots)

### Definitely Deceptive ❌
- Fake reviews/ratings
- Misleading redirects
- Phishing forms
- Malware distribution
- Impersonating other sites

---

*Document created after GSC "Deceptive pages" incident on 2026-02-05.*

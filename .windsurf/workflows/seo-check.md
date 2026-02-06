---
description: SEO safety check before deploying changes that affect meta tags, structured data, or public-facing content
---

# /seo-check Workflow

Run this workflow before deploying any changes that affect:
- Meta tags (title, description, keywords)
- Structured data (JSON-LD)
- Public-facing content that search engines will index

## Background

On 2026-02-05, Google Search Console flagged ks-atlas.com with "Deceptive pages" due to:
1. **Fabricated aggregateRating** - Claimed 150 reviews @ 4.8 rating with no real review system
2. **Keyword stuffing** - 11+ repetitive keyword variations

This workflow prevents recurrence.

---

## Pre-Deployment Checklist

### 1. Run SEO Validation Script
// turbo
```bash
cd /Users/giovanni/projects/ai/Kingshot\ Atlas/apps/web && npm run validate:seo
```

If errors appear, **STOP** and fix before proceeding.

### 2. Structured Data Review

Check `index.html` for JSON-LD blocks. For each block, verify:

- [ ] **No fabricated data** - All values must be real and verifiable
- [ ] **No aggregateRating** unless real user reviews exist (minimum 5 reviews)
- [ ] **No review arrays** unless reviews are from real authenticated users
- [ ] **Content matches page** - Structured data describes visible content only

### 3. Meta Tags Review

- [ ] **Title** < 60 characters, includes brand once
- [ ] **Description** 150-160 characters, natural language
- [ ] **Keywords** ≤ 10 items, no excessive repetition of same word
- [ ] **Open Graph** tags present and accurate
- [ ] **Canonical URL** points to correct page

### 4. Content Review

- [ ] No hidden text or links
- [ ] No misleading redirects
- [ ] No fake download/install buttons
- [ ] No phishing-style forms
- [ ] CTAs are honest and accurate

### 5. Validate with External Tools

Before major SEO changes, validate with:

1. **Schema Validator**: https://validator.schema.org/
   - Paste your JSON-LD and verify no errors

2. **Rich Results Test**: https://search.google.com/test/rich-results
   - Test your live URL after deployment

3. **Google Search Console**: https://search.google.com/search-console
   - Check Security Issues tab after deployment

---

## Red Flags - STOP and Review

If you see any of these patterns, **do not deploy**:

| Pattern | Why It's Dangerous |
|---------|-------------------|
| `"aggregateRating"` with hardcoded values | Fabricated ratings = deceptive |
| `"review"` array with fake reviews | Fabricated reviews = deceptive |
| Keywords meta with 10+ items | Keyword stuffing penalty |
| Same word repeated 5+ times in keywords | Over-optimization |
| `display: none` on text with keywords | Hidden text penalty |
| Different content for bots vs users | Cloaking penalty |

---

## After Deployment

1. **Verify site loads correctly** at https://ks-atlas.com
2. **Check GSC Security Issues** within 24 hours
3. **Monitor for indexing issues** over next week

---

## Reference Documentation

- `/docs/SEO_HARDENING.md` - Full guide on what caused the flag and how to prevent it
- `/agents/ops-lead/LATEST_KNOWLEDGE.md` - SEO best practices
- `/agents/ops-lead/SPECIALIST.md` - Ops Lead scope and workflows

---

*Created after GSC "Deceptive pages" incident on 2026-02-05.*

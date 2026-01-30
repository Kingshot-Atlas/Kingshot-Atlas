# Feature Implementation Plan: Content Marketing - "Understanding Atlas Score"

**Feature:** Content Marketing: Blog/Video Campaign  
**Assigned To:** Design Lead + Release Manager  
**Priority:** MEDIUM  
**Revenue Impact:** ~15% traffic increase (indirect revenue via user acquisition)  
**Date:** 2026-01-29

---

## Executive Summary

The new Atlas Score formula is a key differentiator. Publicly explaining it builds authority, drives SEO traffic, and creates shareable content. "Why lucky streaks don't fool us" is compelling messaging.

---

## Goals

- [ ] Create comprehensive "Understanding Atlas Score" blog post
- [ ] Design infographic explaining the formula
- [ ] Write social media content for Discord/Reddit
- [ ] SEO-optimize for "KoA kingdom rankings" searches
- [ ] Establish Kingshot Atlas as the authority

---

## Content Strategy

### 1. Primary Blog Post

**Title:** "Understanding Atlas Score: The Science Behind Kingdom Rankings"

**SEO Target Keywords:**
- "koa kingdom rankings"
- "king of avalon kingdom scores"
- "kvk win rate calculator"
- "best kingdoms king of avalon"

**URL:** `/blog/understanding-atlas-score`

**Structure:**

```markdown
# Understanding Atlas Score: The Science Behind Kingdom Rankings

## The Problem with Simple Win Rates
- Why 100% win rate with 1 KvK doesn't mean #1
- The "lucky streak" problem
- Experience matters

## How Atlas Score Works
- 4 core components explained
- Visual breakdown diagram
- Real examples

## The Components
### 1. Base Win Rate (40% of score)
### 2. Performance Pattern (25% of score)
### 3. Recent Form (20% of score)
### 4. Streak Analysis (15% of score)
### Experience Factor: The Multiplier

## Real Kingdom Examples
- Compare a 1-0 kingdom vs 10-2 kingdom
- Show why consistency beats luck
- Visual score breakdowns

## Why This Matters for Your Transfers
- Find kingdoms that will stay strong
- Avoid "paper tigers" with lucky records
- Make data-driven decisions

## FAQ
- "Why did my kingdom's score change?"
- "How can I improve my kingdom's score?"
- "What's a good Atlas Score?"

## Start Using Atlas Score
[CTA: Explore Kingdom Directory]
```

### 2. Infographic

**Title:** "Atlas Score Explained in 60 Seconds"

**Format:** Vertical infographic (1080x1920px for social, 1200x2400px for blog)

**Sections:**

```
┌─────────────────────────────────────┐
│  ATLAS SCORE EXPLAINED              │
│  The smarter way to rank kingdoms   │
├─────────────────────────────────────┤
│                                     │
│  [Illustration: Scale balancing]    │
│                                     │
│  WIN RATE ALONE IS BROKEN           │
│  1-0 kingdom = 100% win rate        │
│  10-2 kingdom = 83% win rate        │
│  Who's actually better? 🤔          │
│                                     │
├─────────────────────────────────────┤
│                                     │
│  ATLAS SCORE COMPONENTS             │
│                                     │
│  [Pie chart with 4 sections]        │
│                                     │
│  🎯 Base Performance     40%        │
│  🏆 Domination Pattern   25%        │
│  🔥 Recent Form          20%        │
│  📈 Streak Analysis      15%        │
│                                     │
│  × Experience Factor               │
│                                     │
├─────────────────────────────────────┤
│                                     │
│  THE EXPERIENCE FACTOR              │
│                                     │
│  [Graph showing scaling]            │
│                                     │
│  1 KvK  → 0.35x multiplier         │
│  5 KvKs → 0.75x multiplier         │
│  10 KvKs → 0.95x multiplier        │
│                                     │
│  Consistency is rewarded            │
│                                     │
├─────────────────────────────────────┤
│                                     │
│  REAL DATA. REAL RESULTS.           │
│  NO SPIN.                           │
│                                     │
│  [Kingshot Atlas Logo]              │
│  ks-atlas.com                       │
│                                     │
└─────────────────────────────────────┘
```

### 3. Social Media Content

**Discord Announcement:**

```markdown
📊 **NEW: Atlas Score Deep Dive**

Ever wondered why a 1-0 kingdom isn't ranked #1?

We've published a complete breakdown of how Atlas Score works:
→ The 4 components that determine your rank
→ Why experience matters more than luck
→ Real examples from top kingdoms

**Read now:** [link]

Stop guessing. Start understanding.
```

**Reddit Post (r/KingOfAvalon):**

```markdown
**Title:** I analyzed 180+ kingdoms and built a ranking system - here's what I learned

**Body:**
Hey KoA community,

I got tired of guessing which kingdoms were actually good vs just lucky, so I built Kingshot Atlas with a proper ranking algorithm.

Key findings:
- Simple win rate is misleading (1-0 looks better than 10-2)
- Dominations matter more than close wins
- Recent form shows who's improving/declining
- Streaks indicate momentum

The full formula breakdown: [link]

The tool itself is free: ks-atlas.com

Happy to answer questions about how any specific kingdom scores!
```

### 4. Blog Page Implementation (Design Lead)

**New File:** `/apps/web/src/pages/Blog.tsx`

```typescript
// Simple blog page with:
// - Article content (MDX or hardcoded)
// - SEO meta tags
// - Social sharing buttons
// - Related articles sidebar
// - CTA to Kingdom Directory
```

**New File:** `/apps/web/src/pages/BlogPost.tsx`

```typescript
// Individual blog post template
// - Hero image
// - Author/date
// - Table of contents
// - Article body
// - Share buttons
// - Related posts
```

---

## Implementation Steps

### Phase 1: Content Creation (Design Lead + Business Lead)
1. Write blog post draft following structure above
2. Create infographic in Figma/Canva
3. Write social media copy
4. Review for brand voice compliance

### Phase 2: Blog Infrastructure (Product Engineer)
1. Create `/blog` route
2. Create `Blog.tsx` index page
3. Create `BlogPost.tsx` template
4. Add SEO meta tags
5. Add Open Graph images

### Phase 3: Publication (Release Manager)
1. Publish blog post
2. Post to Discord announcements
3. Post to Reddit (organic, not spammy)
4. Share infographic on social
5. Monitor engagement

### Phase 4: SEO Optimization (Ops Lead)
1. Submit to Google Search Console
2. Build internal links from other pages
3. Monitor keyword rankings
4. Update based on performance

---

## Files to Create/Modify

| File | Agent | Action |
|------|-------|--------|
| `/apps/web/src/pages/Blog.tsx` | Product | Create (new) |
| `/apps/web/src/pages/BlogPost.tsx` | Product | Create (new) |
| `/apps/web/src/content/understanding-atlas-score.md` | Design | Create (new) |
| `/apps/web/public/images/atlas-score-infographic.png` | Design | Create (new) |
| `/apps/web/src/App.tsx` | Product | Add blog routes |
| `/docs/SOCIAL_MEDIA_CONTENT.md` | Release | Create (new) |

---

## SEO Checklist

- [ ] Title tag: "Understanding Atlas Score | Kingshot Atlas"
- [ ] Meta description: "Learn how Atlas Score ranks kingdoms beyond simple win rates. The science behind KoA kingdom rankings."
- [ ] H1: "Understanding Atlas Score: The Science Behind Kingdom Rankings"
- [ ] Alt tags on all images
- [ ] Internal links to Kingdom Directory, Leaderboards
- [ ] Schema markup for Article
- [ ] Open Graph image (1200x630px)
- [ ] Twitter card image

---

## Brand Voice Compliance

All content MUST follow `/docs/BRAND_GUIDE.md`:

| ✅ Use | ❌ Avoid |
|--------|---------|
| "Stop guessing. Start winning." | "Our algorithm is great!" |
| "Data-driven dominance" | "We think we're the best" |
| "Real data. Real results. No spin." | "Trust our rankings" |
| "Built by Kingdom 172 players" | "Created by experts" |

**Tone:** Confident but not arrogant. Educational but not boring. Competitive but not aggressive.

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Blog pageviews (month 1) | 500+ | Google Analytics |
| Time on page | 3+ minutes | Google Analytics |
| Social shares | 50+ | Share button tracking |
| Reddit upvotes | 50+ | Reddit |
| Organic search traffic (month 3) | 200+ visits/month | Search Console |
| Conversion to signup | 5% | Funnel tracking |

---

## Content Calendar

| Date | Action | Owner |
|------|--------|-------|
| Day 1 | Draft blog post | Design Lead |
| Day 2 | Create infographic | Design Lead |
| Day 3 | Review & edit | Business Lead |
| Day 4 | Implement blog page | Product Engineer |
| Day 5 | Publish & announce | Release Manager |
| Day 6 | Reddit post | Release Manager |
| Week 2 | Monitor & adjust | Ops Lead |

---

## Additional Content Ideas (Future)

1. **"How We Calculate Streaks"** - Deep dive on streak mechanics
2. **"Transfer Season Guide"** - When to move, what to look for
3. **"Kingdom Spotlights"** - Featured kingdom analyses
4. **"The Mathematics of Domination"** - Why double-wins matter
5. **"From D-Tier to S-Tier"** - Kingdom comeback stories

---

## Dependencies

- Atlas Score formula finalized
- Blog infrastructure in place
- Social media accounts ready
- Brand guide available

---

## Non-Goals (Out of Scope)

- Video production (future phase)
- Paid advertising
- Influencer outreach
- Multi-language content

---

**Ready for implementation. Design Lead starts content, Product Engineer builds blog infrastructure.**

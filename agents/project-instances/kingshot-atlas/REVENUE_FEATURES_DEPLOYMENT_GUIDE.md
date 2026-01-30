# Revenue Features Deployment Guide

**Created:** 2026-01-29  
**Author:** Business Lead  
**Purpose:** Deploy 5 revenue-generating Pro features via independent agent sessions

---

## Overview

Five Pro features have been planned and documented. Each can be implemented independently without interfering with others. Below are copy-ready handoff prompts for each feature.

---

## Feature Summary

| # | Feature | Agent(s) | Revenue | Priority | Dependencies |
|---|---------|----------|---------|----------|--------------|
| 1 | Score History Timeline | Platform + Product | $2,495/mo | HIGH | Database schema |
| 2 | Score Simulator | Product only | $1,497/mo | HIGH | None (frontend-only) |
| 3 | Breakdown Comparison | Product only | $998/mo | MEDIUM | None |
| 4 | Score Alerts | Platform + Product | $1,996/mo | MEDIUM-HIGH | KvK pipeline |
| 5 | Content Marketing | Design + Release | ~15% traffic | MEDIUM | Blog infrastructure |

**Total Potential MRR:** $6,986/month

---

## Recommended Deployment Order

```
1. Score Simulator (no backend, fastest to ship)
   ↓
2. Breakdown Comparison (enhances existing feature)
   ↓
3. Score History Timeline (needs backend + frontend)
   ↓
4. Score Alerts (most complex, needs pipeline integration)
   ↓
5. Content Marketing (can run parallel to any)
```

---

## Copy-Ready Handoff Prompts

### Feature 1: Atlas Score History Timeline

```
**AGENT HANDOFF: Platform Engineer + Product Engineer**

**Project:** Kingshot Atlas
**Feature:** Atlas Score History Timeline (Pro Feature)

Read the implementation plan at:
/agents/project-instances/kingshot-atlas/FEATURE_PLAN_SCORE_HISTORY_TIMELINE.md

**Your Task:**
Implement the Atlas Score History Timeline feature. This shows users a visual graph of their kingdom's score progression over time.

**Deliverables:**
1. Database: Create `atlas_score_history` table
2. Backend: Add `/api/kingdoms/{id}/score-history` endpoint
3. Frontend: Create `ScoreHistoryTimeline.tsx` component
4. Gate behind Pro subscription using existing `usePremium()` hook
5. Add teaser for free users

**Constraints:**
- Do NOT modify the Atlas Score formula
- Follow /apps/web/src/STYLE_GUIDE.md for styling
- Use existing PremiumContext for gating

**Files Changed:** Listed in the plan document

Start by reading the full plan, then proceed with implementation.
```

---

### Feature 2: Score Simulator Tool

```
**AGENT HANDOFF: Product Engineer**

**Project:** Kingshot Atlas
**Feature:** Score Simulator Tool (Pro Feature)

Read the implementation plan at:
/agents/project-instances/kingshot-atlas/FEATURE_PLAN_SCORE_SIMULATOR.md

**Your Task:**
Implement the Score Simulator - a frontend-only tool that lets users predict future Atlas Scores based on hypothetical KvK results.

**Deliverables:**
1. Port Atlas Score formula to TypeScript (`simulatorUtils.ts`)
2. Create `ScoreSimulator/` component directory
3. Build interactive UI with KvK result inputs
4. Show projected score with breakdown
5. Gate behind Pro subscription
6. Add teaser for free users

**Constraints:**
- 100% frontend implementation - NO backend changes
- Calculation must match Python formula in `/enhanced_atlas_formulas.py`
- Follow /apps/web/src/STYLE_GUIDE.md for styling

**Files Changed:** Listed in the plan document

This is the fastest feature to ship - no backend work required.
```

---

### Feature 3: Score Breakdown Comparison

```
**AGENT HANDOFF: Product Engineer**

**Project:** Kingshot Atlas
**Feature:** Score Breakdown Comparison (Pro Feature)

Read the implementation plan at:
/agents/project-instances/kingshot-atlas/FEATURE_PLAN_SCORE_BREAKDOWN_COMPARISON.md

**Your Task:**
Enhance the existing Compare page with component-level score breakdowns. Show WHERE two kingdoms differ: "K172 wins on Streaks, K245 wins on Dominations."

**Deliverables:**
1. Create `ScoreBreakdownComparison.tsx` component
2. Create `ComponentCompareBar.tsx` with dual-bar visualization
3. Create `CompareInsights.tsx` for auto-generated insights
4. Integrate into existing `CompareKingdoms.tsx`
5. Gate breakdown behind Pro (basic compare stays free)

**Constraints:**
- Enhance existing page, don't rebuild it
- Start with 2-kingdom comparison (not 3+)
- Follow /apps/web/src/STYLE_GUIDE.md

**Files Changed:** Listed in the plan document

This enhances an existing popular feature - quick win.
```

---

### Feature 4: Score Alert Notifications

```
**AGENT HANDOFF: Platform Engineer + Product Engineer**

**Project:** Kingshot Atlas
**Feature:** Score Alert Notifications (Pro Feature)

Read the implementation plan at:
/agents/project-instances/kingshot-atlas/FEATURE_PLAN_SCORE_ALERTS.md

**Your Task:**
Build a notification system that alerts Pro users when watched kingdoms' scores/ranks change significantly. Deliver via Discord webhook.

**Platform Engineer Deliverables:**
1. Create `score_alerts` and `alert_history` database tables
2. Create `/apps/api/alerts/` module with service and router
3. Implement Discord webhook notifications
4. Integrate with KvK processing pipeline

**Product Engineer Deliverables:**
1. Create `Alerts/` component directory
2. Build AlertManager UI in KingdomProfile
3. Create alert creation modal
4. Show alert history
5. Gate behind Pro subscription

**Constraints:**
- Discord webhooks first, email is optional/later
- Rate limit: 1 alert per kingdom per KvK max
- Follow /apps/web/src/STYLE_GUIDE.md

**Files Changed:** Listed in the plan document

Most complex feature - requires pipeline integration.
```

---

### Feature 5: Content Marketing

```
**AGENT HANDOFF: Design Lead + Release Manager**

**Project:** Kingshot Atlas
**Feature:** Content Marketing - "Understanding Atlas Score"

Read the implementation plan at:
/agents/project-instances/kingshot-atlas/FEATURE_PLAN_CONTENT_MARKETING.md

**Your Task:**
Create compelling content explaining the Atlas Score formula. This drives SEO traffic and establishes authority.

**Design Lead Deliverables:**
1. Write blog post "Understanding Atlas Score"
2. Create infographic (1080x1920 for social)
3. Ensure brand voice compliance per /docs/BRAND_GUIDE.md

**Release Manager Deliverables:**
1. Write Discord announcement
2. Write Reddit post (organic, not spammy)
3. Coordinate publication timing
4. Monitor engagement

**Product Engineer (if needed):**
1. Create `/blog` route infrastructure
2. Add SEO meta tags

**Constraints:**
- Follow brand voice in /docs/BRAND_GUIDE.md strictly
- No corporate speak - be a player talking to players
- Educational but not boring

**Files Changed:** Listed in the plan document

Can run parallel to other features.
```

---

## Conflict Prevention

These features are designed to NOT conflict:

| Feature | Touches |
|---------|---------|
| History Timeline | New table, new component, new API endpoint |
| Simulator | New components only, no shared code |
| Breakdown Comparison | Adds to existing Compare page (new section) |
| Score Alerts | New module, new tables, new components |
| Content Marketing | New pages, docs only |

**File Claiming:** Each agent should check `/agents/project-instances/kingshot-atlas/FILE_CLAIMS.md` before starting.

---

## Testing Protocol

After each feature:
1. Verify Pro gating works (anonymous → free → pro)
2. Test on mobile
3. Check for console errors
4. Run existing tests (`npm test`)
5. Local build (`npm run build`)

---

## Deployment Protocol

Per `/docs/AGENT_PROTOCOL.md`: **Build locally, do NOT deploy to Netlify unless explicitly requested.**

```bash
cd /apps/web
npm run build
# Test locally before any production deployment
```

---

## Questions?

If agents encounter blockers:
1. Check existing documentation first
2. Log question in worklog
3. Return to Director for clarification

---

*Guide created by Business Lead for Owner deployment*

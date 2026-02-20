# Power Tier Thresholds - Single Source of Truth

**Last Updated:** 2026-02-20

## ⚠️ IMPORTANT: This is the ONLY source of truth for tier thresholds

When updating tier thresholds, you MUST update ALL of the following files:

## Current Thresholds (Atlas Score v3.1, 0-100 scale)

| Tier | Score Range | Percentile | Description | Detail |
|------|-------------|------------|-------------|--------|
| **S** | 57+ | Top 3% | Elite | Apex predators |
| **A** | 47 – 57 | Top 10% | Formidable | Serious contenders |
| **B** | 38 – 47 | Top 25% | Competitive | Solid performers |
| **C** | 29 – 38 | Top 50% | Developing | Room to grow |
| **D** | 0 – 29 | Bottom 50% | Struggling | Rebuilding |

## Files That Must Stay In Sync

### Frontend (Primary Source)

1. **`apps/web/src/types/index.ts`** - `POWER_TIER_THRESHOLDS` constant
   - This is the canonical definition
   - `getPowerTier()` function uses these

### Frontend (Display)

2. **`apps/web/src/pages/About.tsx`** - Tier breakdown section
   - User-facing tier range display

3. **`apps/web/src/pages/KingdomProfile.tsx`** - `getTierDescription()` function
   - Tooltip descriptions for tier badges

4. **`apps/web/src/components/shared/TierBadge.tsx`** - `TIER_DESCRIPTIONS` array
   - Tooltip popup content

5. **`apps/web/src/components/ScoreSimulator/simulatorUtils.ts`** - `getTier()` function
   - Score projection calculations

### Discord Bot

6. **`apps/discord-bot/src/utils/embeds.js`** - `getTier()` function
   - Used for kingdom embeds and comparisons

7. **`apps/discord-bot/src/utils/api.js`** - `tierRanges` object
   - Used for `/tier` command filtering

### API (if applicable)

8. **`apps/api/api/routers/kingdoms.py`** - tier filtering (if implemented)

## Checklist When Updating Thresholds

```markdown
- [ ] Update `apps/web/src/types/index.ts` (POWER_TIER_THRESHOLDS)
- [ ] Update `apps/web/src/pages/About.tsx` (tier breakdown)
- [ ] Update `apps/web/src/pages/KingdomProfile.tsx` (getTierDescription)
- [ ] Update `apps/web/src/components/shared/TierBadge.tsx` (TIER_DESCRIPTIONS)
- [ ] Update `apps/web/src/components/ScoreSimulator/simulatorUtils.ts` (getTier)
- [ ] Update `apps/discord-bot/src/utils/embeds.js` (getTier)
- [ ] Update `apps/discord-bot/src/utils/api.js` (tierRanges)
- [ ] Run `npm run build` in apps/web
- [ ] Push to GitHub (triggers Discord bot auto-deploy)
- [ ] Deploy frontend (push to main → Cloudflare Pages auto-deploys)
- [ ] Update this document with new thresholds
```

## Why These Thresholds?

The thresholds are based on percentile distribution of Atlas Scores across all kingdoms:

- **S-Tier (57+):** Approximately top 3% of kingdoms. Elite — apex predators with exceptional track records.
- **A-Tier (47–57):** Top 10% of kingdoms. Formidable — serious contenders.
- **B-Tier (38–47):** Top 25% of kingdoms. Competitive — solid performers.
- **C-Tier (29–38):** Top 50% of kingdoms. Developing — room to grow.
- **D-Tier (0–29):** Bottom 50% of kingdoms. Struggling — rebuilding.

## History

| Date | Change | Reason |
|------|--------|--------|
| 2026-02-20 | Updated docs to match 0-100 scale | Docs were stale (still showed old 0-15 scale thresholds) |
| 2026-02-07 | Atlas Score v3.1 — 0-100 scale | Inflation fix, tier recalibration. Thresholds: S≥57, A≥47, B≥38, C≥29 |
| 2026-01-30 | Updated all files to match POWER_TIER_THRESHOLDS | Discovered inconsistency between About page (10+/7+) and actual thresholds |
| 2026-01-27 | Initial thresholds set based on percentile analysis | Data-driven tier assignment |

# Power Tier Thresholds - Single Source of Truth

**Last Updated:** 2026-01-30

## ⚠️ IMPORTANT: This is the ONLY source of truth for tier thresholds

When updating tier thresholds, you MUST update ALL of the following files:

## Current Thresholds

| Tier | Score Range | Percentile | Description |
|------|-------------|------------|-------------|
| **S** | 8.90+ | Top 3% | Elite kingdoms |
| **A** | 7.79 - 8.89 | Top 10% | Strong kingdoms |
| **B** | 6.42 - 7.78 | Top 25% | Competitive kingdoms |
| **C** | 4.72 - 6.41 | Top 50% | Developing kingdoms |
| **D** | < 4.72 | Bottom 50% | Rebuilding kingdoms |

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

- **S-Tier (8.90+):** Approximately top 3% of kingdoms. Reserved for elite performers with exceptional track records.
- **A-Tier (7.79-8.89):** Top 10% of kingdoms. Strong, consistent performers.
- **B-Tier (6.42-7.78):** Top 25% of kingdoms. Competitive and reliable.
- **C-Tier (4.72-6.41):** Top 50% of kingdoms. Developing with room to grow.
- **D-Tier (<4.72):** Bottom 50% of kingdoms. New or rebuilding.

## History

| Date | Change | Reason |
|------|--------|--------|
| 2026-01-30 | Updated all files to match POWER_TIER_THRESHOLDS | Discovered inconsistency between About page (10+/7+) and actual thresholds |
| 2026-01-27 | Initial thresholds set based on percentile analysis | Data-driven tier assignment |

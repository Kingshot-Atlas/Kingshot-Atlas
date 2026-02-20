# Atlas Tier System

> **Single Source of Truth** for tier thresholds across all platforms.

## Current Tier System (Atlas Score v3.1, 0-100 scale)

Tiers are determined by Atlas Score thresholds calibrated to percentile distribution.

| Tier | Score Range | Percentile | Description | Detail |
|------|-------------|------------|-------------|--------|
| **S** | 57+ | Top 3% | Elite | Apex predators |
| **A** | 47 – 57 | Top 10% | Formidable | Serious contenders |
| **B** | 38 – 47 | Top 25% | Competitive | Solid performers |
| **C** | 29 – 38 | Top 50% | Developing | Room to grow |
| **D** | 0 – 29 | Bottom 50% | Struggling | Rebuilding |

### Historical Tier Calculation

For the Atlas Score History chart, tiers are calculated based on the **percentile distribution at each KvK**.
This means a kingdom's historical tier reflects how they ranked *at that time*, not by today's standards.

**Database Function:** `get_tier_from_percentile(percentile NUMERIC)`

```sql
IF percentile >= 97 THEN RETURN 'S';  -- Top 3%
ELSIF percentile >= 90 THEN RETURN 'A';  -- Top 10%
ELSIF percentile >= 75 THEN RETURN 'B';  -- Top 25%
ELSIF percentile >= 50 THEN RETURN 'C';  -- Top 50%
ELSE RETURN 'D';  -- Bottom 50%
```

## Implementation Locations

**These files MUST stay in sync:**

| Location | File | Function/Constant |
|----------|------|-------------------|
| **Website** | `apps/web/src/types/index.ts` | `POWER_TIER_THRESHOLDS`, `getPowerTier()` |
| **Discord Bot** | `apps/discord-bot/src/utils/embeds.js` | `getTier()` |
| **Discord Bot** | `apps/discord-bot/src/utils/api.js` | `tierRanges` in `fetchKingdomsByTier()` |

## Tier Colors

| Tier | Hex | Name |
|------|-----|------|
| S | `#fbbf24` | Gold |
| A | `#22c55e` | Green |
| B | `#3b82f6` | Blue |
| C | `#f97316` | Orange |
| D | `#ef4444` | Red |

## When Updating Tiers

1. Update `apps/web/src/types/index.ts` first (source of truth)
2. Update `apps/discord-bot/src/utils/embeds.js`
3. Update `apps/discord-bot/src/utils/api.js`
4. Run tests: `cd apps/web && npm test`
5. Restart bot: `cd apps/discord-bot && npm start`

## History

| Date | Change | Reason |
|------|--------|--------|
| 2026-02-20 | Updated docs to 0-100 scale, removed legacy thresholds | Docs showed stale 0-15 scale values |
| 2026-02-07 | Atlas Score v3.1 — 0-100 scale | Inflation fix, tier recalibration. S≥57, A≥47, B≥38, C≥29 |
| 2026-02-04 | Implemented percentile-based tiers for historical tracking | Tiers now reflect ranking at time of KvK, not fixed thresholds |
| 2026-02-04 | Added `percentile_rank` to `score_history` table | Enables accurate historical tier display |
| 2026-01-29 | Fixed bot to match website thresholds | Bot was using outdated S:12, A:8, B:5, C:2 |
| 2026-01-28 | Initial thresholds set | Based on score distribution analysis |

---

*Last Updated: 2026-02-20*

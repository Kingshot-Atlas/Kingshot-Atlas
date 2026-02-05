# Atlas Tier System

> **Single Source of Truth** for tier thresholds across all platforms.

## Current Tier System (Percentile-Based)

Tiers are determined by **percentile ranking** within the kingdom population, not fixed score thresholds.
This ensures tiers remain meaningful as the overall score distribution evolves.

| Tier | Percentile | Description |
|------|------------|-------------|
| **S** | Top 3% | Elite kingdoms, consistent dominators |
| **A** | Top 10% | Strong performers, reliable winners |
| **B** | Top 25% | Above average, competitive |
| **C** | Top 50% | Solid performers, developing kingdoms |
| **D** | Bottom 50% | Rebuilding, newer kingdoms |

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

## Legacy Tier Thresholds (Score-Based)

The following fixed thresholds are still used in some older components:

| Tier | Min Score | Max Score | Approx Percentile |
|------|-----------|-----------|-------------------|
| **S** | 10.0 | ∞ | ~Top 3% |
| **A** | 7.0 | 9.9 | ~Top 10% |
| **B** | 4.5 | 6.9 | ~Top 25% |
| **C** | 2.5 | 4.4 | ~Top 50% |
| **D** | -∞ | 2.4 | ~Bottom 50% |

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
| 2026-02-04 | Implemented percentile-based tiers for historical tracking | Tiers now reflect ranking at time of KvK, not fixed thresholds |
| 2026-02-04 | Added `percentile_rank` to `score_history` table | Enables accurate historical tier display |
| 2026-01-29 | Fixed bot to match website thresholds | Bot was using outdated S:12, A:8, B:5, C:2 |
| 2026-01-28 | Initial thresholds set | Based on score distribution analysis |

---

*Last Updated: 2026-02-04*

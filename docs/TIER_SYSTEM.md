# Atlas Tier System

> **Single Source of Truth** for tier thresholds across all platforms.

## Tier Thresholds

| Tier | Min Score | Max Score | Percentile | Description |
|------|-----------|-----------|------------|-------------|
| **S** | 10.0 | ∞ | Top 10% | Elite kingdoms, consistent dominators |
| **A** | 7.0 | 9.9 | Top 25% | Strong performers, reliable winners |
| **B** | 4.5 | 6.9 | Top 50% | Above average, competitive |
| **C** | 2.5 | 4.4 | Top 75% | Average, developing kingdoms |
| **D** | -∞ | 2.4 | Bottom 25% | Struggling, rebuilding |

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
| 2026-01-29 | Fixed bot to match website thresholds | Bot was using outdated S:12, A:8, B:5, C:2 |
| 2026-01-28 | Initial thresholds set | Based on score distribution analysis |

---

*Last Updated: 2026-01-29*

# Release Notes: Score Simulator

**Release Date:** January 29, 2026  
**Version:** 1.x  
**Deploy ID:** `697baba5addbcc6ae0f6ec09`  
**Production URL:** https://ks-atlas.com

---

## New Feature: Score Simulator (Pro)

A powerful new tool that allows Pro users to project their future Atlas Score by simulating hypothetical KvK outcomes.

### Features

- **Simulate 1-5 Future KvKs** - Select prep and battle results for each hypothetical KvK
- **Real-Time Projections** - See projected score update instantly as you change inputs
- **Score Breakdown** - Detailed breakdown showing impact from:
  - Base win rate changes
  - Streak impact (building/breaking)
  - Experience gain factor
  - Recent form bonus
- **Tier Change Detection** - Visual indicator when simulation would change your power tier
- **Actionable Insights** - AI-generated tips based on simulation (e.g., "Building a 5-win battle streak is your strongest asset!")
- **Quick Actions**:
  - 👑 button to quickly set domination (W/W)
  - Reset button to clear simulation
  - Add/remove KvK buttons

### User Experience

- **Collapsible Design** - Starts collapsed, expands on click to avoid page clutter
- **Mobile Responsive** - Optimized layout for all screen sizes
- **Premium Gating** - Free users see a compelling teaser with blurred preview

### Location

The Score Simulator appears on Kingdom Profile pages (`/kingdom/:id`) below the Atlas Score Breakdown section.

---

## Technical Implementation

### Files Created

| File | Purpose | Size |
|------|---------|------|
| `src/components/ScoreSimulator/simulatorUtils.ts` | TypeScript port of Atlas Score formula | 19KB |
| `src/components/ScoreSimulator/ScoreSimulator.tsx` | Main simulator component | 20KB |
| `src/components/ScoreSimulator/ScoreSimulatorTeaser.tsx` | Teaser for non-Pro users | 7KB |
| `src/components/ScoreSimulator/index.ts` | Module exports | 170B |
| `src/components/ScoreSimulator/simulatorUtils.test.ts` | Unit tests | 8KB |

### Files Modified

| File | Change |
|------|--------|
| `src/contexts/PremiumContext.tsx` | Added `scoreSimulator: boolean` to `PremiumFeatures` interface |
| `src/pages/KingdomProfile.tsx` | Integrated `<ScoreSimulator>` component |

### Algorithm

The Score Simulator uses the same comprehensive Atlas Score formula as the backend, ported to TypeScript:

1. **Hybrid Statistical Win Rate** - Bayesian/Wilson scoring based on sample size
2. **Domination/Invasion Pattern** - Bonus/penalty for double wins/losses
3. **Recent Form** - Last 3 KvKs weighted by recency
4. **Streak Analysis** - Current and best overall streaks
5. **Recent Performance Trend** - Average rates from last 5 KvKs
6. **Experience Scaling** - Logarithmic factor penalizing new kingdoms

---

## Premium Tiers

| Tier | Access |
|------|--------|
| Anonymous | ❌ Teaser only |
| Free | ❌ Teaser only |
| Pro | ✅ Full access |
| Recruiter | ✅ Full access |

---

## Testing

Unit tests cover:
- Valid simulation results
- Score increase on domination
- Score decrease on invasion
- Multiple simulated KvKs
- Edge case: 0 KvKs (new kingdom)
- Edge case: Max streaks
- Tier calculations (S/A/B/C/D)
- All wins/losses scenarios
- Experience factor scaling

---

## Deployment

```bash
# Build
npm run build

# Deploy
npx netlify-cli deploy --prod --dir=dist
```

**Deploy URL:** https://697baba5addbcc6ae0f6ec09--ks-atlas.netlify.app  
**Production URL:** https://ks-atlas.com

---

## Screenshots

Visit any kingdom profile (e.g., https://ks-atlas.com/kingdom/172) to see the feature.

---

## Next Steps (Future Enhancements)

1. Add "what-if" scenario presets (Perfect run, Mixed results)
2. Add sharing for projections
3. Show rank estimate based on current leaderboard
4. Add keyboard shortcuts (Enter to add KvK)
5. Track simulator usage analytics for conversion insights

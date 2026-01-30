# Feature Implementation Plan: Score Simulator Tool

**Feature:** Score Simulator Tool (Pro Feature)  
**Assigned To:** Product Engineer  
**Priority:** HIGH  
**Revenue Impact:** $1,497/mo potential (300 Pro users × $4.99)  
**Date:** 2026-01-29

---

## Executive Summary

"What if I win the next 3 KvKs?" - Users want to project their future Atlas Score. The new formula's experience scaling makes projections valuable, showing how consistency compounds over time.

---

## Goals

- [ ] Create interactive score simulation tool
- [ ] Allow users to input hypothetical KvK results
- [ ] Show projected score changes with explanations
- [ ] Gate behind Pro subscription

---

## Technical Specification

### 1. Frontend-Only Implementation (Product Engineer)

This feature can be **100% frontend** using the existing Atlas Score formula. No backend changes needed.

**Why Frontend-Only:**
- Formula is deterministic (same inputs = same outputs)
- All required data already available from kingdom profile
- Reduces server load
- Instant feedback for users

### 2. Core Components

**New Files:**

```
/apps/web/src/components/
├── ScoreSimulator/
│   ├── ScoreSimulator.tsx         # Main container
│   ├── SimulatorControls.tsx      # KvK result inputs
│   ├── SimulatorResults.tsx       # Projected score display
│   ├── ScoreProjectionChart.tsx   # Before/after visualization
│   └── simulatorUtils.ts          # Score calculation logic
```

### 3. Simulator Interface

**ScoreSimulator.tsx:**
```typescript
interface SimulatorProps {
  kingdom: Kingdom;  // Current kingdom data
  isPro: boolean;
}

interface SimulatedKvK {
  prepResult: 'W' | 'L';
  battleResult: 'W' | 'L';
}

interface SimulationResult {
  currentScore: number;
  projectedScore: number;
  scoreChange: number;
  percentageChange: number;
  newRank?: number;  // Estimated
  breakdown: {
    baseScoreChange: number;
    streakImpact: number;
    experienceGain: number;
    formBonus: number;
  };
  insights: string[];  // "Winning 3 more will boost your streak bonus by +0.5"
}
```

### 4. User Interface Design

```
┌─────────────────────────────────────────────────────┐
│  SCORE SIMULATOR                           [Pro]    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Current Atlas Score: 9.6 (#45)                    │
│                                                     │
│  ┌─ Simulate Next KvKs ──────────────────────────┐ │
│  │                                                │ │
│  │  KvK #11:  [W ▼] Prep   [W ▼] Battle         │ │
│  │  KvK #12:  [W ▼] Prep   [L ▼] Battle         │ │
│  │  KvK #13:  [W ▼] Prep   [W ▼] Battle         │ │
│  │                                                │ │
│  │  [+ Add KvK]              [Reset]             │ │
│  └────────────────────────────────────────────────┘ │
│                                                     │
│  ┌─ Projected Results ───────────────────────────┐ │
│  │                                                │ │
│  │  Projected Score: 11.2  (+1.6)  ⬆️ 17%       │ │
│  │  Estimated Rank: #32 (up 13 spots)           │ │
│  │                                                │ │
│  │  Breakdown:                                   │ │
│  │  • Base win rate: +0.8                       │ │
│  │  • Streak bonus: +0.5 (3-win prep streak)   │ │
│  │  • Experience: +0.2 (now 13 KvKs)           │ │
│  │  • Form bonus: +0.1                          │ │
│  │                                                │ │
│  └────────────────────────────────────────────────┘ │
│                                                     │
│  💡 Insight: "Consistent prep wins have the       │
│     biggest impact on your score right now."       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 5. Score Calculation Logic

**simulatorUtils.ts:**
```typescript
import { calculateAtlasScoreComprehensive } from '../utils/atlasScore';

export function simulateScore(
  kingdom: Kingdom,
  simulatedKvKs: SimulatedKvK[]
): SimulationResult {
  // Clone current stats
  let simStats = { ...kingdom };
  
  for (const kvk of simulatedKvKs) {
    // Update stats
    simStats.total_kvks += 1;
    
    if (kvk.prepResult === 'W') {
      simStats.prep_wins += 1;
      simStats.current_prep_streak = Math.max(1, simStats.current_prep_streak + 1);
    } else {
      simStats.prep_losses += 1;
      simStats.current_prep_streak = Math.min(-1, simStats.current_prep_streak - 1);
    }
    
    // Similar for battle...
    
    // Update recent results
    simStats.recent_prep_rates = [
      ...simStats.recent_prep_rates.slice(-4),
      kvk.prepResult === 'W' ? 1 : 0
    ];
  }
  
  // Calculate new score
  const projectedScore = calculateAtlasScoreComprehensive(simStats);
  
  return {
    currentScore: kingdom.overall_score,
    projectedScore,
    scoreChange: projectedScore - kingdom.overall_score,
    // ... rest of breakdown
  };
}
```

### 6. Premium Gating

**Update:** `/apps/web/src/contexts/PremiumContext.tsx`

```typescript
// Add to PremiumFeatures interface
scoreSimulator: boolean;

// In TIER_FEATURES:
anonymous: { scoreSimulator: false, ... },
free: { scoreSimulator: false, ... },
pro: { scoreSimulator: true, ... },
recruiter: { scoreSimulator: true, ... },
```

### 7. Teaser for Free Users

**ScoreSimulatorTeaser.tsx:**
```typescript
// Shows:
// - Blurred/locked simulator interface
// - "Upgrade to Pro to predict your future Atlas Score"
// - Key benefits: "Plan your KvK strategy", "See streak impact"
// - CTA: "Unlock Simulator" → /upgrade
```

---

## Implementation Steps

### Phase 1: Core Logic (Product Engineer)
1. Port Atlas Score formula to TypeScript in `simulatorUtils.ts`
2. Create simulation state management
3. Test calculations match Python backend
4. Write unit tests for edge cases

### Phase 2: UI Components (Product Engineer)
1. Create `SimulatorControls.tsx` with dropdowns
2. Create `SimulatorResults.tsx` with breakdown
3. Add insights generation logic
4. Style according to `STYLE_GUIDE.md`

### Phase 3: Integration (Product Engineer)
1. Add to `KingdomProfile.tsx` as tab/section
2. Implement premium gating
3. Create teaser component for free users
4. Mobile-responsive layout

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `/apps/web/src/components/ScoreSimulator/ScoreSimulator.tsx` | Create (new) |
| `/apps/web/src/components/ScoreSimulator/SimulatorControls.tsx` | Create (new) |
| `/apps/web/src/components/ScoreSimulator/SimulatorResults.tsx` | Create (new) |
| `/apps/web/src/components/ScoreSimulator/simulatorUtils.ts` | Create (new) |
| `/apps/web/src/components/ScoreSimulator/ScoreSimulatorTeaser.tsx` | Create (new) |
| `/apps/web/src/contexts/PremiumContext.tsx` | Add feature flag |
| `/apps/web/src/pages/KingdomProfile.tsx` | Add simulator section |
| `/apps/web/src/utils/atlasScore.ts` | Create (port from Python) |

---

## Success Criteria

- [ ] Simulator produces accurate projections
- [ ] Users can simulate 1-5 KvKs ahead
- [ ] Clear breakdown of score impact
- [ ] Actionable insights generated
- [ ] Free users see compelling teaser
- [ ] Mobile-responsive

---

## Edge Cases to Handle

| Case | Handling |
|------|----------|
| New kingdom (0 KvKs) | Show "Play your first KvK" message |
| All wins simulated | Show diminishing returns insight |
| All losses simulated | Show recovery path insight |
| Domination outcome | Auto-set both prep & battle to W |

---

## Insights to Generate

```typescript
const insights = [
  "Your prep streak is your strongest asset - keep it going!",
  "One more KvK will push you into veteran territory (8+ KvKs)",
  "A domination here would boost you to S-tier",
  "Losing this KvK would break your 5-win streak",
  "Consistency pays off - your form bonus is maxed",
];
```

---

## Dependencies

- Kingdom data already available from API
- Atlas Score formula documented in `/enhanced_atlas_formulas.py`
- Premium context implemented

---

## Non-Goals (Out of Scope)

- Historical "what if" analysis (past KvKs)
- Comparing simulations between kingdoms
- Saving/sharing simulations

---

**Ready for implementation. Product Engineer can start immediately - no backend work required.**

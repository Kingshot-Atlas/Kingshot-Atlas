# Feature Implementation Plan: Score Breakdown Comparison

**Feature:** Score Breakdown Comparison (Pro Feature)  
**Assigned To:** Product Engineer  
**Priority:** MEDIUM  
**Revenue Impact:** $998/mo potential (200 Pro users × $4.99)  
**Date:** 2026-01-29

---

## Executive Summary

Compare WHERE two kingdoms differ in their Atlas Score components. The new 4-component formula enables meaningful side-by-side breakdowns: "Kingdom A wins on Domination, Kingdom B wins on Streaks."

---

## Goals

- [ ] Enhance existing Compare feature with score breakdown
- [ ] Visual component-by-component comparison
- [ ] Highlight strengths/weaknesses for each kingdom
- [ ] Gate breakdown details behind Pro subscription

---

## Technical Specification

### 1. Existing Compare Page

**Current file:** `/apps/web/src/pages/CompareKingdoms.tsx` (26,978 bytes)

The page already supports comparing kingdoms. This feature **enhances** it with:
- Component-level score breakdown
- Visual "who's better at what" indicators
- Insight generation

### 2. Score Components to Compare

Based on the comprehensive Atlas Score formula:

| Component | Description | Visual |
|-----------|-------------|--------|
| **Base Win Rate** | Overall prep + battle performance | Bar chart |
| **Performance Pattern** | Dominations vs Defeats | Win/loss icons |
| **Form Bonus** | Recent 5 KvK consistency | Trend line |
| **Streak Analysis** | Current + historical streaks | Streak badges |
| **Experience Factor** | KvK count maturity | Level indicator |

### 3. New Components

**Files to create:**

```
/apps/web/src/components/
├── ScoreBreakdownComparison.tsx   # Main comparison component
├── ComponentCompareBar.tsx        # Individual component bar
└── CompareInsights.tsx            # "Kingdom A is better at..."
```

### 4. UI Design

```
┌─────────────────────────────────────────────────────────────────┐
│  SCORE BREAKDOWN COMPARISON                            [Pro]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│        Kingdom 172              vs           Kingdom 245        │
│        Score: 12.4                          Score: 11.8         │
│                                                                 │
│  ┌─ Component Breakdown ────────────────────────────────────┐   │
│  │                                                          │   │
│  │  Base Win Rate                                           │   │
│  │  ████████████░░░░░░ 8.2    vs    ░░░░░░░████████████ 7.9 │   │
│  │  K172 +0.3 ✓                                             │   │
│  │                                                          │   │
│  │  Performance Pattern (Dominations)                       │   │
│  │  ████████░░░░░░░░░░ 1.5    vs    ░░░░░░░░░████████░░ 2.1 │   │
│  │                              K245 +0.6 ✓                 │   │
│  │                                                          │   │
│  │  Form Bonus (Recent 5)                                   │   │
│  │  █████████████░░░░░ 0.8    vs    ░░░░░░░█████████░░░ 0.6 │   │
│  │  K172 +0.2 ✓                                             │   │
│  │                                                          │   │
│  │  Streak Analysis                                         │   │
│  │  ████████████████░░ 0.9    vs    ░░░░░░░░░███████░░░ 0.5 │   │
│  │  K172 +0.4 ✓                                             │   │
│  │                                                          │   │
│  │  Experience Factor                                       │   │
│  │  ████████████░░░░░░ ×0.92  vs    ░░░░░░░░█████████░░ ×0.88│   │
│  │  K172 +0.04 ✓                                            │   │
│  │                                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─ Key Insights ───────────────────────────────────────────┐   │
│  │                                                          │   │
│  │  🏆 K172 leads in: Win Rate, Form, Streaks              │   │
│  │  🏆 K245 leads in: Dominations                          │   │
│  │                                                          │   │
│  │  💡 K245 has more "big wins" but K172 is more           │   │
│  │     consistent overall. K172's streak bonus gives       │   │
│  │     them the edge.                                       │   │
│  │                                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5. Component Implementation

**ScoreBreakdownComparison.tsx:**
```typescript
interface ScoreBreakdownComparisonProps {
  kingdom1: Kingdom;
  kingdom2: Kingdom;
  isPro: boolean;
}

interface ComponentScore {
  name: string;
  kingdom1Value: number;
  kingdom2Value: number;
  maxValue: number;
  description: string;
  winner: 'kingdom1' | 'kingdom2' | 'tie';
  difference: number;
}

function ScoreBreakdownComparison({ kingdom1, kingdom2, isPro }: Props) {
  // Calculate breakdown for each kingdom
  const breakdown1 = calculateScoreBreakdown(kingdom1);
  const breakdown2 = calculateScoreBreakdown(kingdom2);
  
  // Build comparison data
  const components: ComponentScore[] = [
    {
      name: 'Base Win Rate',
      kingdom1Value: breakdown1.baseScore,
      kingdom2Value: breakdown2.baseScore,
      maxValue: 10,
      description: 'Overall prep + battle win percentage',
      winner: breakdown1.baseScore > breakdown2.baseScore ? 'kingdom1' : 'kingdom2',
      difference: Math.abs(breakdown1.baseScore - breakdown2.baseScore),
    },
    // ... other components
  ];
  
  if (!isPro) {
    return <BreakdownTeaser kingdoms={[kingdom1, kingdom2]} />;
  }
  
  return (
    <div className="score-breakdown-comparison">
      {components.map(comp => (
        <ComponentCompareBar key={comp.name} {...comp} />
      ))}
      <CompareInsights components={components} />
    </div>
  );
}
```

### 6. Premium Gating

**Update:** `/apps/web/src/contexts/PremiumContext.tsx`

```typescript
// Add to PremiumFeatures interface
scoreBreakdownComparison: boolean;

// In TIER_FEATURES:
anonymous: { scoreBreakdownComparison: false, ... },
free: { scoreBreakdownComparison: false, ... },
pro: { scoreBreakdownComparison: true, ... },
recruiter: { scoreBreakdownComparison: true, ... },
```

### 7. Free User Experience

**Free users see:**
- Overall score comparison (existing)
- Basic stats comparison (existing)
- **Blurred** breakdown section with "Unlock Pro to see full breakdown"
- Teaser: "See exactly where these kingdoms differ"

---

## Implementation Steps

### Phase 1: Score Breakdown Utility (Product Engineer)
1. Create `calculateScoreBreakdown()` utility function
2. Port component calculations from Python formula
3. Test breakdown accuracy
4. Write unit tests

### Phase 2: UI Components (Product Engineer)
1. Create `ScoreBreakdownComparison.tsx`
2. Create `ComponentCompareBar.tsx` with dual-bar visualization
3. Create `CompareInsights.tsx` with auto-generated insights
4. Style according to `STYLE_GUIDE.md`

### Phase 3: Integration (Product Engineer)
1. Add breakdown section to `CompareKingdoms.tsx`
2. Implement premium gating
3. Create blurred teaser for free users
4. Test with multiple kingdom pairs

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `/apps/web/src/components/ScoreBreakdownComparison.tsx` | Create (new) |
| `/apps/web/src/components/ComponentCompareBar.tsx` | Create (new) |
| `/apps/web/src/components/CompareInsights.tsx` | Create (new) |
| `/apps/web/src/pages/CompareKingdoms.tsx` | Add breakdown section |
| `/apps/web/src/contexts/PremiumContext.tsx` | Add feature flag |
| `/apps/web/src/utils/atlasScore.ts` | Add breakdown function |

---

## Success Criteria

- [ ] Breakdown shows all 5 score components
- [ ] Visual bars clearly show which kingdom leads
- [ ] Winner highlighted for each component
- [ ] Insights auto-generated and relevant
- [ ] Free users see compelling teaser
- [ ] Works with existing multi-compare (3+ kingdoms)

---

## Insights Generation Logic

```typescript
function generateInsights(components: ComponentScore[]): string[] {
  const insights: string[] = [];
  
  // Who wins more categories
  const k1Wins = components.filter(c => c.winner === 'kingdom1').length;
  const k2Wins = components.filter(c => c.winner === 'kingdom2').length;
  
  // Biggest advantage
  const biggestDiff = components.reduce((max, c) => 
    c.difference > max.difference ? c : max
  );
  
  // Strengths
  const k1Strengths = components.filter(c => c.winner === 'kingdom1').map(c => c.name);
  const k2Strengths = components.filter(c => c.winner === 'kingdom2').map(c => c.name);
  
  insights.push(`K1 leads in: ${k1Strengths.join(', ')}`);
  insights.push(`K2 leads in: ${k2Strengths.join(', ')}`);
  insights.push(`Biggest gap: ${biggestDiff.name} (${biggestDiff.difference.toFixed(1)} points)`);
  
  return insights;
}
```

---

## Dependencies

- Existing `CompareKingdoms.tsx` page
- Atlas Score formula documented
- Premium context implemented

---

## Non-Goals (Out of Scope)

- Historical comparison (score over time)
- 3+ kingdom breakdown (start with 2)
- Export/share comparison

---

**Ready for implementation. Product Engineer can start immediately - enhances existing feature.**

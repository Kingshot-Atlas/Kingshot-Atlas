# Feature Implementation Plan: Atlas Score History Timeline

**Feature:** Atlas Score History Timeline (Pro Feature)  
**Assigned To:** Product Engineer + Platform Engineer  
**Priority:** HIGH  
**Revenue Impact:** $2,495/mo potential (500 Pro users × $4.99)  
**Date:** 2026-01-29

---

## Executive Summary

Users want to track their kingdom's Atlas Score progression over time. This feature shows a visual timeline/graph of score changes after each KvK, directly leveraging the new formula to demonstrate consistency value.

---

## Goals

- [ ] Store historical Atlas Score snapshots after each KvK
- [ ] Create interactive timeline chart component
- [ ] Gate behind Pro subscription
- [ ] Show teaser to free users with upgrade prompt

---

## Technical Specification

### 1. Database Schema (Platform Engineer)

**New Table: `atlas_score_history`**

```sql
-- Create score history table
CREATE TABLE atlas_score_history (
    id SERIAL PRIMARY KEY,
    kingdom_number INTEGER NOT NULL REFERENCES kingdoms(kingdom_number),
    kvk_number INTEGER NOT NULL,
    atlas_score FLOAT NOT NULL,
    score_breakdown JSONB,  -- Store component scores
    rank_at_time INTEGER,
    recorded_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(kingdom_number, kvk_number)
);

-- Index for fast lookups
CREATE INDEX idx_score_history_kingdom ON atlas_score_history(kingdom_number);
CREATE INDEX idx_score_history_kvk ON atlas_score_history(kvk_number DESC);
```

**Score Breakdown JSONB Structure:**
```json
{
  "baseScore": 8.5,
  "performanceScore": 1.2,
  "formBonus": 0.8,
  "streakBonus": 0.5,
  "trendBonus": 0.3,
  "experienceFactor": 0.85,
  "totalBeforeExp": 11.3,
  "finalScore": 9.6
}
```

### 2. Backend API (Platform Engineer)

**File:** `/apps/api/main.py`

**New Endpoints:**

```python
@app.get("/api/kingdoms/{kingdom_number}/score-history")
async def get_score_history(kingdom_number: int, limit: int = 20):
    """Get Atlas Score history for a kingdom (Pro feature)"""
    # Requires Pro subscription check
    pass

@app.post("/api/internal/record-score-snapshot")
async def record_score_snapshot(kingdom_number: int, kvk_number: int):
    """Internal: Record score snapshot after KvK processing"""
    # Called by data pipeline after processing KvK results
    pass
```

**Response Schema:**
```json
{
  "kingdom_number": 172,
  "history": [
    {
      "kvk_number": 10,
      "atlas_score": 12.4,
      "rank": 45,
      "score_change": +0.8,
      "rank_change": +3,
      "recorded_at": "2026-01-26T00:00:00Z",
      "breakdown": { ... }
    }
  ],
  "trend": "improving",
  "avg_change_per_kvk": 0.35
}
```

### 3. Frontend Components (Product Engineer)

**New Files:**

```
/apps/web/src/components/
├── ScoreHistoryTimeline.tsx      # Main timeline component
├── ScoreHistoryChart.tsx         # Chart visualization
├── ScoreChangeIndicator.tsx      # +/- change badges
└── ScoreHistoryTeaser.tsx        # Upgrade prompt for free users
```

**ScoreHistoryTimeline.tsx Structure:**
```typescript
interface ScoreHistoryTimelineProps {
  kingdomNumber: number;
  isPro: boolean;
}

// Shows:
// - Line chart of Atlas Score over KvKs
// - Score change indicators (+0.8, -0.3)
// - Rank progression
// - Hover tooltips with breakdown
// - Free users see blurred preview + upgrade CTA
```

**Integration Points:**
- Add to `KingdomProfile.tsx` as new tab/section
- Use existing `usePremium()` hook for gating
- Follow `STYLE_GUIDE.md` for chart colors/styling

### 4. Premium Gating (Product Engineer)

**Update:** `/apps/web/src/contexts/PremiumContext.tsx`

```typescript
// Add to PremiumFeatures interface
scoreHistoryTimeline: boolean;

// In TIER_FEATURES:
anonymous: { scoreHistoryTimeline: false, ... },
free: { scoreHistoryTimeline: false, ... },
pro: { scoreHistoryTimeline: true, ... },
recruiter: { scoreHistoryTimeline: true, ... },
```

### 5. Data Pipeline Integration (Platform Engineer)

**Update:** `/regenerate_kingdoms_with_atlas_score.py`

After calculating new Atlas Score, call:
```python
def record_score_history(kingdom_number, kvk_number, score, breakdown):
    """Record historical snapshot after KvK processing"""
    # Insert into atlas_score_history table
    pass
```

---

## Implementation Steps

### Phase 1: Database & Backend (Platform Engineer)
1. Create `atlas_score_history` table migration
2. Add API endpoint for fetching history
3. Update data pipeline to record snapshots
4. Backfill historical data from existing KvK records
5. Test API responses

### Phase 2: Frontend (Product Engineer)
1. Create `ScoreHistoryChart.tsx` with Recharts or Chart.js
2. Create `ScoreHistoryTimeline.tsx` wrapper component
3. Add premium gating logic
4. Create `ScoreHistoryTeaser.tsx` for free users
5. Integrate into `KingdomProfile.tsx`
6. Style according to `STYLE_GUIDE.md`

### Phase 3: Integration & Testing
1. End-to-end test with real kingdom data
2. Test premium gating (anonymous → free → pro)
3. Mobile responsiveness check
4. Performance test with large history

---

## Files to Modify

| File | Agent | Action |
|------|-------|--------|
| `/apps/api/models.py` | Platform | Add ScoreHistory model |
| `/apps/api/main.py` | Platform | Add API endpoints |
| `/apps/api/schemas.py` | Platform | Add response schemas |
| `/regenerate_kingdoms_with_atlas_score.py` | Platform | Add snapshot recording |
| `/apps/web/src/contexts/PremiumContext.tsx` | Product | Add feature flag |
| `/apps/web/src/pages/KingdomProfile.tsx` | Product | Add timeline section |
| `/apps/web/src/components/ScoreHistoryTimeline.tsx` | Product | Create (new) |
| `/apps/web/src/components/ScoreHistoryChart.tsx` | Product | Create (new) |

---

## Success Criteria

- [ ] Score history stored for all KvKs going forward
- [ ] Historical data backfilled for existing kingdoms
- [ ] Chart renders smoothly with 20+ data points
- [ ] Free users see teaser, Pro users see full chart
- [ ] Breakdown tooltip shows score components
- [ ] Mobile-responsive chart

---

## Dependencies

- Existing Atlas Score calculation in `enhanced_atlas_formulas.py`
- Premium context already implemented
- KvK records exist in database

---

## Non-Goals (Out of Scope)

- Prediction/forecasting (separate feature)
- Comparing multiple kingdoms' histories (separate feature)
- Real-time score updates (batch process is fine)

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Large history tables | Index properly, paginate API |
| Missing historical data | Backfill script from KvK records |
| Chart performance | Use virtualization for 50+ points |

---

**Ready for implementation. Start with Platform Engineer for backend, then Product Engineer for frontend.**

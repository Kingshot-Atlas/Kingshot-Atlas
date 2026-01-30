# Atlas Score Implementation Guide

**Version:** 2.0 Comprehensive Formula  
**Date:** 2026-01-29  
**Purpose:** Step-by-step implementation plan for the new Atlas Score system

---

## Overview

This guide provides the complete implementation roadmap for deploying the comprehensive Atlas Score formula across the Kingshot Atlas system.

---

## Phase 1: Database Schema Updates

### 1.1 Kingdoms Table Enhancements

**Add new columns to track streaks and recent performance:**

```sql
-- Current streaks (can be negative for loss streaks)
ALTER TABLE kingdoms 
ADD COLUMN current_prep_streak INTEGER DEFAULT 0,
ADD COLUMN current_battle_streak INTEGER DEFAULT 0;

-- Overall best streaks (always positive)
ALTER TABLE kingdoms 
ADD COLUMN overall_prep_streak INTEGER DEFAULT 0,
ADD COLUMN overall_battle_streak INTEGER DEFAULT 0;

-- Recent performance tracking (JSON arrays)
ALTER TABLE kingdoms 
ADD COLUMN recent_prep_rates JSONB DEFAULT '[]',
ADD COLUMN recent_battle_rates JSONB DEFAULT '[]';
```

### 1.2 Indexes for Performance

```sql
-- Indexes for streak queries
CREATE INDEX idx_kingdoms_current_prep_streak ON kingdoms(current_prep_streak);
CREATE INDEX idx_kingdoms_current_battle_streak ON kingdoms(current_battle_streak);
CREATE INDEX idx_kingdoms_overall_prep_streak ON kingdoms(overall_prep_streak);
CREATE INDEX idx_kingdoms_overall_battle_streak ON kingdoms(overall_battle_streak);

-- Index for JSON performance data
CREATE INDEX idx_kingdoms_recent_prep_rates ON kingdoms USING GIN(recent_prep_rates);
CREATE INDEX idx_kingdoms_recent_battle_rates ON kingdoms USING GIN(recent_battle_rates);
```

---

## Phase 2: Data Migration

### 2.1 Historical Streak Calculation

**Script to calculate existing streaks from historical data:**

```python
def calculate_historical_streaks(kingdom_id):
    \"\"\"Calculate current and overall streaks from existing KvK data\"\"\"
    
    # Get all KvK results for this kingdom, ordered by date
    kvk_results = get_kingdom_kvk_history(kingdom_id)
    
    # Calculate current streaks
    current_prep_streak = 0
    current_battle_streak = 0
    
    # Work backwards from most recent
    for kvk in reversed(kvk_results):
        if kvk.prep_result == 'W':
            if current_prep_streak >= 0:
                current_prep_streak += 1
            else:
                break  # Streak ended
        elif kvk.prep_result == 'L':
            if current_prep_streak <= 0:
                current_prep_streak -= 1
            else:
                break  # Streak ended
                
        # Similar logic for battle streak
        if kvk.battle_result == 'W':
            if current_battle_streak >= 0:
                current_battle_streak += 1
            else:
                break
        elif kvk.battle_result == 'L':
            if current_battle_streak <= 0:
                current_battle_streak -= 1
            else:
                break
    
    # Calculate overall best streaks
    overall_prep_streak = 0
    overall_battle_streak = 0
    temp_prep_streak = 0
    temp_battle_streak = 0
    
    for kvk in kvk_results:
        # Reset streak counter on losses
        if kvk.prep_result == 'L':
            overall_prep_streak = max(overall_prep_streak, temp_prep_streak)
            temp_prep_streak = 0
        elif kvk.prep_result == 'W':
            temp_prep_streak += 1
            
        # Same for battle
        if kvk.battle_result == 'L':
            overall_battle_streak = max(overall_battle_streak, temp_battle_streak)
            temp_battle_streak = 0
        elif kvk.battle_result == 'W':
            temp_battle_streak += 1
    
    # Final check for ongoing streaks
    overall_prep_streak = max(overall_prep_streak, temp_prep_streak)
    overall_battle_streak = max(overall_battle_streak, temp_battle_streak)
    
    return {
        'current_prep_streak': current_prep_streak,
        'current_battle_streak': current_battle_streak,
        'overall_prep_streak': overall_prep_streak,
        'overall_battle_streak': overall_battle_streak
    }
```

### 2.2 Recent Performance Calculation

**Script to calculate last 5 KvK performance trends:**

```python
def calculate_recent_performance(kingdom_id):
    \"\"\"Calculate win rates for last 5 KvKs\"\"\"
    
    kvk_results = get_kingdom_kvk_history(kingdom_id)
    recent_kvks = kvk_results[-5:]  # Last 5 KvKs
    
    recent_prep_rates = []
    recent_battle_rates = []
    
    for kvk in recent_kvks:
        # Calculate prep win rate for this KvK
        prep_wins = 1 if kvk.prep_result == 'W' else 0
        prep_rate = prep_wins / 1  # Single KvK, so rate is 0 or 1
        recent_prep_rates.append(prep_rate)
        
        # Calculate battle win rate for this KvK  
        battle_wins = 1 if kvk.battle_result == 'W' else 0
        battle_rate = battle_wins / 1
        recent_battle_rates.append(battle_rate)
    
    return {
        'recent_prep_rates': recent_prep_rates,
        'recent_battle_rates': recent_battle_rates
    }
```

### 2.3 Migration Execution

**Run migration script for all kingdoms:**

```python
def migrate_all_kingdoms():
    \"\"\"Migrate all existing kingdoms to new schema\"\"\"
    
    kingdoms = get_all_kingdoms()
    
    for kingdom in kingdoms:
        # Calculate streaks
        streaks = calculate_historical_streaks(kingdom.id)
        
        # Calculate recent performance
        recent = calculate_recent_performance(kingdom.id)
        
        # Update database
        update_kingdom_enhanced_data(kingdom.id, {
            **streaks,
            **recent
        })
        
        print(f\"Migrated kingdom {kingdom.id}: {kingdom.name}\")

# Execute migration
migrate_all_kingdoms()
```

---

## Phase 3: Backend Implementation

### 3.1 Update Score Calculation Function

**Replace existing function in `regenerate_kingdoms_with_atlas_score.py`:**

```python
from enhanced_atlas_formulas import calculate_atlas_score_comprehensive

def calculate_kingdom_atlas_score(kingdom_data):
    \"\"\"Calculate comprehensive Atlas Score for a kingdom\"\"\"
    
    return calculate_atlas_score_comprehensive(
        total_kvks=kingdom_data['total_kvks'],
        prep_wins=kingdom_data['prep_wins'],
        prep_losses=kingdom_data['prep_losses'],
        battle_wins=kingdom_data['battle_wins'],
        battle_losses=kingdom_data['battle_losses'],
        dominations=kingdom_data['dominations'],
        defeats=kingdom_data['defeats'],
        recent_results=kingdom_data['recent_results'],
        current_prep_streak=kingdom_data['current_prep_streak'],
        current_battle_streak=kingdom_data['current_battle_streak'],
        overall_prep_streak=kingdom_data['overall_prep_streak'],
        overall_battle_streak=kingdom_data['overall_battle_streak'],
        recent_prep_rates=kingdom_data['recent_prep_rates'],
        recent_battle_rates=kingdom_data['recent_battle_rates']
    )
```

### 3.2 API Endpoint Updates

**Update kingdom endpoints to include new fields:**

```python
# In main.py - update kingdom response schema
@app.get("/api/kingdoms/{kingdom_id}")
async def get_kingdom(kingdom_id: int):
    kingdom = get_kingdom_by_id(kingdom_id)
    
    return {
        "id": kingdom.id,
        "name": kingdom.name,
        "power": kingdom.power,
        "total_kvks": kingdom.total_kvks,
        "prep_wins": kingdom.prep_wins,
        "prep_losses": kingdom.prep_losses,
        "battle_wins": kingdom.battle_wins,
        "battle_losses": kingdom.battle_losses,
        "dominations": kingdom.dominations,
        "defeats": kingdom.defeats,
        "recent_results": kingdom.recent_results,
        "overall_score": kingdom.overall_score,
        
        # NEW FIELDS
        "current_prep_streak": kingdom.current_prep_streak,
        "current_battle_streak": kingdom.current_battle_streak,
        "overall_prep_streak": kingdom.overall_prep_streak,
        "overall_battle_streak": kingdom.overall_battle_streak,
        "recent_prep_rates": kingdom.recent_prep_rates,
        "recent_battle_rates": kingdom.recent_battle_rates,
    }
```

### 3.3 Score Recalculation

**Script to recalculate all Atlas Scores:**

```python
def recalculate_all_scores():
    \"\"\"Recalculate Atlas Scores for all kingdoms using new formula\"\"\"
    
    kingdoms = get_all_kingdoms()
    
    for kingdom in kingdoms:
        # Get all required data
        kingdom_data = {
            'total_kvks': kingdom.total_kvks,
            'prep_wins': kingdom.prep_wins,
            'prep_losses': kingdom.prep_losses,
            'battle_wins': kingdom.battle_wins,
            'battle_losses': kingdom.battle_losses,
            'dominations': kingdom.dominations,
            'defeats': kingdom.defeats,
            'recent_results': kingdom.recent_results,
            'current_prep_streak': kingdom.current_prep_streak,
            'current_battle_streak': kingdom.current_battle_streak,
            'overall_prep_streak': kingdom.overall_prep_streak,
            'overall_battle_streak': kingdom.overall_battle_streak,
            'recent_prep_rates': kingdom.recent_prep_rates,
            'recent_battle_rates': kingdom.recent_battle_rates
        }
        
        # Calculate new score
        new_score = calculate_kingdom_atlas_score(kingdom_data)
        
        # Update database
        kingdom.overall_score = new_score
        kingdom.save()
        
        print(f\"Updated {kingdom.name}: {kingdom.overall_score} → {new_score}\")

# Execute recalculation
recalculate_all_scores()
```

---

## Phase 4: Frontend Updates

### 4.1 TypeScript Interface Updates

**Update types in `/apps/web/src/types/index.ts`:**

```typescript
interface Kingdom {
  id: number;
  name: string;
  power: number;
  total_kvks: number;
  prep_wins: number;
  prep_losses: number;
  battle_wins: number;
  battle_losses: number;
  dominations: number;
  defeats: number;
  recent_results: string[];
  overall_score: number;
  
  // NEW FIELDS
  current_prep_streak: number;
  current_battle_streak: number;
  overall_prep_streak: number;
  overall_battle_streak: number;
  recent_prep_rates: number[];
  recent_battle_rates: number[];
}
```

### 4.2 Atlas Score Breakdown Component

**Enhanced score display component:**

```typescript
interface AtlasScoreBreakdownProps {
  kingdom: Kingdom;
  showDetails?: boolean;
}

function AtlasScoreBreakdown({ kingdom, showDetails = false }: AtlasScoreBreakdownProps) {
  const breakdown = calculateScoreBreakdown(kingdom);
  
  return (
    <div className=\"atlas-score-breakdown\">
      <div className=\"score-main\">
        <span className=\"score-value\" style={neonGlow(colors.cyan)}>
          {kingdom.overall_score.toFixed(1)}
        </span>
        <span className=\"score-rank\">#{kingdom.rank}</span>
      </div>
      
      {showDetails && (
        <div className=\"score-details\">
          <div className=\"component\">
            <span>Base Win Rate:</span>
            <span>+{breakdown.baseScore.toFixed(1)}</span>
          </div>
          <div className=\"component\">
            <span>Performance Pattern:</span>
            <span>{breakdown.performanceScore >= 0 ? '+' : ''}{breakdown.performanceScore.toFixed(1)}</span>
          </div>
          <div className=\"component\">
            <span>Recent Form:</span>
            <span>+{breakdown.formBonus.toFixed(1)}</span>
          </div>
          <div className=\"component\">
            <span>Streak Analysis:</span>
            <span>{breakdown.streakBonus >= 0 ? '+' : ''}{breakdown.streakBonus.toFixed(1)}</span>
          </div>
          <div className=\"component\">
            <span>Recent Trend:</span>
            <span>+{breakdown.trendBonus.toFixed(1)}</span>
          </div>
          <div className=\"component experience\">
            <span>Experience Factor:</span>
            <span>×{breakdown.experienceFactor.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
```

### 4.3 Streak Display Components

**New components for streak visualization:**

```typescript
function StreakDisplay({ streak, type }: { streak: number; type: 'prep' | 'battle' }) {
  const isLossStreak = streak < 0;
  const streakLength = Math.abs(streak);
  
  return (
    <div className={`streak-display ${isLossStreak ? 'loss' : 'win'}`}>
      <span className=\"streak-type\">{type === 'prep' ? 'Prep' : 'Battle'}</span>
      <span className=\"streak-length\">{streakLength}</span>
      <span className=\"streak-direction\">{isLossStreak ? '↓' : '↑'}</span>
    </div>
  );
}

function RecentPerformanceTrend({ rates }: { rates: number[] }) {
  if (rates.length === 0) return null;
  
  const avgRate = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
  
  return (
    <div className=\"recent-trend\">
      <div className=\"trend-label\">Last {rates.length} KvKs</div>
      <div className=\"trend-rate\">{(avgRate * 100).toFixed(0)}%</div>
      <div className=\"trend-bars\">
        {rates.map((rate, i) => (
          <div 
            key={i} 
            className=\"trend-bar\" 
            style={{ height: `${rate * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}
```

---

## Phase 5: Testing & Validation

### 5.1 Unit Tests

**Test the new formula components:**

```python
# test_enhanced_formulas.py
import pytest
from enhanced_atlas_formulas import calculate_atlas_score_comprehensive, calculate_streak_bonus

def test_early_kingdom_bias():
    \"\"\"Test that early kingdoms are properly penalized\"\"\"
    
    # Perfect 1-0 kingdom should be heavily penalized
    score = calculate_atlas_score_comprehensive(
        total_kvks=1, prep_wins=1, prep_losses=0, battle_wins=1, battle_losses=0,
        dominations=1, defeats=0, recent_results=['D'],
        current_prep_streak=1, current_battle_streak=1,
        overall_prep_streak=1, overall_battle_streak=1,
        recent_prep_rates=[1.0], recent_battle_rates=[1.0]
    )
    
    # Should be significantly lower than equivalent veteran kingdom
    assert score < 5.0  # Heavy penalty for single KvK

def test_veteran_kingdom_reward():
    \"\"\"Test that veteran kingdoms are properly rewarded\"\"\"
    
    # Strong 12-4 kingdom should score well
    score = calculate_atlas_score_comprehensive(
        total_kvks=12, prep_wins=10, prep_losses=2, battle_wins=8, battle_losses=4,
        dominations=6, defeats=3, recent_results=['D', 'W', 'D'],
        current_prep_streak=4, current_battle_streak=3,
        overall_prep_streak=6, overall_battle_streak=5,
        recent_prep_rates=[0.8, 0.75, 0.9, 0.7, 0.85],
        recent_battle_rates=[0.7, 0.65, 0.8, 0.6, 0.75]
    )
    
    # Should score in competitive range
    assert 10.0 <= score <= 15.0

def test_streak_calculations():
    \"\"\"Test streak bonus/penalty calculations\"\"\"
    
    # Win streak bonus
    win_bonus = calculate_streak_bonus(5, is_current=True)
    assert win_bonus == 0.7
    
    # Loss streak penalty  
    loss_penalty = calculate_streak_bonus(-3, is_current=True)
    assert loss_penalty == -0.5
    
    # Overall streak (always positive)
    overall_bonus = calculate_streak_bonus(8, is_current=False)
    assert overall_bonus == 1.0
```

### 5.2 Integration Tests

**Test end-to-end score calculation:**

```python
def test_score_calculation_pipeline():
    \"\"\"Test complete score calculation pipeline\"\"\"
    
    # Create test kingdom with all data
    kingdom = create_test_kingdom()
    
    # Calculate score using new formula
    score = calculate_kingdom_atlas_score(kingdom)
    
    # Verify score is in valid range
    assert 0 <= score <= 20
    
    # Test API endpoint
    response = client.get(f\"/api/kingdoms/{kingdom.id}\")
    assert response.status_code == 200
    assert response.json()['overall_score'] == score
```

### 5.3 Performance Tests

**Ensure formula doesn't impact performance:**

```python
def test_formula_performance():
    \"\"\"Test formula calculation performance\"\"\"
    
    import time
    
    # Test calculation time for 1000 kingdoms
    start_time = time.time()
    
    for i in range(1000):
        calculate_atlas_score_comprehensive(
            total_kvks=10, prep_wins=7, prep_losses=3, battle_wins=6, battle_losses=4,
            dominations=5, defeats=2, recent_results=['W', 'D', 'L'],
            current_prep_streak=2, current_battle_streak=1,
            overall_prep_streak=4, overall_battle_streak=3,
            recent_prep_rates=[0.7, 0.8, 0.6, 0.75, 0.65],
            recent_battle_rates=[0.6, 0.7, 0.5, 0.8, 0.6]
        )
    
    end_time = time.time()
    calculation_time = end_time - start_time
    
    # Should complete in reasonable time
    assert calculation_time < 1.0  # Less than 1 second for 1000 calculations
```

---

## Phase 6: Deployment Strategy

### 6.1 Pre-Deployment Checklist

- [ ] Database schema updates applied
- [ ] Data migration completed successfully
- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] Performance tests passing
- [ ] Frontend components updated
- [ ] API endpoints tested
- [ ] Documentation updated

### 6.2 Deployment Steps

1. **Database Migration**
   ```bash
   # Apply schema changes
   psql -d kingshot_atlas -f migrations/atlas_score_v2.sql
   ```

2. **Data Migration**
   ```bash
   # Run migration script
   python3 migrate_atlas_score_data.py
   ```

3. **Score Recalculation**
   ```bash
   # Recalculate all scores
   python3 recalculate_atlas_scores.py
   ```

4. **Backend Deployment**
   ```bash
   # Deploy updated API
   cd apps/api && git push origin main
   ```

5. **Frontend Deployment**
   ```bash
   # Build and deploy updated frontend
   cd apps/web && npm run build && npx netlify-cli deploy --prod
   ```

### 6.3 Post-Deployment Monitoring

**Monitor these metrics for 24 hours:**

- API response times
- Database query performance  
- Frontend rendering performance
- User feedback on score changes
- Score distribution sanity checks

---

## Phase 7: Rollback Plan

### 7.1 Immediate Rollback

If critical issues detected:

1. **Database Rollback**
   ```sql
   -- Restore previous schema
   ROLLBACK;
   ```

2. **Code Rollback**
   ```bash
   git revert <commit-hash>
   ```

3. **Score Restoration**
   ```bash
   # Restore previous scores from backup
   python3 restore_previous_scores.py
   ```

### 7.2 Data Backup

**Create backups before deployment:**

```bash
# Database backup
pg_dump kingshot_atlas > backup_$(date +%Y%m%d_%H%M%S).sql

# Score backup
python3 backup_current_scores.py
```

---

## Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Database Schema | 2 hours | Database access |
| Data Migration | 4 hours | Historical data |
| Backend Updates | 3 hours | Schema complete |
| Frontend Updates | 4 hours | Backend complete |
| Testing & Validation | 6 hours | All components |
| Deployment | 2 hours | Tests passing |
| **Total** | **21 hours** | **3 days** |

---

## Success Criteria

### Technical Success
- [ ] All kingdoms have complete data for new formula
- [ ] Score calculation completes in < 100ms per kingdom
- [ ] No negative scores in final results
- [ ] Score distribution is reasonable (0-20 range)

### Business Success  
- [ ] Early kingdoms (1-2 KvKs) see 20-30% score reduction
- [ ] Veteran kingdoms (8+ KvKs) see 30-45% score increase
- [ ] User feedback indicates improved ranking accuracy
- [ ] No significant performance degradation

---

## Conclusion

This implementation guide provides a complete roadmap for deploying the comprehensive Atlas Score formula. The phased approach ensures safe deployment with proper testing and rollback capabilities.

The new formula addresses all identified issues while maintaining system performance and user experience.

**Ready for implementation pending approval.**

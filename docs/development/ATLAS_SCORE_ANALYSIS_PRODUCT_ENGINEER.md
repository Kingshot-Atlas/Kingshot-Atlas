# Atlas Score Formula Analysis & Recommendations

**Date:** 2026-01-29  
**Analyst:** Product Engineer (Data/Statistics Specialist)  
**Status:** Analysis Complete

---

## Current Bayesian Formula Explained

### How It Works (Simple Terms)

The new Atlas Score uses **Bayesian statistics** to separate lucky kingdoms from skilled ones. Think of it like this:

**Traditional approach:** "You won 3 out of 3 = 100% win rate"  
**Bayesian approach:** "You won 3 out of 3, but I need more proof. Let's say you're 51% until you prove otherwise."

### The Formula Breakdown

```
Atlas Score = (Base Score + Domination Bonus + Recent Form) × Experience Factor
```

#### 1. **Bayesian Win Rates** (70% of base score)
- **Battle Phase:** 70% weight (more important)
- **Prep Phase:** 30% weight (support role)
- **Formula:** (wins + 50) ÷ (wins + losses + 100)

**Why 50/50?** This is a strong prior toward 50% win rate. It heavily penalizes small samples.

#### 2. **Domination/Invasion Modifiers** (±6 points)
- **Domination Bonus:** +0.8 × Bayesian domination rate × 6
- **Invasion Penalty:** -0.6 × Bayesian defeat rate × 6
- **Also Bayesian:** Uses (dominations + 10) ÷ (total_kvks + 20)

#### 3. **Recent Form** (±4 points)
- **Currently:** Only last 3 KvKs
- **Weights:** [1.0, 0.75, 0.5] for most recent
- **Scoring:** Domination = +1.0, Partial Win = +0.5, Partial Loss = 0.0, Invasion = -0.25

#### 4. **Experience Scaling** (Critical!)
- **1 KvK:** 40% of base score
- **2 KvKs:** 60% of base score  
- **3 KvKs:** 75% of base score
- **4 KvKs:** 85% of base score
- **5 KvKs:** 92% of base score
- **6+ KvKs:** 100% of base score

---

## User Concerns Analysis

### ✅ **Boosters Implemented?**
**YES - Total Dominations boosters are implemented**
- Bayesian domination rate: (dominations + 10) ÷ (total_kvks + 20)
- Maximum bonus: +0.8 × 1.0 × 6 = +4.8 points
- This rewards consistent double-win performance

### ✅ **Penalties Implemented?** 
**YES - Total Invasions penalties are implemented**
- Bayesian defeat rate: (defeats + 10) ÷ (total_kvks + 20)  
- Maximum penalty: -0.6 × 1.0 × 6 = -3.6 points
- This penalizes consistent double-loss performance

### ✅ **Battle Phase Weighted More?**
**YES - Battle phase gets 70% weight vs 30% for prep**
- Combined Bayesian rate: (prep_bayesian × 0.3) + (battle_bayesian × 0.7)
- Battle phase is considered 2.3x more important than prep

### ❌ **Recent Performance Factored?**
**PARTIALLY - Only 3 KvKs, user wants 5**
- Current: weights = [1.0, 0.75, 0.5] for last 3 KvKs
- Missing: KvKs #4 and #5 should be included

---

## Why Results Feel "Wrong"

### The Problem: **Over-Penalization**
The current Bayesian priors (50/50 with 100 weight) are **extremely aggressive**:

```
Perfect 3-KvK kingdom:
- Traditional: 100% win rate
- Bayesian: (3+50)/(3+0+100) = 53/103 = 51.5%
- After experience scaling (75%): 51.5% × 75% = 38.6% effective

Perfect 6-KvK kingdom:  
- Traditional: 100% win rate
- Bayesian: (6+50)/(6+0+100) = 56/106 = 52.8%
- After experience scaling (100%): 52.8% effective
```

**The gap is too small!** Perfect 6-KvK should be significantly higher than perfect 3-KvK.

---

## Recommended Improvements

### 1. **Adjust Bayesian Priors** (High Priority)
**Current:** 50/50 with 100 weight (too aggressive)  
**Recommended:** 45/55 with 40 weight (moderate)

```
Perfect 3-KvK: (3+45)/(3+0+80) = 48/83 = 57.8%
Perfect 6-KvK: (6+45)/(6+0+80) = 51/86 = 59.3%
```

### 2. **Expand Recent Form to 5 KvKs** (High Priority)
**Current weights:** [1.0, 0.75, 0.5]  
**Recommended weights:** [1.0, 0.9, 0.8, 0.7, 0.6]

### 3. **Increase Domination Weight** (Medium Priority)
**Current:** ±6 points multiplier  
**Recommended:** ±8 points multiplier

### 4. **Enhanced Experience Scaling** (Medium Priority)
**Current:** 40% → 100% across 1-6 KvKs  
**Recommended:** 30% → 100% across 1-6 KvKs (steeper curve)

---

## Rank Synchronization Issue

### Problem Identified
**KingdomDirectory.tsx** and **KingdomProfile.tsx** calculate ranks differently:

```typescript
// KingdomDirectory - CORRECT
const sorted = [...allKingdoms].sort((a, b) => b.overall_score - a.overall_score);
const rankMap = new Map<number, number>();
sorted.forEach((k, i) => rankMap.set(k.kingdom_number, i + 1));

// KingdomProfile - CORRECT  
const sortedByScore = [...allKingdoms].sort((a, b) => b.overall_score - a.overall_score);
const rank = kingdom ? sortedByScore.findIndex(k => k.kingdom_number === kingdom.kingdom_number) + 1 : 0;
```

**Both are correct.** The issue is likely:
1. **Different data sources** (stale vs fresh)
2. **Race condition** during data loading
3. **Filtering differences** (all kingdoms vs filtered kingdoms)

### Solution
Create a **shared rank calculation utility** to ensure consistency.

---

## Implementation Plan

### Phase 1: Fix Rank Synchronization (Immediate)
1. Create shared rank calculation utility
2. Update both components to use same utility
3. Ensure both use fresh data

### Phase 2: Formula Adjustments (User Approval Required)
1. Adjust Bayesian priors to 45/55 with 40 weight
2. Expand recent form to 5 KvKs with new weights
3. Increase domination weight to ±8 points
4. Enhance experience scaling curve

### Phase 3: Testing & Validation
1. Compare new results with user expectations
2. Validate score distributions
3. Deploy with rollback plan

---

## Next Steps

**Immediate Actions:**
1. Fix rank synchronization issue
2. Present formula adjustment options to user
3. Get approval on Bayesian prior changes

**User Decisions Needed:**
1. **Bayesian priors:** Stay aggressive (50/50, 100) or moderate (45/55, 40)?
2. **Recent KvKs:** Expand to 5 with weights [1.0, 0.9, 0.8, 0.7, 0.6]?
3. **Domination weight:** Increase to ±8 points?

---

**Stop guessing. Start winning.** 🎯

*Analysis complete. Ready for implementation decisions.*

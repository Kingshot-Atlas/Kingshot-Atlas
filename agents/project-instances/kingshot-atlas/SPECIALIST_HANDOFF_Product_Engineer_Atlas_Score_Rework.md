# Specialist Handoff: Product Engineer

**Project:** Kingshot Atlas  
**Date:** 2026-01-29  
**From:** Atlas Director  
**To:** Product Engineer  

## Task

Rework the Atlas Score formula to create a balanced scoring system that properly weighs experience, performance, and recent form while avoiding biases toward early or older kingdoms.

## Goals

- [ ] Analyze current Atlas Score implementation and identify bias issues
- [ ] Design new formula incorporating all specified variables and modifiers
- [ ] Create balanced weighting that doesn't over-reward early kingdoms (high win rates, low sample size)
- [ ] Create balanced weighting that doesn't over-reward older kingdoms (high win amounts, diminishing returns)
- [ ] Implement the new formula with clear documentation
- [ ] Provide comprehensive breakdown and analysis of how the formula works

## Constraints

- Must incorporate ALL specified base variables: prep wins, prep win rate, battle wins, battle win rate, KvK count, prep/battle win streaks (current & overall)
- Must include ALL bonuses: overall domination rate, recent 5 KvK prep/battle win rates
- Must include ALL penalties: overall invasion rate, current prep/battle loss streaks
- Must balance early vs older kingdom advantages
- Must maintain statistical soundness (avoid rewarding small sample sizes)
- Must be implementable in the existing codebase

## Context

The current Atlas Score uses Wilson Score with basic experience scaling. Users report it's not properly balanced - early kingdoms with lucky win streaks score too high, and the formula doesn't incorporate all the desired variables. The enhanced_atlas_formulas.py file contains two prototype options (Bayesian and Enhanced Wilson) for reference.

## Success Criteria

1. **Comprehensive Formula:** All specified variables are properly incorporated
2. **Balance:** No systematic advantage for early or older kingdoms
3. **Clarity:** Formula is well-documented and understandable
4. **Implementation:** Ready to integrate with existing kingdom data
5. **Analysis:** Clear breakdown showing how each component affects the final score

## Files to Review

- `/enhanced_atlas_formulas.py` - Current formula and prototype options
- `/regenerate_kingdoms_with_atlas_score.py` - Implementation of current formula
- `/process_kvks.py` - Data processing logic
- `/docs/BRAND_GUIDE.md` - Brand voice requirements for any user-facing content

## Expected Deliverables

1. New Atlas Score formula implementation
2. Comprehensive formula documentation
3. Analysis of formula behavior with test cases
4. Implementation recommendations
5. User-facing explanation (if needed)

---

**Handoff prepared by:** Atlas Director  
**Priority:** High - Core scoring system affects all user-facing rankings

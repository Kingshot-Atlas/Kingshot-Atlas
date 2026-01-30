# Specialist Handoff: Design Lead

**Project:** Kingshot Atlas  
**Date:** 2026-01-29  
**From:** Atlas Director  

## Task

Update all user-facing documentation and content to reflect the new Bayesian Average Atlas Score formula (Option 1). This is a critical change that affects how users understand kingdom rankings.

## Goals
- [ ] Update README.md with new formula explanation
- [ ] Update any formula documentation in /docs/
- [ ] Review web copy for Atlas Score references
- [ ] Ensure tooltips and help text reflect the new approach
- [ ] Maintain brand voice throughout all updates

## Constraints
- **DO NOT** modify component logic or calculations
- **DO NOT** change API endpoints
- **Focus ONLY on user-facing text and documentation**
- **Follow brand guide strictly** - competitive, gaming-focused, data-driven

## Context

### Formula Change Summary
We switched from Wilson Score confidence intervals to Bayesian Average with strong priors. Key changes:

1. **Bayesian Win Rates**: (wins + 50) / (wins + losses + 100)
2. **Stronger Experience Scaling**: 40% for 1 KvK → 100% for 6+ KvKs  
3. **Increased Domination Weight**: 5x → 6x multiplier

### Impact on Users
- **New kingdoms (1-3 KvKs)**: Scores drop 20-40%
- **Established kingdoms (6+ KvKs)**: Minimal impact
- **Better differentiation** between lucky newcomers and proven performers

### Brand Voice Requirements
- **Competitive & Gaming-focused**: "Stop guessing. Start winning."
- **Analytical & Data-driven**: "Data-driven dominance" 
- **Direct & Punchy**: No corporate fluff
- **Community-powered**: "Built by Kingdom 172 players"

## Success Criteria
- [ ] README.md clearly explains the Bayesian approach
- [ ] Users understand why experience matters more now
- [ ] All documentation is consistent
- [ ] Brand voice is maintained throughout
- [ ] Technical accuracy is preserved

## Files to Review
- `/README.md` - Main project documentation
- `/docs/` directory - Any formula documentation
- `/apps/web/src/` - Component text, tooltips, help content
- Any other user-facing content with Atlas Score references

## Key Messages to Emphasize
- "More accurate rankings for better migration decisions"
- "Experience matters - no more lucky newcomers beating proven kingdoms"  
- "Bayesian statistics used by top gaming communities"
- "Real data. Real results. No spin."

Return with summary of changes made and any recommendations for additional updates.

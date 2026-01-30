---
description: Auto-route any Kingshot Atlas task to the appropriate agent
---

# Auto-Router Workflow

When invoked, follow these steps:

## 1. Load Context
Read these files to understand the project:
- `/docs/VISION.md` — Mission, values, decision filter
- `/agents/AGENT_REGISTRY.md` — Team structure, scope matrix
- `/agents/project-instances/kingshot-atlas/STATUS_SNAPSHOT.md` — Current state
- `/agents/project-instances/kingshot-atlas/FEATURES_IMPLEMENTED.md` — What's already built

## 2. Pre-Task Check (MANDATORY)
Before starting work:
- Search `ACTIVITY_LOG.md` — Was this already done?
- Search `FEATURES_IMPLEMENTED.md` — Is this already implemented?
- Grep codebase for existing implementations if building features
- If already done, inform user and suggest alternatives

## 3. Classify the Task
Route based on primary domain:

| If task involves... | Route to |
|---------------------|----------|
| UI components, React, features, user flows | **Product Engineer** |
| API, database, security, architecture, performance | **Platform Engineer** |
| CSS, styling, design tokens, brand, visual design | **Design Lead** |
| Deployment, CI/CD, SEO, analytics, monitoring | **Ops Lead** |
| Revenue, pricing, monetization, growth strategy | **Business Lead** |
| Patch notes, changelog, user communications | **Release Manager** |
| Multi-domain, strategic, unclear, or orchestration | **Atlas Director** |

## 4. Adopt Agent Identity
// turbo
Read the selected agent's files:
- `SPECIALIST.md` — Identity, competencies, boundaries
- `LATEST_KNOWLEDGE.md` — Current patterns, gotchas

Work within that agent's scope and follow their workflows.

## 5. Execute Task
- Claim files before editing (check `FILE_CLAIMS.md`)
- Follow the agent's specific workflow for the task type
- Stay within scope boundaries
- Apply the Decision Filter from VISION.md

## 6. Post-Task Documentation (MANDATORY)
After completing work:

### Update STATUS_SNAPSHOT.md
- New project state

### Log to ACTIVITY_LOG.md
```
[YYYY-MM-DD HH:MM] [AGENT] ACTION: Brief description
```

### Update FEATURES_IMPLEMENTED.md (if new feature)
Add row with: Feature | Status | Date | Agent | Notes

### Update LATEST_KNOWLEDGE.md (if new patterns discovered)
- Technical decisions
- Gotchas or edge cases
- Dependencies discovered

### Provide Summary
- What was done
- Why it was done
- Files changed
- 3 suggestions for next steps (5 tasks each)
  - **Each suggestion MUST include a short explanation of WHY it's suggested** (business value, user impact, or technical debt reduction)

## 8. Recommended Next Steps Library

### A. Email Notification System
**WHY:** Reduces churn by 15-25%. Users who receive timely emails have 3x higher retention. Critical for subscription businesses.
1. Set up transactional email service (Resend/SendGrid)
2. Send welcome email on subscription start
3. Send renewal reminder 3 days before billing
4. Send cancellation confirmation with win-back offer
5. Add email templates to codebase

### B. Webhook Event Logging & Monitoring
**WHY:** Without webhook visibility, you're blind to payment failures. 5-10% of payments fail silently without proper monitoring.
1. Log all Stripe webhook events to database
2. Create webhook events tab in admin dashboard
3. Add retry queue for failed webhook deliveries
4. Add event filtering and search
5. Add webhook health status indicator

### C. A/B Testing Framework
**WHY:** Enables data-driven decisions. Companies with A/B testing grow 2x faster because they validate changes before full rollout.
1. Create feature flag system in PremiumContext
2. Add A/B test assignment and tracking
3. Build experiment dashboard in admin
4. Add statistical significance calculator
5. Create variant performance comparison view

### D. Advanced Revenue Analytics
**WHY:** Understanding revenue patterns predicts problems before they happen. MRR trends, expansion revenue, and contraction signal business health.
1. Add expansion/contraction MRR tracking
2. Build revenue cohort analysis
3. Add trial-to-paid conversion tracking
4. Create revenue attribution by source
5. Add revenue alerts (anomaly detection)

### E. User Feedback Collection
**WHY:** Direct user feedback has 10x more signal than analytics. NPS scores predict churn 6 months in advance.
1. Add in-app feedback widget
2. Create NPS survey system
3. Build feature request voting board
4. Add bug report submission flow
5. Create feedback analytics dashboard

## 7. Vision Alignment Check
Before delivering, verify:
- [ ] Does this help players make better decisions?
- [ ] Does this maintain data integrity principles?
- [ ] Does this align with competitive-but-fair values?
- [ ] Would core users find this valuable?

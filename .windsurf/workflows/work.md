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

## 7. Vision Alignment Check
Before delivering, verify:
- [ ] Does this help players make better decisions?
- [ ] Does this maintain data integrity principles?
- [ ] Does this align with competitive-but-fair values?
- [ ] Would core users find this valuable?

---
description: Auto-route any Kingshot Atlas task to the appropriate agent
---

# /task Workflow

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
- **Query Supabase** — If task involves database, use `mcp3_list_tables` to check current schema
- If already done, inform user and suggest alternatives

### Supabase State Check (for database-related tasks)
```
Use mcp3_list_tables with project_id: qdczmafwcvnwfvixxbwg
This shows all existing tables, columns, RLS status, and row counts.
NEVER suggest creating a table without checking if it already exists.
```

## 3. Architecture Review (MANDATORY for data/API/storage changes)
**Prevents architectural debt. Check BEFORE implementing.**

### Trigger Conditions
Run this check if task involves ANY of:
- [ ] Adding a new data store (database, cache, file)
- [ ] Changing how data flows between systems
- [ ] Adding new API endpoints that write data
- [ ] Modifying submission/approval workflows
- [ ] Adding real-time or sync features

### Architecture Check Steps
1. **Read** `/docs/DATA_LAYER_ARCHITECTURE_ANALYSIS.md` — Current data flow
2. **Read** `/agents/project-instances/kingshot-atlas/DECISIONS.md` — Existing ADRs
3. **Ask these questions:**
   - Where will this data live? (Supabase / SQLite / JSON / multiple?)
   - How will it sync to other systems?
   - Does this create a new source of truth or use an existing one?
   - Will all pages that display this data get updated?
4. **If adding a new data path:** Document in DECISIONS.md as a new ADR
5. **If conflicting with existing architecture:** STOP and discuss with user

### Red Flags (STOP and discuss)
- ⛔ Task requires data in multiple stores without clear sync plan
- ⛔ "Just make it work for now" shortcuts on data layer
- ⛔ Frontend and backend using different data sources for same entity
- ⛔ No clear answer to "what is the source of truth?"

## 4. Classify the Task
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

## 5. Adopt Agent Identity
// turbo
Read the selected agent's files:
- `SPECIALIST.md` — Identity, competencies, boundaries
- `LATEST_KNOWLEDGE.md` — Current patterns, gotchas

Work within that agent's scope and follow their workflows.

## 6. Execute Task
- Claim files before editing (check `FILE_CLAIMS.md`)
- Follow the agent's specific workflow for the task type
- Stay within scope boundaries
- Apply the Decision Filter from VISION.md

## 7. Post-Task Documentation (MANDATORY)
After completing work:

### Log to ACTIVITY_LOG.md (REQUIRED - enables patch note generation)
Append new entry at the TOP of the log:
```
## YYYY-MM-DD HH:MM | [Agent] | COMPLETED
Task: [Brief description]
Files: [Paths affected]
Result: [Outcome]
```

### Update STATUS_SNAPSHOT.md
- New project state

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

## 8. Generate Dynamic Suggestions
Based on the completed task, generate **1 suggested next step** with 5 sub-tasks.

### Rules for Suggestions
- **Must be contextually related** to what was just completed
- **Must include WHY** — business value, user impact, or tech debt reduction
- **Prioritize by impact:** Revenue > User Experience > Technical Debt > Nice-to-Have

### Suggestion Categories (pick the most relevant)
| Just Completed | Suggest Next |
|----------------|---------------|
| New feature | Polish, testing, or analytics for that feature |
| Bug fix | Related hardening, monitoring, or similar bug class fixes |
| API work | Client integration, error handling, or documentation |
| UI component | Accessibility, responsive design, or related components |
| Database change | Data validation, migration testing, or backup strategy |
| Security fix | Audit related areas, add tests, or monitoring |
| Performance | Measure impact, extend to similar areas, or add benchmarks |

### Format
```
**Suggested Next: [Title]**
WHY: [1-2 sentences on business/user impact]
1. [Task 1]
2. [Task 2]
3. [Task 3]
4. [Task 4]
5. [Task 5]
```

## 9. Vision Alignment Check
Before delivering, verify:
- [ ] Does this help players make better decisions?
- [ ] Does this maintain data integrity principles?
- [ ] Does this align with competitive-but-fair values?
- [ ] Would core users find this valuable?

## 10. MANDATORY: Local Build Verification
**CRITICAL: Before ending ANY task, verify the build works locally.**

// turbo
```bash
cd /Users/giovanni/projects/ai/Kingshot\ Atlas/apps/web && npm run build
```

### If build fails:
1. Fix errors before marking task complete
2. Re-run build to verify fix
3. Document any gotchas in `LATEST_KNOWLEDGE.md`

### If build succeeds:
- Task is complete
- Changes remain local (uncommitted)
- Ready for user review

## 11. Commit & Deploy (ONLY WHEN EXPLICITLY REQUESTED)
**DO NOT run this automatically. Only when user says "commit", "deploy", or "ship".**

```bash
git status
git add -A
git commit -m "descriptive message"
git push origin main
```

**Note:** Production deployment happens via CI/CD after push to main.

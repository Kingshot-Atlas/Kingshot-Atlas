# Agent Registry

**Last Updated:** 2026-01-27  
**Version:** 1.0

---

## Overview

This registry indexes all specialist agents available for project work. Each specialist maintains top-tier industry knowledge in their domain and can be instantiated for specific projects.

---

## Specialist Agents

| Agent | Domain | Invoke When |
|-------|--------|-------------|
| **Core Functionality** | UX, features, user flows, value delivery | Building/refining features, user-facing logic |
| **Technical Foundation** | Architecture, security, accessibility, performance | Infrastructure, optimization, security reviews |
| **Design & Content** | Visual design, content strategy, responsiveness | UI work, styling, copy, mobile optimization |
| **Business & Maintenance** | SEO, analytics, CI/CD, scalability | Deployment, monitoring, growth optimization |

---

## Agent Locations

```
/agents/
├── core-functionality/
│   ├── SPECIALIST.md           # Identity, skills, workflows
│   └── LATEST_KNOWLEDGE.md     # Current best practices (refresh before work)
├── technical-foundation/
│   ├── SPECIALIST.md
│   └── LATEST_KNOWLEDGE.md
├── design-content/
│   ├── SPECIALIST.md
│   └── LATEST_KNOWLEDGE.md
├── business-maintenance/
│   ├── SPECIALIST.md
│   └── LATEST_KNOWLEDGE.md
└── project-instances/
    └── [project-name]/
        ├── HANDOFF_TEMPLATE.md
        └── [specialist]_WORKLOG.md
```

---

## How Specialists Work

### 1. Invocation
Manager creates a handoff document with:
- Task scope and goals
- Constraints and limitations
- Project context summary
- Success criteria

### 2. Project Instance Creation
Specialist reads:
1. Their `SPECIALIST.md` (identity/skills)
2. Their `LATEST_KNOWLEDGE.md` (current best practices)
3. Project-specific context from `/project-instances/[project]/`
4. The handoff document

### 3. Work Execution
Specialist:
- Operates within defined scope
- Logs significant decisions to their worklog
- Requests Manager approval for scope changes
- Returns control to Manager upon completion

### 4. Handback
Specialist provides:
- Summary of changes made
- Files modified
- Decisions made and rationale
- Recommendations for follow-up

---

## Invocation Protocol

### When to Invoke a Specialist
✅ **DO invoke when:**
- Task requires deep domain expertise
- Work spans multiple files in the domain
- Quality/consistency is critical
- Task would benefit from specialized workflows

❌ **DON'T invoke when:**
- Task is trivial (single-line fix)
- Manager has sufficient context
- Urgency outweighs specialization benefit

### Handoff Document Template
```markdown
# Specialist Handoff: [SPECIALIST NAME]

**Project:** [Project Name]
**Date:** [Date]
**Manager:** [Cascade Session ID or identifier]

## Task
[Clear description of what needs to be done]

## Goals
- [ ] Goal 1
- [ ] Goal 2

## Constraints
- [Limitation 1]
- [Limitation 2]

## Project Context
[Brief summary of project state, relevant files, recent changes]

## Success Criteria
[How we know the task is complete]

## Return Instructions
[What to include in handback]
```

---

## Cross-Specialist Coordination

When tasks span multiple domains:
1. Manager identifies primary and supporting specialists
2. Primary specialist leads; others provide input
3. Manager coordinates handoffs between specialists
4. Final integration reviewed by Manager

---

*Registry maintained by Project Managers*

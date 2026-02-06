# Agent Protocol - Kingshot Atlas

**Last Updated:** 2026-01-28  
**Status:** Active  
**Version:** 3.0 (Coordination System)

---

## CRITICAL RULE
Never rely on long chat history as memory.  
Agents are responsible for preserving continuity when context grows.

---

## CONTEXT AWARENESS

| Threshold | Action |
|-----------|--------|
| ~65-70% | Prepare for handoff |
| ~75% | **STOP** immediately → enter HANDOFF MODE |

---

## HANDOFF MODE (MANDATORY)

When triggered:

### 1) STOP WORK
- Do not implement new changes
- Do not spawn new worker agents

### 2) WRITE STATE PACKET
Create/update `/docs/STATE_PACKET.md` with:

```markdown
# STATE PACKET

## Goal
[What the system is trying to achieve]

## Current Status
[What works, what doesn't]

## Verified Facts
[Numbers, endpoints, constraints]

## Key Decisions & Assumptions
[Important choices made]

## Source-of-Truth Declarations
[Authoritative files/docs]

## Files Changed
[Paths only]

## Commands Run
[List]

## Tests Run + Results
[Pass/fail status]

## Known Risks / Unknowns
[Issues to watch]

## Next Exact Steps
- [ ] Step 1
- [ ] Step 2
- [ ] ...
```

### 3) WRITE RESUME PROMPT
Generate ready-to-paste prompt that:
- Declares itself as a continuation
- Points to STATE_PACKET.md as full context
- Says "Do not assume anything not in the State Packet"
- Begins execution from "Next exact steps"

### 4) HALT
Stop responding. Wait for user to open new Cascade.

---

## WORKER AGENT HANDOFFS

If any worker agent approaches context limits:
1. Instruct it to enter HANDOFF MODE
2. Require mini state packet
3. Incorporate into Manager's STATE_PACKET.md

---

## STOP CONDITIONS

Enter HANDOFF MODE if:
- Context threshold reached
- Scope unclear or drifting
- Phase completed with no next action authorized

---

## SOURCE OF TRUTH POLICY

- Persist all critical rules, formulas, contracts in `/docs/*`
- Never rely on "remembering" rules across Cascades
- Files > chat memory

---

## COORDINATION SYSTEM (MANDATORY)

All agents MUST follow this workflow to prevent conflicts and maintain visibility.

### Before Starting ANY Work

```
1. READ  /agents/project-instances/kingshot-atlas/STATUS_SNAPSHOT.md
2. CHECK /agents/project-instances/kingshot-atlas/FILE_CLAIMS.md
3. SCAN  /agents/project-instances/kingshot-atlas/ACTIVITY_LOG.md (last 24h)
```

### File Claiming (REQUIRED before editing)

1. Check `FILE_CLAIMS.md` - if file is claimed, coordinate with Manager
2. Add your claim with timestamp and task description
3. Claims expire after 2 hours - stale claims can be overridden

**Claim format:**
```markdown
| apps/web/src/pages/Example.tsx | Core-Functionality | 2026-01-28 10:00 | Feature X | 2026-01-28 12:00 |
```

### Activity Logging (REQUIRED)

Log to `ACTIVITY_LOG.md` when:
- Starting a task (STATUS: STARTED)
- Completing a task (STATUS: COMPLETED)
- Getting blocked (STATUS: BLOCKED)

**Log format:**
```markdown
## 2026-01-28 10:00 | Core-Functionality | STARTED
Task: Add pagination to directory
Files: apps/web/src/pages/KingdomDirectory.tsx
```

### Decision Logging

Log significant decisions to your worklog at:
`/agents/project-instances/kingshot-atlas/worklogs/[your-agent].md`

### After Completing Work

```
1. RELEASE claims in FILE_CLAIMS.md
2. LOG completion in ACTIVITY_LOG.md
3. UPDATE STATUS_SNAPSHOT.md
4. UPDATE your worklog with decisions made
```

---

## DEPLOYMENT POLICY

**LOCAL ONLY by default.**  
- Run `npm run build` and test locally
- Do NOT deploy unless user explicitly says "deploy", "commit", or "ship"
- For local testing, use `npm start` or `npx serve build/`

---

## DEFAULT BEHAVIOR

| Priority | Action |
|----------|--------|
| 1 | Logs > questions |
| 2 | Files > chat memory |
| 3 | Verification > polish |
| 4 | Correctness > speed |

---

---

## AGENT SYSTEM

The Manager Agent orchestrates 4 specialist agents for domain-specific work.

### Available Agents

| Agent | Domain | Location |
|-------|--------|----------|
| **Manager** | Coordination, planning, orchestration | `/agents/manager/` |
| **Core Functionality** | UX, features, user flows | `/agents/core-functionality/` |
| **Technical Foundation** | Architecture, security, performance | `/agents/technical-foundation/` |
| **Design & Content** | Visual design, styling, content | `/agents/design-content/` |
| **Business & Maintenance** | SEO, analytics, CI/CD, deployment | `/agents/business-maintenance/` |

### When to Invoke Specialists

✅ **DO invoke when:**
- Task requires deep domain expertise
- Work spans multiple files in one domain
- Quality/consistency is critical

❌ **DON'T invoke when:**
- Task is trivial (single-line fix)
- Manager has sufficient context
- Urgency outweighs specialization benefit

### Invocation Process

1. **Prepare Handoff**
   - Copy template from `/agents/project-instances/kingshot-atlas/HANDOFF_TEMPLATE.md`
   - Fill in task details, goals, constraints
   - Save as `HANDOFF_[SPECIALIST]_[DATE].md`

2. **Specialist Reads**
   - Their `SPECIALIST.md` (identity/skills)
   - Their `LATEST_KNOWLEDGE.md` (current best practices)
   - Project's `PROJECT_CONTEXT.md`
   - The handoff document

3. **Specialist Works**
   - Operates within defined scope
   - Logs decisions to worklog
   - Requests Manager approval for scope changes

4. **Handback**
   - Summary of changes
   - Files modified
   - Decisions and rationale
   - Follow-up recommendations

### Registry Location

Full documentation: `/agents/AGENT_REGISTRY.md`

---

*Maintained by Manager Agent*

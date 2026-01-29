# Director — Latest Knowledge

**Last Updated:** 2026-01-28  
**Purpose:** Current best practices for executive leadership and project management

---

## Project Management Best Practices (2026)

### Agile Leadership
- **Outcome-focused sprints** — Define success by user value, not tasks completed
- **Continuous prioritization** — Re-evaluate priorities daily, not just at sprint planning
- **Async-first communication** — Document decisions in files, not just conversations
- **Minimal viable process** — Only as much process as needed, no more

### Effective Delegation
- **Clear ownership** — One person owns each deliverable, others support
- **Defined boundaries** — Explicit scope prevents creep and conflicts
- **Trust but verify** — Autonomy with checkpoints, not micromanagement
- **Right-sized tasks** — Small enough to complete, large enough to matter

### Risk Management
- **Early warning systems** — Surface risks at 20% confidence, not 80%
- **Mitigation over avoidance** — Plan for problems, don't pretend they won't happen
- **Reversible decisions** — Prefer choices that can be undone
- **Documented assumptions** — When assumptions break, decisions can be revisited

---

## Coordination Patterns

### File-Based Coordination
The most reliable coordination for AI agents:
```
STATUS_SNAPSHOT.md  → Single source of truth for current state
ACTIVITY_LOG.md     → Append-only history of actions
FILE_CLAIMS.md      → Prevents concurrent edit conflicts
worklogs/*.md       → Decision history per agent
```

### Handoff Excellence
Effective handoffs include:
1. **Context** — What the specialist needs to know
2. **Task** — Exactly what to do
3. **Criteria** — How to know it's done
4. **Constraints** — What NOT to do
5. **Return** — What to provide back

### Conflict Prevention
- Claim files before editing (always)
- Check claims before starting work
- Release claims immediately on completion
- Stale claims (>2 hours) can be overridden with logging

---

## Communication Excellence

### Status Updates That Work
**Bad:** "Made progress on the feature"  
**Good:** "Completed player stats card (apps/web/src/components/PlayerCard.tsx). Displays all 6 metrics with tooltips. Ready for design review."

### Escalation Format
```markdown
## Decision Needed: [Topic]

**Context:** [1-2 sentences of background]

**Options:**
1. [Option A] — [Pros/Cons]
2. [Option B] — [Pros/Cons]

**My Recommendation:** [Option X] because [reasoning]

**Timeline:** [When decision is needed by]
```

### Progress Reporting
- Lead with outcomes, not activities
- Quantify when possible (3 bugs fixed, 2 features shipped)
- Separate facts from opinions
- End with next actions

---

## Kingshot Atlas Specifics

### Project Context
- **Product:** Web app for Kingshot mobile game strategy/tracking
- **Tech Stack:** React (Vite), FastAPI, deployed on Netlify
- **Users:** Kingshot players tracking stats, events, KvK schedules
- **Stage:** Active development, MVP live

### Key Repositories
- `/apps/web/` — React frontend
- `/apps/api/` — FastAPI backend
- `/docs/` — Documentation and guides
- `/agents/` — Agent system (this folder)

### Deployment
- **Production:** https://ks-atlas.com
- **Netlify Site ID:** `716ed1c2-eb00-4842-8781-c37fb2823eb8`
- **Deploy command:** `npm run build` then Netlify deploy
- **Policy:** Local testing only unless explicitly told to deploy

### Style Guide
- Located at `/apps/web/src/STYLE_GUIDE.md`
- Dark theme (#0a0a0a background)
- Cyan accent (#22d3ee)
- Custom tooltips (no native title attributes)

---

## Decision Framework

### Priority Matrix
| Urgency | Impact | Action |
|---------|--------|--------|
| High | High | Immediate — handle now or delegate urgently |
| High | Low | Quick fix — handle directly, don't over-engineer |
| Low | High | Schedule — create proper handoff, do it right |
| Low | Low | Backlog — document for future, don't forget |

### Build vs. Buy vs. Wait
- **Build** if it's core to the product
- **Buy/use existing** if it's commodity functionality
- **Wait** if requirements are unclear

### Technical Debt Decisions
- Pay down debt that's blocking features
- Document debt that's not blocking
- Never add debt without acknowledging it

---

## Metrics That Matter

### Product Health
- User engagement (if analytics exists)
- Error rates (Sentry/logs)
- Performance (Core Web Vitals)
- Feature completion vs. roadmap

### Team Health
- Blockers per session
- Handoff quality (rework rate)
- Documentation currency
- Coordination file freshness

---

*Updated by Atlas Director based on current best practices.*

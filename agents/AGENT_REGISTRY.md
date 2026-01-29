# Agent Registry

**Last Updated:** 2026-01-29  
**Version:** 3.2 (Added Security Specialist sub-agent)

---

## Overview

Kingshot Atlas is run by a professional team of specialized AI agents, structured like an industry-leading company. The **Atlas Director** serves as CEO, reporting directly to the Owner and orchestrating all specialist agents.

---

## Organization Chart

```
                         ┌─────────────────┐
                         │   OWNER (You)   │
                         └────────┬────────┘
                                  │ Reports to
                         ┌────────▼────────┐
                         │  ATLAS DIRECTOR │
                         │   (Executive)   │
                         └────────┬────────┘
                                  │ Orchestrates
    ┌───────────┬───────────┬─────┴─────┬───────────┬───────────┐
    ▼           ▼           ▼           ▼           ▼           ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│PRODUCT │ │PLATFORM│ │ DESIGN │ │  OPS   │ │BUSINESS│ │RELEASE │
│ENGINEER│ │ENGINEER│ │  LEAD  │ │  LEAD  │ │  LEAD  │ │MANAGER │
└────────┘ └───┬────┘ └────────┘ └────────┘ └────────┘ └────────┘
               │
               ▼
          ┌────────┐
          │SECURITY│
          │  SPEC  │
          └────────┘
```

---

## Brand Compliance (MANDATORY)

**All agents MUST follow the brand guide when creating or updating any user-facing content.**

### Reference Document
`/docs/BRAND_GUIDE.md` - The authoritative source for brand voice, personality, and messaging.

### Brand Voice Summary
| Trait | Meaning | Example |
|-------|---------|---------|
| Competitive & Gaming-focused | Speak to players who want to win | "Stop guessing. Start winning." |
| Analytical & Data-driven | Facts over opinions, results over rumors | "Data-driven dominance" |
| Direct & Punchy | No corporate fluff, get to the point | "No more blind migrations" |
| Community-powered | We're players, not a corporation | "Built by Kingdom 172 players" |

---

## Critical Setup Requirements (MANDATORY)

**All agents MUST review `/docs/CRITICAL_SETUP.md` before any deployment or database work.**

### Key Requirements
1. **Database Setup:** Always run `/docs/migrations/recreate_profiles.sql` for new setups
2. **Service Worker:** Never cache external resources - causes CSP violations
3. **Avatar CORS:** Use `referrerPolicy="no-referrer"` for Akamai CDN images
4. **Schema Cache:** Run `NOTIFY pgrst, 'reload schema'` after table changes

### Common Issues
- Kingshot Player Linking not persisting → Missing database columns
- Avatar images not loading → CORS issue with Akamai CDN
- CSP violations in console → Service worker caching external resources
- Supabase 406/400 errors → PostgREST schema cache outdated

---

## Terminology Standards
| Use This | Not This |
|----------|----------|
| KvK | Kingdom vs Kingdom (after first use) |
| Prep Phase / Battle Phase | Preparation Phase / Combat Phase |
| Transfer Event | Migration Event |
| Atlas Score | Rating / Points |
| Domination | Double win |
| Invasion | Double loss |
| S-Tier, A-Tier, etc. | Top tier, high tier |

---

## The Team

| Agent | Role | Domain | Invoke When |
|-------|------|--------|-------------|
| **Atlas Director** | CEO | Strategy, orchestration, reporting | Starting work, status checks, multi-agent tasks |
| **Product Engineer** | Core Dev | Features, UX, React, data integration | Building features, user-facing logic, components |
| **Platform Engineer** | Tech Lead | API, security, performance, architecture | Backend work, security, optimization |
| ↳ **Security Specialist** | Sub-agent | Vulnerability assessment, pen testing, incident response | Security audits, threat modeling, compliance |
| **Design Lead** | Creative | UI design, styling, content, brand | Visual work, CSS, content, responsive design, **brand enforcement** |
| **Ops Lead** | DevOps | CI/CD, deployment, SEO, analytics | Deployment, monitoring, SEO, infrastructure |
| **Business Lead** | Revenue | Monetization, growth, market research | Pricing, conversion, user growth, competitive analysis |
| **Release Manager** | Comms | Patch notes, changelog, announcements | Every 3 days, user communications |

---

## Agent Locations

```
/agents/
├── AGENT_REGISTRY.md              # This file
├── director/
│   ├── SPECIALIST.md              # Executive identity, autonomy levels
│   └── LATEST_KNOWLEDGE.md        # Leadership best practices
├── product-engineer/
│   ├── SPECIALIST.md              # Identity, React expertise
│   └── LATEST_KNOWLEDGE.md        # Frontend best practices
├── platform-engineer/
│   ├── SPECIALIST.md              # Identity, backend expertise
│   ├── LATEST_KNOWLEDGE.md        # API/security best practices
│   └── security-specialist/       # Sub-agent
│       ├── SPECIALIST.md          # Security expertise
│       └── LATEST_KNOWLEDGE.md    # Current threats & tools
├── design-lead/
│   ├── SPECIALIST.md              # Identity, design expertise
│   └── LATEST_KNOWLEDGE.md        # CSS/design best practices
├── ops-lead/
│   ├── SPECIALIST.md              # Identity, DevOps expertise
│   └── LATEST_KNOWLEDGE.md        # CI/CD/SEO best practices
├── business-lead/
│   ├── SPECIALIST.md              # Identity, revenue/growth expertise
│   └── LATEST_KNOWLEDGE.md        # Monetization best practices
├── release-manager/
│   ├── SPECIALIST.md              # Identity, communications
│   ├── LATEST_KNOWLEDGE.md        # Patch notes best practices
│   └── templates/                 # Patch notes & Discord templates
└── project-instances/
    └── kingshot-atlas/
        ├── STATUS_SNAPSHOT.md     # Current project state
        ├── ACTIVITY_LOG.md        # Real-time action log
        ├── FILE_CLAIMS.md         # Conflict prevention
        └── worklogs/              # Per-agent decision logs
```

---

## Agent Boundaries

### Scope Matrix

| Agent | Owns (Writes) | Reads | Never Touches |
|-------|---------------|-------|---------------|
| **Director** | Coordination files, STATE_PACKET | Everything | Code (delegates) |
| **Product Engineer** | `/apps/web/src/` (components, logic) | Specs, worklogs | CSS-only, API |
| **Platform Engineer** | `/apps/api/`, build config, types | Architecture docs | UI components |
| **Design Lead** | CSS, design tokens, content, `/docs/BRAND_GUIDE.md` | Style guide | Component logic |
| **Ops Lead** | CI/CD, deployment, SEO config | Monitoring data | Feature code |
| **Business Lead** | Pricing strategy, growth docs, marketing copy | Analytics, user feedback | Code implementation |
| **Release Manager** | `/docs/releases/`, CHANGELOG | All worklogs (read-only) | Everything else |

---

## Director Autonomy

The Atlas Director can make certain decisions independently:

### ✅ Auto-Approve (No Owner approval needed)
- Bug fix prioritization
- Specialist assignment
- Task sequencing
- Documentation updates
- Minor improvements

### ⚠️ Needs Owner Approval
- New feature development
- Breaking changes
- Strategic direction changes
- Major architectural decisions
- External integrations

### 🚨 Escalate Immediately
- Security vulnerabilities
- Data integrity issues
- Production outages
- Blocking resource constraints

---

## Patch Notes Schedule

The **Release Manager** compiles user-facing patch notes **every 3 days**.

### Process
1. Read all agent worklogs from past 3 days
2. Filter for user-relevant changes
3. Categorize: ✨ New, 🐛 Fixed, 🔧 Improved
4. Publish to `/docs/releases/PATCH_NOTES_YYYY-MM-DD.md`
5. Update `/docs/CHANGELOG.md`
6. Post to Discord via `POST /api/discord/webhook/patch-notes`

### What Gets Included
- ✅ User-visible features
- ✅ Bug fixes users noticed
- ✅ Performance improvements
- ❌ Internal refactoring
- ❌ Code cleanup
- ❌ Agent system changes

---

## Coordination Protocol

### Starting Work
```
1. READ STATUS_SNAPSHOT.md     → Current state
2. CHECK FILE_CLAIMS.md        → No conflicts
3. SCAN ACTIVITY_LOG.md        → Recent history
4. CLAIM files before editing
5. LOG "STARTED" in ACTIVITY_LOG.md
6. DO the work
7. LOG decisions in worklog
8. RELEASE claims
9. LOG "COMPLETED" in ACTIVITY_LOG.md
10. UPDATE STATUS_SNAPSHOT.md
```

### File Claiming Rules
- **Check before editing** — Never edit a claimed file
- **Claim before starting** — Add claim with timestamp
- **Release on completion** — Remove claim when done
- **2-hour expiry** — Stale claims can be overridden by Director

---

## Handoff Protocol

### When Director Invokes a Specialist

1. **Prepare Handoff Document**
   ```markdown
   # Specialist Handoff: [AGENT NAME]
   
   **Project:** Kingshot Atlas
   **Date:** [Date]
   **From:** Atlas Director
   
   ## Task
   [Clear description]
   
   ## Goals
   - [ ] Goal 1
   - [ ] Goal 2
   
   ## Constraints
   - [What NOT to do]
   
   ## Context
   [Relevant background]
   
   ## Success Criteria
   [How we know it's done]
   ```

2. **Specialist Reads**
   - Their `SPECIALIST.md`
   - Their `LATEST_KNOWLEDGE.md`
   - Project files in `/project-instances/kingshot-atlas/`
   - The handoff document

3. **Specialist Works**
   - Claims files
   - Executes task
   - Logs decisions
   - Stays within scope

4. **Specialist Returns**
   - Summary of changes
   - Files modified
   - Decisions made
   - Follow-up recommendations

---

## Post-Task Requirements (MANDATORY)

**After completing ANY task, ALL agents MUST:**

### 1. Document Knowledge
Record all relevant information that must be known by yourself or other agents in the future:
- Technical decisions and rationale
- API endpoints, secrets, or configurations discovered
- Gotchas, edge cases, or lessons learned
- Dependencies or prerequisites for future work

**Where to document:**
- Agent-specific: Update your `LATEST_KNOWLEDGE.md`
- Project-wide: Update `/docs/` or relevant documentation
- Cross-agent: Update `AGENT_REGISTRY.md` if it affects coordination

### 2. Provide Summary Report
Deliver a concise report including:
- **What was done** — Clear description of completed work
- **Why it was done** — Business/technical justification
- **Key decisions made** — And their rationale
- **Files changed** — With brief descriptions

### 3. Provide Suggestions
Offer 3 actionable suggestions for next steps, each including:
- **Relevance** — How it connects to completed work
- **Utility** — What value it provides
- **Priority reasoning** — Why it should (or shouldn't) be done soon

**Format:**
```markdown
## Suggestions

### Option A: [Title]
- **Tasks:** [5 specific tasks]
- **Relevance:** [Connection to completed work]
- **Utility:** [Value provided]
- **Priority:** [Why now or later]

### Option B: [Title]
...
```

---

## When to Invoke Specialists

### ✅ DO Invoke When
- Task requires domain expertise
- Work spans multiple files
- Quality/consistency is critical
- Specialized workflows add value

### ❌ DON'T Invoke When
- Single-line fixes
- Trivial updates
- Director has sufficient context
- Urgency outweighs specialization

---

## Communication Flow

```
Owner
  ↑↓ Strategic decisions, approvals, direction
Atlas Director
  ↓  Task assignments, handoffs
  ↑  Status updates, completions, blockers
Specialists (Product, Platform, Design, Ops)
  ↓  Worklogs, activity logs
Release Manager → Patch Notes → (Future) Discord → Users
```

---

*Registry maintained by Atlas Director*

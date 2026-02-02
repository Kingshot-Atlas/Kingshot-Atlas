# Architectural Decisions Record (ADR)

**Last Updated:** 2026-01-29  
**Purpose:** Document key decisions to prevent re-litigation and provide context for future work.

---

## How to Use This File

**Before proposing a change:**
1. Check if a relevant decision already exists
2. If it does, understand the rationale before suggesting alternatives
3. If circumstances have changed, propose an ADR update with justification

**After making a significant decision:**
1. Add a new ADR entry
2. Include context, alternatives considered, and consequences

---

## ADR-001: Use Supabase for Authentication & User Data

**Date:** 2026-01 (Initial)  
**Status:** ✅ Accepted  
**Deciders:** Owner

### Context
Needed a managed authentication solution with user profiles and database.

### Decision
Use Supabase for:
- User authentication (Google OAuth, email/password)
- User profiles and preferences storage
- Row Level Security (RLS) for data protection

### Alternatives Considered
- Firebase — More complex, Google-centric
- Auth0 — More expensive for our scale
- Custom JWT — Too much work to maintain

### Consequences
- ✅ Fast iteration on auth features
- ✅ Built-in RLS for security
- ⚠️ Locked to Supabase ecosystem
- ⚠️ Need to manage two databases (Supabase + SQLite API)

---

## ADR-002: Use FastAPI + SQLite for Kingdom Data API

**Date:** 2026-01 (Initial)  
**Status:** ✅ Accepted  
**Deciders:** Owner

### Context
Kingdom data is relatively static (updated manually), needs fast reads.

### Decision
- FastAPI for Python backend
- SQLite for kingdom data storage (`kingshot_atlas.db`)
- Separate from Supabase user data

### Alternatives Considered
- All in Supabase — Would mix user and kingdom data, harder to manage
- PostgreSQL — Overkill for read-heavy static data
- JSON files — No query capability

### Consequences
- ✅ Fast reads, simple deployment
- ✅ Easy to backup and version control
- ✅ Clear separation: user data (Supabase) vs kingdom data (SQLite)
- ⚠️ Two data sources to manage

---

## ADR-003: React + TypeScript for Frontend

**Date:** 2026-01 (Initial)  
**Status:** ✅ Accepted  
**Deciders:** Owner

### Context
Need a modern, maintainable frontend with good developer experience.

### Decision
- React 18 with functional components
- TypeScript for type safety
- React Query for server state
- TailwindCSS for styling (via custom CSS)

### Consequences
- ✅ Type safety catches bugs early
- ✅ Large ecosystem and community support
- ✅ React Query handles caching elegantly

---

## ADR-004: Netlify for Frontend Deployment

**Date:** 2026-01 (Initial)  
**Status:** ✅ Accepted  
**Deciders:** Owner

### Context
Need reliable, fast deployment with custom domain support.

### Decision
Deploy to Netlify with:
- Auto-deploy from main branch
- Custom domain: ks-atlas.com
- Site ID: `716ed1c2-eb00-4842-8781-c37fb2823eb8`

### Consequences
- ✅ Simple deployment workflow
- ✅ Good CDN performance
- ⚠️ Build minutes limit on free tier

---

## ADR-005: Bayesian Atlas Score Algorithm

**Date:** 2026-01  
**Status:** ✅ Accepted  
**Deciders:** Owner, Product Engineer

### Context
Need a fair, comprehensive scoring system that accounts for different kingdom strengths.

### Decision
Use Bayesian scoring with:
- Multiple weighted components (power, KvK performance, activity)
- Tier system: S/A/B/C/D/F
- Documented formula in `/ATLAS_SCORE_IMPLEMENTATION_GUIDE.md`

### Alternatives Considered
- Simple weighted average — Doesn't handle missing data well
- ELO-style — Too complex, hard to explain
- Win rate only — Ignores kingdom strength

### Consequences
- ✅ Fair scoring even with incomplete data
- ✅ Explainable to users via breakdown
- ⚠️ Complex to maintain/adjust

---

## ADR-006: Agent System Architecture

**Date:** 2026-01-28  
**Status:** ✅ Accepted  
**Deciders:** Owner

### Context
Need organized way to manage AI-assisted development with clear responsibilities.

### Decision
Implement multi-agent system:
- Atlas Director as orchestrator
- Specialist agents (Product, Platform, Design, Ops, Business, Release)
- File claiming and coordination protocols
- Vision alignment checks

### Consequences
- ✅ Clear ownership and boundaries
- ✅ Prevents conflicting work
- ✅ Maintains project coherence
- ⚠️ Overhead for simple tasks

---

## ADR-007: Premium/Freemium Model

**Date:** 2026-01  
**Status:** ✅ Accepted  
**Deciders:** Owner, Business Lead

### Context
Need sustainable revenue while keeping core features free.

### Decision
- Free tier: Core search, basic kingdom info
- Premium tier: Advanced analytics, unlimited comparisons
- Ad-supported free tier

### Consequences
- ✅ Sustainable business model
- ✅ Core value remains free
- ⚠️ Need to balance free vs premium value

---

## ADR-008: No Bot/Automation Features

**Date:** 2026-01  
**Status:** ✅ Accepted  
**Deciders:** Owner

### Context
Some players requested automation features for the game.

### Decision
**Explicitly reject** any bot or automation features that:
- Play the game automatically
- Provide unfair advantages
- Violate game ToS

### Rationale
- Aligns with fair play values
- Protects community trust
- Avoids legal/ToS issues

### Consequences
- ✅ Maintains integrity and trust
- ⚠️ May lose some potential users who want automation

---

## ADR-009: Sub-Agent Architecture for Specialized Tasks

**Date:** 2026-01-29  
**Status:** ✅ Accepted  
**Deciders:** Owner, Atlas Director

### Context
Analysis of agent structure revealed:
- Product Engineer and Platform Engineer carry disproportionate workload
- No dedicated ownership for data quality (core to VISION.md values)
- No frontend testing capability (regression risk)
- Patch notes process lacks daily activity tracking for engagement

### Decision
Add specialized sub-agents under high-load primary agents:

**Platform Engineer Sub-agents:**
- Security Specialist (existing) — Security audits, pen testing
- **Data Quality Specialist (NEW)** — Data validation, submission review, quality assurance

**Product Engineer Sub-agents:**
- **Frontend Testing Specialist (NEW)** — E2E testing, component testing, CI integration

**Release Manager Sub-agents:**
- Discord Community Manager (existing) — Discord engagement
- **Activity Curator (NEW)** — Daily updates, coming soon content, user-friendly changelogs

### Sub-Agent Design Principles
1. Sub-agents report to their parent agent, not Director
2. Sub-agents have narrow, deep expertise
3. Sub-agents own specific files/domains
4. Sub-agents can escalate critical issues to Director
5. Sub-agents document in their own LATEST_KNOWLEDGE.md

### Alternatives Considered
- Expand primary agent scopes — Would dilute expertise and increase cognitive load
- Hire more primary agents — Would flatten hierarchy, increase coordination overhead
- No sub-agents — Would leave gaps in critical areas

### Consequences
- ✅ Better coverage for data quality (mission-critical)
- ✅ Enables confident refactoring with test coverage
- ✅ Daily engagement content without manual effort
- ✅ Clearer ownership for specialized tasks
- ⚠️ More files/agents to coordinate
- ⚠️ Parent agents must manage sub-agent work

### Future Sub-Agent Candidates (Parked)
- Performance Specialist (under Platform Engineer) — When needed
- Documentation Specialist (under Director) — When docs become a problem
- Mobile Specialist (under Product Engineer) — When mobile app starts

---

## ADR-010: Supabase as Single Source of Truth for Kingdom Data

**Date:** 2026-02-01  
**Status:** ✅ Accepted  
**Deciders:** Owner, Platform Engineer

### Context
The data layer had evolved into a multi-source hybrid system causing sync issues:
- Static CSV/JSON files for original data
- SQLite for API server-side storage
- Supabase for real-time user submissions
- Frontend using `kingdoms.json` for base stats, overlaying Supabase KvK records

When users submitted KvK results, the Atlas Score displayed would be stale (from JSON) even though the KvK history was up-to-date (from Supabase).

### Decision
**Supabase `kingdoms` table is now the single source of truth** for all kingdom aggregate stats including Atlas Score.

Implementation:
1. Created `kingdoms` table in Supabase with all aggregate stats
2. Created `calculate_atlas_score()` PostgreSQL function with Bayesian formula
3. Created `recalculate_kingdom_stats()` function called by trigger
4. Trigger auto-updates `kingdoms` table when `kvk_history` changes
5. Frontend reads from Supabase `kingdoms` table via `kingdomsSupabaseService`
6. Local JSON is fallback only when Supabase unavailable

### Alternatives Considered
- Keep SQLite as source of truth — Would require API to always be deployed
- Frontend recalculation — Duplicated formula, increased complexity
- Keep hybrid approach — Root cause of the sync problem

### Consequences
- ✅ Single source of truth eliminates sync issues
- ✅ Automatic stat recalculation via database trigger
- ✅ Real-time updates across all users
- ✅ No manual regeneration needed after submissions
- ⚠️ Dependent on Supabase availability
- ⚠️ Atlas Score formula now lives in PostgreSQL (need to update both if formula changes)

### Related Files
- `/docs/migrations/create_kingdoms_table.sql` — Full migration
- `/apps/web/src/services/kingdomsSupabaseService.ts` — Frontend service
- `/apps/web/src/services/api.ts` — Updated to use Supabase as primary source

---

## ADR-011: Remove Redundant Data Sources (SQLite Writes & JSON Fallback)

**Date:** 2026-02-02  
**Status:** ✅ Accepted  
**Deciders:** Platform Engineer  
**Builds On:** ADR-010

### Context
Following ADR-010's establishment of Supabase as the single source of truth, the codebase still contained:
1. **Redundant SQLite writes** in `submissions.py` — KvK records were written to both SQLite AND Supabase
2. **JSON fallback** in `api.ts` — When Supabase was unavailable, the frontend silently fell back to stale `kingdoms.json` data

These redundancies created potential for data drift and contradicted the single source of truth principle.

### Decision
**Remove all redundant data sources:**

1. **Backend (`submissions.py`):**
   - Remove SQLite KVKRecord creation on submission approval
   - Remove `_recalculate_kingdom_stats()` calls for SQLite
   - Keep only Supabase writes
   - Fail explicitly (HTTP 503) if Supabase is unavailable instead of silently succeeding

2. **Frontend (`api.ts`):**
   - Remove `kingdoms.json` import and all JSON fallback logic
   - Remove `loadKingdomData()` function that rebuilt data from JSON
   - Add `dataLoadError` export for components to show error state
   - If Supabase is unavailable, show clear error instead of stale data

### Alternatives Considered
- **Keep JSON as offline fallback** — Rejected: Contradicts user's explicit requirement that "all data should come from the source of truth"
- **Keep SQLite as backup** — Rejected: Dual-write complexity causes more problems than it solves
- **Gradual deprecation** — Rejected: Clean break is simpler and prevents confusion

### Consequences
- ✅ True single source of truth — no data can come from stale sources
- ✅ Simpler codebase — removed ~150 lines of fallback logic
- ✅ Explicit errors — users see clear error states instead of wrong data
- ✅ Reduced bundle size — ~69KB JSON file no longer imported
- ⚠️ No offline resilience — app requires Supabase connectivity
- ⚠️ SQLite tables become orphaned (can be cleaned up later)

### Related Files
- `/apps/api/api/routers/submissions.py` — Removed SQLite writes
- `/apps/web/src/services/api.ts` — Removed JSON fallback
- `/apps/web/src/data/kingdoms.json` — Can be deleted (no longer imported)

---

## Template for New Decisions

```markdown
## ADR-XXX: [Title]

**Date:** YYYY-MM-DD  
**Status:** 🟡 Proposed / ✅ Accepted / ❌ Rejected / 🔄 Superseded  
**Deciders:** [Who made this decision]

### Context
[Why is this decision needed?]

### Decision
[What was decided]

### Alternatives Considered
- [Option A] — [Why rejected]
- [Option B] — [Why rejected]

### Consequences
- ✅ [Positive outcome]
- ⚠️ [Tradeoff or risk]
```

---

*Add new decisions as they are made. Reference ADRs when proposing changes.*

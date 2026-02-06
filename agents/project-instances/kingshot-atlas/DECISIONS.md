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

## ADR-012: Atlas Scores Must Come From Supabase Tables (CRITICAL)

**Date:** 2026-02-04  
**Status:** ✅ Accepted  
**Deciders:** Owner  
**Priority:** 🔴 CRITICAL — READ THIS BEFORE ANY ATLAS SCORE WORK

### Context
Atlas Scores have been repeatedly calculated using outdated formulas in frontend code, causing incorrect displays across multiple pages. This has required multiple corrections.

### Decision
**USE SUPABASE TABLES AS THE ONE SOURCE OF TRUTH FOR ATLAS SCORES.**

Specifically:
1. **NEVER calculate Atlas Scores in frontend code**
2. **ALWAYS read pre-calculated `atlas_score` from Supabase `kingdoms` table**
3. **ALWAYS read historical scores from Supabase `kvk_history.kingdom_score`**
4. **The PostgreSQL `calculate_atlas_score()` function is the ONLY place where the formula lives**

### For New Pages/Features Displaying Atlas Scores
When building any page or feature that shows Atlas Scores:
1. ✅ DO: Fetch from `supabase.from('kingdoms').select('atlas_score')`
2. ✅ DO: Fetch from `supabase.from('kvk_history').select('kingdom_score')`
3. ❌ DON'T: Calculate scores using `enhanced_atlas_formulas.py` or any frontend formula
4. ❌ DON'T: Use hardcoded tier thresholds that may be outdated
5. ❌ DON'T: Re-implement the Bayesian formula anywhere

### Pre-Calculated Fields Available in Supabase
```sql
-- kingdoms table
atlas_score         -- The Atlas Score (use this!)
total_kvks          -- Total KvK count
prep_wins, prep_losses, prep_win_rate
battle_wins, battle_losses, battle_win_rate

-- kvk_history table  
kingdom_score       -- Historical score at time of this KvK
```

### Consequences
- ✅ Consistent scores across all pages
- ✅ Formula changes only need to happen in one place (PostgreSQL)
- ✅ No frontend drift or outdated calculations
- ⚠️ Requires Supabase connectivity for any score display

### Related ADRs
- ADR-010: Supabase as Single Source of Truth for Kingdom Data
- ADR-011: Remove Redundant Data Sources

---

## ADR-013: Score History Table for Historical Atlas Score Snapshots

**Date:** 2026-02-04  
**Status:** ✅ Accepted  
**Deciders:** Owner

### Context
To display Atlas Score progression over time (charts, KvK Seasons page), we need historical snapshots of each kingdom's score after each KvK they participated in. The formula may change over time, so the design must support recalculation.

### Decision
**Use `score_history` table to store point-in-time Atlas Score snapshots.**

Schema:
- `kingdom_number`, `kvk_number` — Composite unique key
- `score` — Atlas Score at that point (0-15)
- `tier` — Tier at that point (S/A/B/C/D)
- `rank_at_time` — Rank compared to other kingdoms at same KvK
- `prep_wins`, `prep_losses`, `battle_wins`, `battle_losses` — Cumulative stats at that point
- `formula_version` — Tracks which formula was used (e.g., 'v2.0')
- `recorded_at` — Timestamp

Key functions:
- `calculate_atlas_score_at_kvk(kingdom_number, max_kvk_number)` — Returns score + stats up to a specific KvK
- `get_tier_from_score(score)` — Returns tier based on current thresholds
- `trg_create_score_history` — Trigger that auto-creates entries on new KvK inserts

### Consequences
- ✅ Enables Atlas Score History charts on kingdom profiles
- ✅ Enables KvK Seasons to show historical scores at time of matchup
- ✅ Formula changes can be re-applied by updating `formula_version` and regenerating
- ✅ Automatic population via trigger for future KvKs
- ⚠️ Initial population requires migration (done: 5,558 records for 1,198 kingdoms)

### Related ADRs
- ADR-012: Atlas Scores Must Come From Supabase Tables

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

## ADR-013: FavoritesContext as Single Source of Truth for Favorites State

**Date:** 2026-02-06  
**Status:** ✅ Accepted  
**Deciders:** Product Engineer

### Context
Favorites were managed independently by each page via direct localStorage reads. This caused:
- No reactive updates across pages (toggle on Profile didn't reflect on Directory until refresh)
- 6 files duplicating the `kingshot_favorites` localStorage key
- No centralized sync error handling

### Decision
Create a `FavoritesContext` React context that:
- Initializes from localStorage (fast, synchronous)
- Hydrates from Supabase `user_data.favorites` after login (cloud is authoritative for logged-in users)
- Persists changes: Context state → localStorage → Supabase (via `userDataService.syncToCloud()`)
- All pages consume from context instead of direct localStorage reads

### Alternatives Considered
- **Zustand store** — Heavier dependency for a simple list; context is sufficient
- **Keep localStorage + polling** — FavoritesBadge was polling every 2s; wasteful and not reactive
- **Supabase real-time subscription** — Overkill for single-user favorites; adds WebSocket overhead

### Consequences
- ✅ Favorites are reactive across all pages instantly
- ✅ Single source of truth eliminates duplicate key definitions
- ✅ Centralized sync error handling with toast notifications
- ✅ KingdomProfile now has a favorite toggle button
- ⚠️ Context re-renders all consumers on any favorite change (acceptable for small arrays)

---

*Add new decisions as they are made. Reference ADRs when proposing changes.*

# Data Layer Architecture Analysis

**Date:** 2026-02-01 (Updated: 2026-02-01)  
**Prepared by:** Platform Engineer + Data Quality Specialist  
**Purpose:** Comprehensive analysis of data architecture to identify sync issues between submissions and page displays

---

## ✅ STATUS: RESOLVED

**This issue has been fixed.** See ADR-010 in `/agents/project-instances/kingshot-atlas/DECISIONS.md`.

**Solution implemented:**
- Supabase `kingdoms` table is now the **single source of truth**
- Database trigger auto-recalculates stats when `kvk_history` changes
- Frontend reads from Supabase `kingdoms` table via `kingdomsSupabaseService`
- Local JSON is fallback only when Supabase unavailable

---

## Historical Context (Problem Description)

**Your mentor was correct.** The data architecture had evolved into a **multi-source hybrid system** that created sync challenges. The system used:
1. **Static CSV/JSON files** as the original data source
2. **SQLite database** (API) for server-side storage
3. **Supabase PostgreSQL** for real-time user submissions and KvK history
4. **Frontend in-memory cache** with complex overlay logic

When a user submitted KvK data, it flowed through some but not all of these systems, causing **different pages to show different data** depending on which source they queried.

---

## Current Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ORIGINAL DATA PIPELINE                             │
│                       (Manual batch updates only)                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  data/raw/kvk_results.csv                                                    │
│  (Manually updated spreadsheet - SOURCE OF TRUTH for historical data)       │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  regenerate_kingdoms_with_atlas_score.py                                     │
│  (Calculates Atlas Scores, generates all derived files)                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
          ┌──────────────────────────┼──────────────────────────┐
          ▼                          ▼                          ▼
┌───────────────────┐    ┌───────────────────┐    ┌───────────────────┐
│ apps/web/src/data │    │ apps/api/data/    │    │ apps/api/data/    │
│ /kingdoms.json    │    │ kingdoms_         │    │ kingdoms_         │
│                   │    │ summary.csv       │    │ all_kvks.csv      │
│ (Frontend static) │    │ (API import)      │    │ (API import)      │
└─────────┬─────────┘    └─────────┬─────────┘    └─────────┬─────────┘
          │                        │                        │
          │                        └───────────┬────────────┘
          │                                    ▼
          │                        ┌───────────────────────┐
          │                        │ import_data.py        │
          │                        │ (Loads to SQLite)     │
          │                        └───────────┬───────────┘
          │                                    ▼
          │                        ┌───────────────────────┐
          │                        │ SQLite Database       │
          │                        │ kingshot_atlas.db     │
          │                        │ (API server source)   │
          │                        └───────────┬───────────┘
          │                                    │
          │                                    ▼
          │                        ┌───────────────────────┐
          │                        │ FastAPI Server        │
          │                        │ /api/v1/kingdoms/*    │
          │                        └───────────┬───────────┘
          │                                    │
          └───────────────┬────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND DATA LAYER                                 │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  api.ts - loadKingdomData()                                          │    │
│  │                                                                       │    │
│  │  PRIORITY 1: Supabase kvk_history (if available)                     │    │
│  │  PRIORITY 2: Local kingdoms.json (fallback)                          │    │
│  │  + Overlay: kvkCorrectionService corrections                         │    │
│  │  + Overlay: statusService status overrides                           │    │
│  │                                                                       │    │
│  │  Result: realKingdoms[] (in-memory, recalculated at load)            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  kvkHistoryService.ts                                                │    │
│  │                                                                       │    │
│  │  PRIORITY 1: Supabase kvk_history table                              │    │
│  │  PRIORITY 2: Empty (falls back to api.ts local data)                 │    │
│  │  Cache: IndexedDB + 30-second memory TTL                             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                       USER SUBMISSION FLOW (NEW DATA)                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  User submits KvK result via /submit-result                                  │
│  (PostKvKSubmission.tsx → POST /api/submissions/kvk10)                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  submissions.py - create_kvk10_submission()                                  │
│  Creates KVKSubmission row in SQLite (status: pending)                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Admin reviews submission at /admin                                          │
│  (AdminDashboard.tsx → POST /api/submissions/{id}/review)                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  submissions.py - review_submission()                                        │
│                                                                              │
│  ON APPROVAL:                                                                │
│  ├── 1. Creates KVKRecord in SQLite ✓                                       │
│  ├── 2. Recalculates Kingdom stats in SQLite ✓                              │
│  ├── 3. Inserts into Supabase kvk_history ✓                                 │
│  └── 4. ??? Frontend notified to refresh ???                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     │
    ┌────────────────────────────────┴────────────────────────────────┐
    │                                                                  │
    ▼                                                                  ▼
┌───────────────────────────────────┐      ┌───────────────────────────────────┐
│ SQLite updated ✓                  │      │ Supabase kvk_history updated ✓   │
│ - KVKRecord row added             │      │ - New row inserted                │
│ - Kingdom stats recalculated      │      │ - Opponent row inserted           │
│ - API will return new data        │      │                                   │
└───────────────────────────────────┘      └───────────────────────────────────┘
                │                                         │
                │                                         │
                ▼                                         ▼
┌───────────────────────────────────┐      ┌───────────────────────────────────┐
│ Frontend API calls                │      │ Frontend kvkHistoryService        │
│ GET /api/v1/kingdoms/{id}         │      │ Queries Supabase directly         │
│                                   │      │                                   │
│ ⚠️ Returns updated data from     │      │ ✓ Returns updated data            │
│    SQLite (if deployed)           │      │   (after cache expires)           │
└───────────────────────────────────┘      └───────────────────────────────────┘
                │                                         │
                │                                         │
                ▼                                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            THE SYNC PROBLEM                                  │
│                                                                              │
│  ❌ kingdoms.json is NOT updated (static file)                               │
│  ❌ Atlas Score is NOT recalculated in Supabase (only stored in SQLite)     │
│  ❌ Frontend loads from kingdoms.json first, overlays Supabase KvK records  │
│  ❌ Atlas Score in frontend uses kingdoms.json value (stale!)               │
│  ❌ API returns SQLite data but frontend may not call API                   │
│                                                                              │
│  RESULT: Different pages show different data depending on:                   │
│  - Whether they call API vs use local data                                   │
│  - Whether Supabase cache is warm or cold                                    │
│  - Whether reloadWithSupabaseData() was called                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Identified Problems

### Problem 1: Multiple Sources of Truth
| Data Store | Contains | Updated When |
|------------|----------|--------------|
| `data/raw/kvk_results.csv` | Historical KvK data | Manual batch updates |
| `kingdoms.json` | Kingdom stats + Atlas Scores | regenerate script runs |
| SQLite `kingdoms` table | Kingdom stats + Atlas Scores | API import_data.py runs |
| SQLite `kvk_records` table | Individual KvK records | API import_data.py OR submission approval |
| Supabase `kvk_history` table | Individual KvK records | Submission approval |

**Impact:** When a submission is approved:
- SQLite gets the new KvK record + recalculated stats ✓
- Supabase gets the new KvK record ✓
- `kingdoms.json` stays stale ❌
- Frontend shows stale Atlas Score from `kingdoms.json` ❌

### Problem 2: Atlas Score Not Recalculated in Supabase
The `_recalculate_kingdom_stats()` function in `submissions.py` updates:
- `prep_wins`, `prep_losses`, `battle_wins`, `battle_losses`
- `prep_win_rate`, `battle_win_rate`
- `overall_score` (Atlas Score)
- Streaks, dominations, defeats

**But this only updates SQLite.** Supabase `kvk_history` has no `kingdoms` table equivalent with aggregate stats.

### Problem 3: Frontend Data Loading is Complex
`api.ts` `loadKingdomData()` does:
1. Checks if Supabase data is available
2. If yes: Uses Supabase KvK records as primary source
3. If no: Falls back to `kingdoms.json` KvK records
4. **BUT:** Kingdom aggregate stats (including Atlas Score) always come from `kingdoms.json`
5. Then overlays corrections and status changes

**The Atlas Score displayed is always from `kingdoms.json`, not recalculated from Supabase KvK data.**

### Problem 4: No Real-Time Recalculation
The Atlas Score formula is complex (Bayesian priors, experience scaling, recent form, etc.). It's only run in:
- `regenerate_kingdoms_with_atlas_score.py` (batch)
- `submissions.py` `_recalculate_kingdom_stats()` (simplified version, SQLite only)

Neither the frontend nor Supabase can calculate fresh Atlas Scores.

### Problem 5: Cache Invalidation is Incomplete
When `apiService.reloadWithSupabaseData()` is called:
- It refreshes `supabaseKvkData` from Supabase ✓
- It rebuilds `realKingdoms` array ✓
- **BUT:** `realKingdoms` still uses `kingdoms.json` for base stats ❌
- The new KvK records are overlaid but Atlas Score remains stale ❌

---

## Data Capture Intent vs. Current Reality

### Intent (What Should Happen)
1. User submits KvK result with screenshot proof
2. Admin approves submission
3. **All pages immediately show updated data:**
   - Kingdom Profile: New KvK in history, updated Atlas Score
   - Leaderboard: Kingdom rank changes if score changed
   - Compare: Both kingdoms show updated stats
   - Directory: Cards show updated score/stats

### Reality (What Actually Happens)
1. User submits KvK result ✓
2. Admin approves submission ✓
3. **Partial sync occurs:**
   - SQLite: Fully updated (KvK record + stats + score) ✓
   - Supabase: Partially updated (KvK record only) ⚠️
   - Frontend `kingdoms.json`: Not updated ❌
   - Frontend display: Shows mixed data ❌

---

## Recommended Solutions

### Option A: Supabase as Single Source of Truth (Recommended)

**Architecture Change:**
1. Create `kingdoms` table in Supabase with aggregate stats
2. When submission approved, update both `kvk_history` and `kingdoms` in Supabase
3. Frontend reads from Supabase only (no local JSON fallback for production)
4. Deprecate SQLite for kingdom data (keep for submissions queue only)

**Pros:**
- Single source of truth
- Real-time updates across all users
- No cache invalidation complexity
- Supabase RLS for security

**Cons:**
- Migration effort required
- Supabase dependency for all data
- Need to port Atlas Score formula to database or edge function

**Effort:** Medium-High (2-4 days)

### Option B: API as Single Source of Truth

**Architecture Change:**
1. Frontend always calls API for kingdom data (no local JSON in production)
2. API SQLite is the source of truth
3. Remove Supabase `kvk_history` (or use it only for audit log)
4. API recalculates stats on every approved submission (already does this)

**Pros:**
- Simpler architecture (API + SQLite only)
- Already works correctly on API side
- Less migration needed

**Cons:**
- More API calls from frontend
- Need to deploy API after every data update
- No real-time updates (depends on API deployment)

**Effort:** Medium (1-2 days)

### Option C: Frontend Recalculation (Quick Fix)

**Architecture Change:**
1. Keep current multi-source architecture
2. Add Atlas Score recalculation to frontend when loading Supabase KvK data
3. Port `calculate_atlas_score()` to TypeScript
4. Frontend calculates fresh scores from KvK history

**Pros:**
- Minimal backend changes
- Quick to implement
- Fixes the immediate symptom

**Cons:**
- Duplicated formula (Python + TypeScript)
- Formula changes require two updates
- Increased frontend computation
- Doesn't fix the underlying architecture debt

**Effort:** Low (4-8 hours)

### Option D: Unified Data Layer (Best Long-Term)

**Architecture Change:**
1. Supabase as primary store for ALL kingdom data
2. Edge Function to calculate Atlas Score on insert/update
3. Supabase Realtime for instant UI updates
4. API becomes thin proxy to Supabase (or eliminated)
5. Remove local JSON files from production builds

**Pros:**
- True single source of truth
- Real-time updates via Supabase Realtime
- Formula in one place (Edge Function)
- Scales well

**Cons:**
- Largest migration effort
- Supabase Edge Function compute costs
- Full rewrite of data layer

**Effort:** High (1-2 weeks)

---

## Immediate Recommendations

### Priority 1: Document Decision
Before implementing any solution, decide on the long-term architecture vision. Ask:
- Should Supabase or SQLite be the source of truth?
- Is real-time sync required, or is "refresh page" acceptable?
- How important is offline support (local JSON fallback)?

### Priority 2: Quick Fix (Option C)
If immediate fix is needed:
1. Port `calculate_atlas_score()` to TypeScript
2. When `loadKingdomData()` runs with Supabase data, recalculate scores
3. This ensures displayed scores match KvK history

### Priority 3: Architectural Refactor
After quick fix stabilizes:
1. Choose Option A or D based on team capacity
2. Create migration plan
3. Implement in phases with feature flags
4. Deprecate old data paths

---

## Files to Modify (By Solution)

### Option C (Quick Fix)
- `apps/web/src/services/api.ts` - Add score recalculation
- `apps/web/src/utils/atlasScore.ts` - New file with formula
- `apps/web/src/services/kvkHistoryService.ts` - Export types

### Option A (Supabase Source of Truth)
- `docs/migrations/create_kingdoms_table.sql` - New Supabase table
- `apps/api/api/routers/submissions.py` - Update Supabase kingdoms on approval
- `apps/web/src/services/api.ts` - Remove local JSON, read from Supabase
- `apps/web/src/services/kingdomService.ts` - Supabase-only mode

### Option D (Unified Layer)
- All of Option A, plus:
- `supabase/functions/calculate-atlas-score/` - Edge Function
- `apps/web/src/hooks/useRealtimeKingdoms.ts` - Realtime subscription
- Database triggers for automatic recalculation

---

## Conclusion

**Your mentor's diagnosis was accurate.** The system evolved shortcuts:
1. Started with static CSV → JSON pipeline
2. Added SQLite API for server-side queries
3. Added Supabase for user data and real-time KvK history
4. **Never unified these into a coherent data layer**

The result is a hybrid where:
- Historical data lives in CSV/JSON (static)
- New submissions go to SQLite + Supabase (dynamic)
- Frontend displays a mix of both (inconsistent)
- Atlas Scores are calculated in Python but displayed from stale JSON

**The fix requires choosing ONE source of truth and routing ALL data through it.**

---

*This analysis was prepared by Platform Engineer and Data Quality Specialist agents as part of the architectural review requested by the owner.*

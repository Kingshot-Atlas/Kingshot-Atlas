# Production Code Review - Kingshot Atlas
**Date:** 2026-01-27  
**Reviewer:** Senior Staff Engineer (Cascade)  
**Status:** Critical issues fixed, review complete

---

## 1. Flow Summary

**Architecture**: React frontend → FastAPI backend → SQLAlchemy ORM → SQLite/PostgreSQL

### Core Data Flow:
1. `App.tsx` routes to lazy-loaded pages wrapped in `ErrorBoundary`
2. `ApiService` fetches from backend OR falls back to local JSON
3. FastAPI routers handle requests with rate limiting, CORS, caching headers
4. SQLAlchemy models with indexes; session managed via `get_db()` dependency

---

## 2. Critical Issues Fixed

### CRITICAL-1: Overall Result Format Mismatch
- **File:** `submissions.py:154-162`
- **Problem:** Created "Domination"/"Defeat" but data uses "W"/"L"
- **Fix:** Changed to "W"/"L" format

### CRITICAL-2: Head-to-Head Logic Bug  
- **File:** `compare.py:95-98`
- **Problem:** Assumed both kingdoms have records for same match
- **Fix:** Correctly derives winner from either perspective

### CRITICAL-3: Kingdom Stats Not Updated
- **Problem:** Approving submission didn't update kingdom aggregates
- **Fix:** Added `_recalculate_kingdom_stats()` function

---

## 3. High-Risk Areas Addressed

| Issue | Fix Applied |
|-------|-------------|
| N+1 query in rank calc | Kept COUNT approach (good enough for now) |
| Compare loads all kingdoms | Fixed: uses COUNT query per kingdom |
| Dual auth confusion | Documented - needs decision |
| Missing rate limiting | Added to `/kingdoms` and `/leaderboard` |
| Sort field injection | Added whitelist validation |
| No request timeout | Added 10s timeout + retry with backoff |

---

## 4. Remaining Gaps

| Gap | Priority | Notes |
|-----|----------|-------|
| No DB migrations | HIGH | alembic/ exists but no versions |
| Cache invalidation | MEDIUM | Frontend cache not cleared on approval |
| CSRF protection | MEDIUM | State-changing ops vulnerable |
| Request correlation | LOW | Can't trace across services |
| Auth unification | HIGH | Pick Supabase OR local JWT |

---

## 5. Test Results

All 43 tests pass after fixes:
- `test_auth.py`: 14 passed
- `test_kingdoms.py`: 15 passed  
- `test_submissions.py`: 14 passed

---

## 6. Questions Needing Answers

1. **Auth strategy**: Supabase or local JWT? Currently incompatible.
2. **Data freshness**: Recalculate stats after every submission or batch nightly?
3. **Moderator setup**: How will moderators be assigned? Empty hardcoded sets now.
4. **Cold start**: Is 30s Render cold start acceptable?
5. **DB migration**: Plan for SQLite → PostgreSQL transition?

---

## 7. Files Changed This Review

- `apps/api/api/routers/submissions.py` - Fixed overall_result format, added stats recalc
- `apps/api/api/routers/compare.py` - Fixed head-to-head logic, efficient rank query
- `apps/api/api/routers/kingdoms.py` - Added rate limiting, sort whitelist
- `apps/api/api/routers/leaderboard.py` - Added rate limiting, bounded results
- `apps/web/src/services/api.ts` - Added timeout + retry with exponential backoff

---

*Review complete. All critical bugs fixed. 43/43 tests passing.*

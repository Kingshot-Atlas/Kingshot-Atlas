# Performance & Cost Optimization Review

**Date:** 2026-01-26  
**Reviewer:** Perf/Cost Agent (Fresh)  
**Scope:** Backend API + Frontend React app  
**Status:** Pre-Production Optimization Audit

---

## Executive Summary

The application has several performance issues that will become problematic at scale. The most critical is the N+1 query pattern in the kingdoms endpoint. Frontend has some overfetching and could benefit from better caching strategies.

**Current Architecture Cost Profile:** Low (SQLite + Static hosting)  
**Scaling Readiness:** ⚠️ NEEDS WORK

---

## Top 10 Performance Wins

### 🔴 HIGH IMPACT

#### 1. Fix N+1 Query in `/api/kingdoms`
**File:** `@/Users/giovanni/projects/ai/Kingshot Atlas/apps/api/api/routers/kingdoms.py:62-66`

```python
# CURRENT: N+1 queries (1 + N kingdoms)
for kingdom in kingdoms:
    recent_kvks = db.query(KVKRecord).filter(
        KVKRecord.kingdom_number == kingdom.kingdom_number
    ).order_by(desc(KVKRecord.kvk_number)).limit(5).all()
    kingdom.recent_kvks = recent_kvks
```

**Fix:**
```python
from sqlalchemy.orm import joinedload

# Use eager loading - single query with JOIN
kingdoms = db.query(Kingdom).options(
    joinedload(Kingdom.kvk_records)
).all()

# Or batch query approach
kingdom_numbers = [k.kingdom_number for k in kingdoms]
all_kvks = db.query(KVKRecord).filter(
    KVKRecord.kingdom_number.in_(kingdom_numbers)
).order_by(desc(KVKRecord.kvk_number)).all()

# Group by kingdom
kvks_by_kingdom = defaultdict(list)
for kvk in all_kvks:
    if len(kvks_by_kingdom[kvk.kingdom_number]) < 5:
        kvks_by_kingdom[kvk.kingdom_number].append(kvk)
```

**Impact:** 500 kingdoms = 501 queries → 1-2 queries  
**Effort:** 1 hour

---

#### 2. Cache Rank Calculation
**File:** `@/Users/giovanni/projects/ai/Kingshot Atlas/apps/api/api/routers/kingdoms.py:83-88`

```python
# CURRENT: Fetches ALL kingdoms just to calculate one rank
all_kingdoms = db.query(Kingdom).all()
kingdoms_sorted = sorted(all_kingdoms, key=lambda k: k.overall_score, reverse=True)
```

**Fix Options:**
1. **Add rank column** to Kingdom model, update on data import
2. **Use SQL window function:**
```python
from sqlalchemy import func
rank = db.query(func.count(Kingdom.kingdom_number)).filter(
    Kingdom.overall_score > kingdom.overall_score
).scalar() + 1
```
3. **Cache ranks in Redis** with 5-minute TTL

**Impact:** Eliminates full table scan per request  
**Effort:** 30 min (option 2)

---

#### 3. Add Database Indexes
**File:** `@/Users/giovanni/projects/ai/Kingshot Atlas/apps/api/models.py`

**Current indexes:** Only on `kingdom_number` (PK) and `username`/`email` (unique)

**Add:**
```python
# In Kingdom model
__table_args__ = (
    Index('ix_kingdoms_overall_score', 'overall_score'),
    Index('ix_kingdoms_status', 'most_recent_status'),
)

# In KVKRecord model
__table_args__ = (
    Index('ix_kvk_kingdom_kvknum', 'kingdom_number', 'kvk_number'),
)
```

**Impact:** 10-100x faster filtered queries  
**Effort:** 15 min

---

#### 4. Frontend: Reduce Initial Bundle Size
**File:** `@/Users/giovanni/projects/ai/Kingshot Atlas/apps/web/src/components/KingdomCard.tsx`

**Issue:** `html2canvas` (1.4MB) imported in every card for screenshot feature

**Fix:**
```typescript
// Dynamic import - only load when needed
const handleDownloadCard = async () => {
  const html2canvas = (await import('html2canvas')).default;
  // ... rest of code
};
```

**Impact:** ~200KB initial bundle reduction  
**Effort:** 15 min

---

### 🟠 MEDIUM IMPACT

#### 5. Implement API Response Caching
**Location:** Backend API

**Add Redis/in-memory cache for:**
- `/api/kingdoms` list (TTL: 60s)
- `/api/leaderboard` (TTL: 60s)
- Kingdom profiles (TTL: 5min)

**Example with `cachetools`:**
```python
from cachetools import TTLCache
from functools import lru_cache

kingdoms_cache = TTLCache(maxsize=1, ttl=60)

@router.get("/kingdoms")
def get_kingdoms(...):
    cache_key = f"{filters}:{sort}"
    if cache_key in kingdoms_cache:
        return kingdoms_cache[cache_key]
    # ... fetch from DB
    kingdoms_cache[cache_key] = result
    return result
```

**Impact:** 90% reduction in DB queries for repeated requests  
**Effort:** 1 hour

---

#### 6. Frontend: Optimize Re-renders in KingdomDirectory
**File:** `@/Users/giovanni/projects/ai/Kingshot Atlas/apps/web/src/pages/KingdomDirectory.tsx`

**Issues:**
- Multiple `useMemo` with overlapping dependencies
- `rankedKingdoms` recalculates on every filter change
- Large component (1003 lines) = hard to optimize

**Fixes:**
1. Extract `KingdomGrid` as memoized component
2. Use `React.memo` on `KingdomCard`
3. Move rank calculation to API response

**Impact:** Smoother UI on filter changes  
**Effort:** 2 hours

---

#### 7. Pagination Instead of Load More
**Current:** Loads all kingdoms, slices in frontend

**Better:**
```typescript
// API: Add proper pagination
GET /api/kingdoms?page=1&limit=15

// Response includes total count
{ kingdoms: [...], total: 500, page: 1, pages: 34 }
```

**Impact:** Faster initial load, lower memory usage  
**Effort:** 1 hour (backend) + 30 min (frontend)

---

#### 8. Optimize LocalStorage Usage
**Files:** Multiple components

**Issues:**
- `kingshot_kingdom_cache` stores all kingdoms (could be 1MB+)
- `kingshot_favorites` parsed on every render
- No compression

**Fixes:**
1. Store only IDs in localStorage, fetch data as needed
2. Use `useSyncExternalStore` for localStorage state
3. Consider IndexedDB for larger data

**Impact:** Faster page loads, lower memory  
**Effort:** 1 hour

---

### 🟡 LOWER IMPACT

#### 9. Lazy Load ParticleEffect
**File:** `@/Users/giovanni/projects/ai/Kingshot Atlas/apps/web/src/pages/KingdomDirectory.tsx:363`

```typescript
// Current: Always imported
import ParticleEffect from '../components/ParticleEffect';

// Better: Lazy load, skip on mobile anyway
const ParticleEffect = React.lazy(() => import('../components/ParticleEffect'));
```

**Impact:** ~20KB bundle reduction  
**Effort:** 10 min

---

#### 10. Deduplicate Utility Functions
**Files:** 
- `api.ts:14-19` - `calculatePowerTier()`
- `KingdomDirectory.tsx:181-186` - `getPowerTier()`
- `KingdomCard.tsx:174-179` - `getPowerTier()`

**Fix:** Create `src/utils/scoring.ts` with single implementation

**Impact:** Smaller bundle, consistent behavior  
**Effort:** 20 min

---

## Top 10 Cost Wins

### Infrastructure Costs

| Item | Current | Optimized | Savings |
|------|---------|-----------|---------|
| **Hosting** | Netlify Free | Netlify Free | $0 |
| **API Hosting** | None (local) | Railway/Render Free | $0 |
| **Database** | SQLite | PostgreSQL (free tier) | $0 |
| **CDN** | Netlify built-in | Same | $0 |

**Current Monthly Cost:** ~$0 (development)  
**Projected Production Cost:** $0-20/month at low scale

### Cost Optimization Recommendations

#### 1. Stay on SQLite for MVP
SQLite handles 100k+ reads/day easily. Only switch to PostgreSQL when:
- You need concurrent writes
- You need full-text search
- Multiple API instances needed

#### 2. Use Netlify Edge Functions Sparingly
Edge functions cost money at scale. Keep compute on backend API.

#### 3. Optimize Image Assets
- Add WebP versions of images
- Use `loading="lazy"` on all images
- Consider Cloudinary free tier for transformations

#### 4. Bundle Size Budget
Current estimated bundle: ~400KB gzipped  
Target: <250KB gzipped

**Actions:**
- Tree-shake unused Heroicons
- Dynamic import html2canvas
- Lazy load routes

#### 5. API Response Size
**Issue:** `/api/kingdoms` returns all 500+ kingdoms with recent_kvks

**Fix:** 
- Default to paginated (15 per page)
- Remove `recent_kvks` from list view (only in profile)
- Compress responses (gzip middleware)

```python
from fastapi.middleware.gzip import GZipMiddleware
app.add_middleware(GZipMiddleware, minimum_size=1000)
```

#### 6. Database Query Logging
Add logging to identify slow queries before they become problems:

```python
import logging
logging.getLogger('sqlalchemy.engine').setLevel(logging.INFO)
```

#### 7. Free Tier Services to Consider
- **Supabase** - PostgreSQL + Auth (free tier generous)
- **PlanetScale** - MySQL (free tier)
- **Upstash** - Redis (free tier for caching)
- **Railway** - API hosting (free tier)

#### 8. Avoid These Cost Traps
- ❌ Don't use Vercel Serverless for FastAPI (cold starts)
- ❌ Don't use AWS Lambda without careful config
- ❌ Don't enable Netlify Analytics (paid)
- ✅ Use Plausible/Umami for free analytics

#### 9. Monitor Before Optimizing
Add basic metrics before over-optimizing:
- Response times (use FastAPI middleware)
- Error rates
- Popular endpoints

#### 10. CDN for Static Data
If kingdom data rarely changes, serve from CDN:
```
/data/kingdoms.json → Netlify CDN (already happening!)
```
This is already implemented and is a good pattern.

---

## Implementation Priority

| Priority | Item | Impact | Effort | ROI |
|----------|------|--------|--------|-----|
| P1 | Fix N+1 query | HIGH | 1h | ⭐⭐⭐⭐⭐ |
| P1 | Add DB indexes | HIGH | 15m | ⭐⭐⭐⭐⭐ |
| P1 | Cache rank calculation | HIGH | 30m | ⭐⭐⭐⭐ |
| P2 | API response caching | MED | 1h | ⭐⭐⭐⭐ |
| P2 | Dynamic import html2canvas | MED | 15m | ⭐⭐⭐⭐ |
| P2 | API pagination | MED | 1.5h | ⭐⭐⭐ |
| P3 | Lazy load components | LOW | 30m | ⭐⭐⭐ |
| P3 | Deduplicate utilities | LOW | 20m | ⭐⭐ |

---

## Scaling Projections

| Users/Day | Current Performance | After Optimization |
|-----------|--------------------|--------------------|
| 100 | ✅ Fine | ✅ Fine |
| 1,000 | ⚠️ Slow queries | ✅ Fine |
| 10,000 | ❌ DB bottleneck | ⚠️ Need Redis cache |
| 100,000 | ❌ Won't work | ⚠️ Need PostgreSQL + caching |

---

## What I Would Do Next

1. **This week:** Fix N+1 query + add indexes (2 hours total)
2. **Before launch:** Add API pagination + response caching
3. **Post-launch:** Monitor, then optimize based on real usage data

---

*Report generated by Governance Agent - Perf/Cost Review Routine E*

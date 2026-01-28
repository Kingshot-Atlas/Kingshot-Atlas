# Architecture Review Report

**Date:** 2026-01-26  
**Reviewer:** Architecture Agent (Fresh)  
**Scope:** Full system architecture assessment  
**Trigger:** Major changes implemented (auth, CORS, rate limiting, query optimization)

---

## Executive Summary

Kingshot Atlas is a well-structured monorepo with clear separation between frontend (React) and backend (FastAPI). The architecture is appropriate for an MVP/early-stage product. Recent security and performance fixes have significantly improved production-readiness.

**Architecture Grade:** B+ (Good for MVP, needs work for scale)

---

## Architecture Diagram (Text)

```
┌─────────────────────────────────────────────────────────────────────┐
│                           KINGSHOT ATLAS                            │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────┐         ┌─────────────────────┐
│    FRONTEND         │         │      BACKEND        │
│    (Netlify)        │         │    (Self-hosted)    │
├─────────────────────┤         ├─────────────────────┤
│                     │  HTTPS  │                     │
│  React 19 + TS      │◄───────►│  FastAPI            │
│  TailwindCSS        │   API   │  SQLAlchemy ORM     │
│  React Router       │         │  SQLite/PostgreSQL  │
│                     │         │                     │
│  Static JSON        │         │  Rate Limiting      │
│  (fallback data)    │         │  JWT Auth           │
│                     │         │  bcrypt passwords   │
└─────────────────────┘         └─────────────────────┘
        │                               │
        │                               │
        ▼                               ▼
┌─────────────────────┐         ┌─────────────────────┐
│  LocalStorage       │         │  Database           │
│  - Favorites        │         │  - Users            │
│  - Profile          │         │  - Kingdoms         │
│  - Cache            │         │  - KVK Records      │
│  - Reviews (temp)   │         │                     │
└─────────────────────┘         └─────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                         DATA PIPELINE                               │
├─────────────────────────────────────────────────────────────────────┤
│  CSV Files ──► process_kvks.py ──► processed/ ──► import_data.py   │
│  (raw/)                             (CSVs)         (to SQLite)      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Component Assessment

### Frontend (`apps/web/`)

| Aspect | Status | Notes |
|--------|--------|-------|
| Framework | ✅ Good | React 19, modern |
| Routing | ✅ Good | React Router v7 |
| Styling | ✅ Good | TailwindCSS + inline styles |
| State | ⚠️ Adequate | useState/useMemo, no global state |
| API Layer | ✅ Good | Centralized in `api.ts` with fallback |
| Build | ✅ Good | Create React App, Netlify deploy |

**Strengths:**
- Clean component structure
- Fallback to static JSON when API unavailable
- Good caching strategy in ApiService

**Weaknesses:**
- Large component files (refactor needed)
- No global state management (may need Redux/Zustand later)
- Reviews stored in localStorage only

### Backend (`apps/api/`)

| Aspect | Status | Notes |
|--------|--------|-------|
| Framework | ✅ Good | FastAPI (modern, fast, typed) |
| ORM | ✅ Good | SQLAlchemy 2.0 |
| Auth | ✅ Fixed | JWT + bcrypt (was placeholder) |
| Security | ✅ Fixed | CORS restricted, rate limited |
| Database | ⚠️ Adequate | SQLite (fine for MVP) |

**Strengths:**
- Clean router organization
- Pydantic schemas for validation
- Proper dependency injection

**Weaknesses:**
- No database migrations setup (alembic in deps but not configured)
- No background job system
- No caching layer (Redis)

### Data Pipeline

| Aspect | Status | Notes |
|--------|--------|-------|
| Import | ✅ Good | `import_data.py` clears and reimports |
| Processing | ✅ Good | `process_kvks.py` for transformations |
| Storage | ⚠️ Adequate | Static CSVs, manual updates |

**Improvement needed:** Automated data ingestion pipeline

---

## Risk Assessment

### HIGH Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| SQLite concurrent writes | Data corruption at scale | Migrate to PostgreSQL before high traffic |
| No backup strategy | Data loss | Implement automated backups |
| Single API instance | Downtime | Add health checks, consider redundancy |

### MEDIUM Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| No monitoring/alerting | Silent failures | Add Sentry or similar |
| Manual data updates | Stale data | Build admin panel or Discord bot |
| localStorage reviews | Data loss on clear | Move to backend database |

### LOW Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| Bundle size | Slow load | Already have lazy loading opportunities |
| No CDN for API | Latency | Consider edge caching later |

---

## Scaling Concerns

### Current Capacity (SQLite + Single Instance)

| Metric | Estimated Limit |
|--------|-----------------|
| Concurrent users | ~100 |
| Requests/second | ~50 |
| Database size | <1GB fine |
| Kingdoms | 10,000+ fine |

### Scaling Path

```
Phase 1 (Current): SQLite + Netlify + Manual deploy
    │
    ▼ (1,000+ daily users)
Phase 2: PostgreSQL + Railway/Render + CI/CD
    │
    ▼ (10,000+ daily users)
Phase 3: PostgreSQL + Redis cache + Load balancer
    │
    ▼ (100,000+ daily users)
Phase 4: Read replicas + CDN + Kubernetes
```

---

## Operational Complexity

| Component | Complexity | Notes |
|-----------|------------|-------|
| Frontend deploy | LOW | Netlify auto-deploys |
| Backend deploy | MEDIUM | Manual, needs CI/CD |
| Database ops | LOW | SQLite is file-based |
| Data updates | MEDIUM | Manual CSV → import |
| Monitoring | HIGH | None currently |

**Recommendation:** Add basic logging and error tracking before production.

---

## Cost Drivers

| Item | Current Cost | At Scale |
|------|--------------|----------|
| Netlify (frontend) | $0 | $0-19/mo |
| API hosting | $0 (local) | $5-20/mo (Railway/Render) |
| Database | $0 (SQLite) | $0-15/mo (Supabase free tier) |
| Monitoring | $0 | $0-29/mo (Sentry free tier) |
| **Total** | **$0** | **$5-83/mo** |

**Cost efficiency:** Architecture is cost-effective for MVP. No premature optimization.

---

## Data Model Assessment

### Current Schema

```
Users (1)
  │
  └── role, is_active, created_at

Kingdoms (500+)
  │
  ├── Stats: wins, losses, rates, streaks, score
  ├── Status: most_recent_status
  └── KVKRecords (N per kingdom)
        └── Results: prep, battle, overall, opponent
```

**Issues:**
1. No `updated_at` audit trail on KVKRecords
2. No soft delete capability
3. No versioning for historical tracking
4. Reviews not in database (localStorage only)

### Recommended Schema Additions (Future)

```sql
-- Add reviews table
CREATE TABLE reviews (
    id INTEGER PRIMARY KEY,
    kingdom_number INTEGER REFERENCES kingdoms,
    user_id INTEGER REFERENCES users,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    status VARCHAR DEFAULT 'pending',  -- pending, approved, rejected
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- Add kingdom history for trending
CREATE TABLE kingdom_snapshots (
    id INTEGER PRIMARY KEY,
    kingdom_number INTEGER REFERENCES kingdoms,
    overall_score FLOAT,
    snapshot_date DATE,
    UNIQUE(kingdom_number, snapshot_date)
);
```

---

## Safer Alternatives Considered

| Current Choice | Alternative | Why Current is OK |
|----------------|-------------|-------------------|
| SQLite | PostgreSQL | SQLite is fine for MVP reads |
| Self-hosted API | Serverless | FastAPI doesn't suit serverless well |
| No Redis | Redis cache | Premature optimization for <1000 users |
| localStorage reviews | DB reviews | Acceptable for MVP, plan to migrate |

---

## Architecture Recommendations

### Immediate (Before Launch)

1. ✅ **DONE:** Fix auth security (bcrypt + JWT)
2. ✅ **DONE:** Restrict CORS
3. ✅ **DONE:** Add rate limiting
4. ✅ **DONE:** Fix N+1 queries
5. ⬜ **TODO:** Set up CI/CD for API deployment
6. ⬜ **TODO:** Add basic error logging

### Short-term (Post-Launch)

1. Move reviews from localStorage to database
2. Add Sentry or similar for error tracking
3. Set up automated backups
4. Build admin panel for data management

### Long-term (At Scale)

1. Migrate to PostgreSQL
2. Add Redis caching layer
3. Implement proper background jobs (Celery/RQ)
4. Add read replicas if needed

---

## Conclusion

The architecture is **appropriate for an MVP** targeting up to 1,000 daily users. Recent security and performance fixes have addressed critical gaps. The main risks are:

1. **No monitoring** - add before launch
2. **SQLite limitations** - migrate before scaling
3. **Manual data pipeline** - automate when time permits

**Verdict:** ✅ Ready for staging/soft launch with current architecture.

---

*Report generated by Governance Agent - Architecture Review Routine D*

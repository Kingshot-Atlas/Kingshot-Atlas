# Code Review Report

**Date:** 2026-01-26  
**Reviewer:** Code Review Agent (Fresh)  
**Scope:** Full codebase review - API (FastAPI) + Web (React/TypeScript)  
**Status:** Initial Review

---

## Executive Summary

The Kingshot Atlas application is a kingdom statistics tracking system with a FastAPI backend and React frontend. The codebase is functional but has several security, performance, and code quality issues that need attention before production deployment.

**Release Readiness:** ⚠️ NOT READY - 2 Blockers, 4 Major issues

---

## Top 10 Issues by Severity

### 🔴 BLOCKER (Must Fix Before Release)

#### 1. **Insecure Authentication Implementation**
- **File:** `@/Users/giovanni/projects/ai/Kingshot Atlas/apps/api/api/routers/auth.py:14-18`
- **Issue:** Uses `fake_hash_password()` and `fake_verify_password()` - plaintext password comparison with "hashed_" prefix
- **Risk:** Critical security vulnerability - passwords are not actually hashed
- **Fix:** Replace with `passlib` or `bcrypt` for proper password hashing:
```python
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)
```

#### 2. **No JWT Token Implementation**
- **File:** `@/Users/giovanni/projects/ai/Kingshot Atlas/apps/api/api/routers/auth.py:67-68`
- **Issue:** Returns placeholder token string instead of real JWT
- **Risk:** Authentication is completely non-functional
- **Fix:** Implement proper JWT token creation with `python-jose`:
```python
from jose import JWTError, jwt
from datetime import datetime, timedelta

SECRET_KEY = os.getenv("SECRET_KEY")  # Must be in environment
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
```

---

### 🟠 MAJOR (Should Fix Before Release)

#### 3. **Overly Permissive CORS Configuration**
- **File:** `@/Users/giovanni/projects/ai/Kingshot Atlas/apps/api/main.py:16-22`
- **Issue:** `allow_origins=["*"]` allows any domain to make requests
- **Risk:** Enables CSRF attacks, data exfiltration from any malicious site
- **Fix:** Restrict to known origins:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://your-production-domain.netlify.app"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
```

#### 4. **Missing Dependency Version Pinning**
- **File:** `@/Users/giovanni/projects/ai/Kingshot Atlas/apps/api/requirements.txt`
- **Issue:** No version pins on any dependency
- **Risk:** Builds may break with new releases; security patches not trackable
- **Fix:** Pin all versions:
```
fastapi==0.109.0
uvicorn[standard]==0.27.0
sqlalchemy==2.0.25
alembic==1.13.1
python-dotenv==1.0.0
pandas==2.2.0
pydantic==2.5.3
passlib==1.7.4
python-jose[cryptography]==3.3.0
bcrypt==4.1.2
```

#### 5. **N+1 Query Problem in Kingdoms Endpoint**
- **File:** `@/Users/giovanni/projects/ai/Kingshot Atlas/apps/api/api/routers/kingdoms.py:62-66`
- **Issue:** Loops through kingdoms and makes individual DB query for each
- **Risk:** Performance degrades linearly with data size; 500 kingdoms = 501 queries
- **Fix:** Use SQLAlchemy `joinedload` or batch query:
```python
from sqlalchemy.orm import joinedload

query = db.query(Kingdom).options(joinedload(Kingdom.kvk_records))
```

#### 6. **Rank Calculation Fetches All Kingdoms**
- **File:** `@/Users/giovanni/projects/ai/Kingshot Atlas/apps/api/api/routers/kingdoms.py:83-88`
- **Issue:** `get_kingdom_profile()` loads ALL kingdoms just to calculate rank
- **Risk:** Unnecessary memory/CPU usage; will not scale
- **Fix:** Use SQL window function or cached rank column:
```python
# Add rank as computed column or use:
rank = db.query(func.count(Kingdom.kingdom_number)).filter(
    Kingdom.overall_score > kingdom.overall_score
).scalar() + 1
```

---

### 🟡 MINOR (Should Fix Eventually)

#### 7. **Inconsistent Power Tier Thresholds**
- **Files:** 
  - `@/Users/giovanni/projects/ai/Kingshot Atlas/apps/web/src/services/api.ts:14-19` (12/8/5)
  - `@/Users/giovanni/projects/ai/Kingshot Atlas/apps/web/src/pages/KingdomDirectory.tsx:181-186` (50/30/15)
- **Issue:** Two different tier calculation functions with different thresholds
- **Risk:** UI inconsistency, confusion for users
- **Fix:** Centralize tier logic in a single utility function and use everywhere

#### 8. **Missing Error Boundaries in React**
- **File:** `@/Users/giovanni/projects/ai/Kingshot Atlas/apps/web/src/App.tsx`
- **Issue:** No error boundary component wrapping routes
- **Risk:** Unhandled errors crash entire app with white screen
- **Fix:** Add React Error Boundary wrapper component

#### 9. **Large Component Files**
- **Files:**
  - `KingdomDirectory.tsx` - 1003 lines
  - `KingdomCard.tsx` - 875 lines
  - `Header.tsx` - 412 lines
- **Issue:** Files are too large, mixing concerns
- **Risk:** Hard to maintain, test, and review
- **Fix:** Extract into smaller, focused components (e.g., `FilterPanel`, `ComparePanel`, `CardActions`)

#### 10. **Missing Input Validation on Frontend**
- **File:** `@/Users/giovanni/projects/ai/Kingshot Atlas/apps/web/src/pages/KingdomDirectory.tsx`
- **Issue:** No validation on compare kingdom inputs before API call
- **Risk:** Bad UX when invalid data submitted
- **Fix:** Add client-side validation with proper error messages

---

## Additional Observations

### Missing Tests
- **No unit tests** for API routers
- **No integration tests** for database operations
- `App.test.tsx` exists but appears minimal (273 bytes)

### Missing Security Headers
- No rate limiting on API endpoints
- No security headers (CSP, X-Frame-Options, etc.)
- Discord OAuth `client_id` placeholder in code

### Code Quality
- `datetime.utcnow()` is deprecated in Python 3.12+ - use `datetime.now(timezone.utc)`
- Some unused imports in routers (`and_` in kingdoms.py)
- SQLite for production - consider PostgreSQL for concurrent access

---

## Must-Fix Before Release List

| Priority | Issue | Effort |
|----------|-------|--------|
| 🔴 P0 | Implement real password hashing | 1 hour |
| 🔴 P0 | Implement JWT tokens | 2 hours |
| 🟠 P1 | Restrict CORS origins | 15 min |
| 🟠 P1 | Pin dependency versions | 30 min |
| 🟠 P1 | Fix N+1 query in /kingdoms | 1 hour |
| 🟠 P1 | Optimize rank calculation | 1 hour |

**Total Estimated Fix Time:** ~6 hours

---

## What I Would Do Next

1. **Immediately:** Fix the two BLOCKER auth issues - these are critical security holes
2. **This Week:** Address all MAJOR issues, especially CORS and N+1 queries
3. **Before Next Release:** Add basic test coverage for auth and kingdoms endpoints
4. **Ongoing:** Refactor large components, add error boundaries

---

*Report generated by Governance Agent - Code Review Routine A*

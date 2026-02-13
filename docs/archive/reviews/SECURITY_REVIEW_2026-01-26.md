# Security Pen Test Report

**Date:** 2026-01-26  
**Reviewer:** Security Agent (Fresh)  
**Scope:** Code-level security review (not network penetration testing)  
**Status:** Pre-Release Security Audit

---

## Executive Summary

The Kingshot Atlas application has **critical security vulnerabilities** that make it unsuitable for production deployment. The authentication system is entirely non-functional from a security standpoint, and several other issues expose the application to common attack vectors.

**Security Posture:** 🔴 CRITICAL - Do not deploy

---

## Threat Model Summary

### Application Context
- **Type:** Gaming statistics platform with user accounts
- **Data Sensitivity:** User credentials, email addresses, user preferences
- **Attack Surface:** Public web API, user-submitted content, OAuth flows

### Primary Threats
1. **Account Takeover** - Via password compromise or session hijacking
2. **Data Exfiltration** - Via CORS misconfiguration
3. **Abuse** - Via missing rate limiting
4. **XSS** - Via user-generated content (reviews)

---

## Exploit Paths Found

### 🔴 CRITICAL - Immediate Exploitation Possible

#### 1. Password Exposure via Fake Hashing
**File:** `@/Users/giovanni/projects/ai/Kingshot Atlas/apps/api/api/routers/auth.py:14-18`

```python
def fake_hash_password(password: str) -> str:
    return "hashed_" + password  # Password stored in PLAINTEXT

def fake_verify_password(plain_password: str, hashed_password: str) -> bool:
    return hashed_password == "hashed_" + plain_password
```

**Exploit:**
- Attacker gains database access (SQLi, backup leak, insider)
- All passwords immediately readable by removing "hashed_" prefix
- No computational effort needed

**Impact:** Complete credential compromise  
**CVSS:** 9.8 (Critical)

---

#### 2. Token Forgery - No Cryptographic Verification
**File:** `@/Users/giovanni/projects/ai/Kingshot Atlas/apps/api/api/routers/auth.py:67-68`

```python
access_token = "placeholder_token_for_" + user.username
```

**Exploit:**
```bash
# Attacker can forge any user's token:
curl -H "Authorization: Bearer placeholder_token_for_admin" \
  http://api.target.com/api/auth/me
```

**Impact:** Complete authentication bypass  
**CVSS:** 10.0 (Critical)

---

#### 3. Broken Token Validation
**File:** `@/Users/giovanni/projects/ai/Kingshot Atlas/apps/api/api/routers/auth.py:20-29`

```python
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    # Token is COMPLETELY IGNORED - always returns placeholder_user
    user = db.query(User).filter(User.username == "placeholder_user").first()
```

**Exploit:** Any token (or no token) is accepted if a user named "placeholder_user" exists.

**Impact:** Authentication bypass  
**CVSS:** 10.0 (Critical)

---

### 🟠 HIGH - Significant Risk

#### 4. CORS Allows Any Origin
**File:** `@/Users/giovanni/projects/ai/Kingshot Atlas/apps/api/main.py:16-22`

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # DANGEROUS
    allow_credentials=True,
    ...
)
```

**Exploit:**
```html
<!-- Malicious site can read API responses -->
<script>
fetch('https://api.kingshot.com/api/auth/me', {credentials: 'include'})
  .then(r => r.json())
  .then(data => exfiltrate(data));
</script>
```

**Impact:** Cross-site data theft, CSRF  
**CVSS:** 7.5 (High)

---

#### 5. No Rate Limiting
**Files:** All API routers

**Exploit:**
```bash
# Brute force attack on login
for pass in $(cat wordlist.txt); do
  curl -X POST "http://api/auth/token" -d "username=admin&password=$pass"
done
```

**Impact:** Credential brute-forcing, DoS  
**CVSS:** 7.3 (High)

---

#### 6. Discord OAuth Client ID Placeholder in Code
**File:** `@/Users/giovanni/projects/ai/Kingshot Atlas/apps/web/src/components/Header.tsx:29`

```typescript
const clientId = process.env.REACT_APP_DISCORD_CLIENT_ID || 'YOUR_DISCORD_CLIENT_ID';
```

**Risk:** If deployed without setting env var, OAuth won't work. If a real ID is accidentally committed, it could be misused.

---

### 🟡 MEDIUM - Should Address

#### 7. No Input Sanitization on Review Content
**Risk:** Stored XSS if reviews are displayed without sanitization. Currently reviews are stored in localStorage, but if moved to backend, this becomes critical.

#### 8. SQLite in Production Path
**File:** `@/Users/giovanni/projects/ai/Kingshot Atlas/apps/api/database.py:6`

```python
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./kingshot_atlas.db")
```

**Risk:** SQLite has no user authentication, single-writer limitation, and database file could be served if misconfigured.

#### 9. No HTTPS Enforcement
**Risk:** Credentials sent in plaintext over HTTP during development/staging.

#### 10. Missing Security Headers
**Missing:**
- `Content-Security-Policy`
- `X-Content-Type-Options`
- `X-Frame-Options`
- `Strict-Transport-Security`

---

## Dependency Risk Analysis

### Python Backend (`requirements.txt`)
| Package | Risk | Notes |
|---------|------|-------|
| fastapi | LOW | Well-maintained, but version not pinned |
| uvicorn | LOW | Version not pinned |
| sqlalchemy | LOW | Version not pinned |
| pandas | MEDIUM | Large attack surface, version not pinned |

**Missing Security Packages:**
- `passlib` / `bcrypt` for password hashing
- `python-jose` for JWT tokens
- `slowapi` for rate limiting

### Frontend (`package.json`)
| Package | Risk | Notes |
|---------|------|-------|
| react@19.2.3 | LOW | Current |
| html2canvas@1.4.1 | MEDIUM | Executes on user content |

**Recommendation:** Run `npm audit` regularly.

---

## Fixes + Code-Level Mitigations

### P0: Fix Authentication (Est: 3-4 hours)

**1. Install security dependencies:**
```bash
pip install passlib[bcrypt] python-jose[cryptography]
```

**2. Add to `requirements.txt`:**
```
passlib[bcrypt]==1.7.4
python-jose[cryptography]==3.3.0
```

**3. Replace fake password functions in `auth.py`:**
```python
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
import os

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.getenv("SECRET_KEY")  # MUST set in production
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    return user
```

### P1: Fix CORS (Est: 5 min)

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://kingshot-atlas.netlify.app",  # Your actual domain
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
```

### P1: Add Rate Limiting (Est: 30 min)

```bash
pip install slowapi
```

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@router.post("/auth/token")
@limiter.limit("5/minute")
def login_for_access_token(...):
    ...
```

### P2: Add Security Headers (Est: 15 min)

```python
from starlette.middleware import Middleware
from starlette.middleware.httpsredirect import HTTPSRedirectMiddleware

@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response
```

---

## Security Checklist Before Release

| Item | Status | Priority |
|------|--------|----------|
| Real password hashing (bcrypt) | ❌ NOT DONE | P0 |
| JWT token implementation | ❌ NOT DONE | P0 |
| Token validation working | ❌ NOT DONE | P0 |
| CORS restricted to known origins | ❌ NOT DONE | P1 |
| Rate limiting on auth endpoints | ❌ NOT DONE | P1 |
| SECRET_KEY in environment | ❌ NOT DONE | P0 |
| No secrets in codebase | ✅ OK | - |
| Dependencies version-pinned | ❌ NOT DONE | P1 |
| Security headers added | ❌ NOT DONE | P2 |
| Input validation on all endpoints | ⚠️ PARTIAL | P2 |
| SQL injection protection (ORM) | ✅ OK | - |
| No eval/exec usage | ✅ OK | - |

---

## What I Would Do Next

1. **Immediately:** Implement real bcrypt password hashing - this is a 30-minute fix
2. **Today:** Implement JWT tokens with proper validation
3. **Before Deploy:** Restrict CORS, add rate limiting, set SECRET_KEY
4. **Ongoing:** Set up `npm audit` and `pip-audit` in CI

---

*Report generated by Governance Agent - Security Review Routine B*

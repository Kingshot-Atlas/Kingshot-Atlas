# Security Specialist — Latest Knowledge

**Last Updated:** 2026-02-05  
**Purpose:** Current threats, vulnerabilities, and security best practices

---

## Latest Audit Results (2026-02-05)

### npm (Frontend)
- **Status:** ✅ Clean (0 vulnerabilities)
- **Action Taken:** Updated vitest ^2.0.0 → ^4.0.18 to fix 6 moderate vulnerabilities
- **Automated:** Weekly audit via `.github/workflows/security-audit.yml`

### pip (API)
- **Status:** ⚠️ 1 low-risk vulnerability (accepted)
- **Issue:** `ecdsa 0.19.1` - CVE-2024-23342 (Minerva timing attack)
- **Risk Assessment:** LOW - requires precise local timing measurements, not exploitable over network
- **Fix Available:** No - maintainers consider timing attacks out of scope
- **Decision:** Accept risk - this is a transitive dependency of `python-jose` used for JWT

### CI/CD Security
- **Weekly Audit:** Runs every Monday 9:00 UTC
- **PR Checks:** Fails on high/critical vulnerabilities in production deps
- **Workflow:** `.github/workflows/security-audit.yml`

---

## Kingshot Atlas Security Context

### Current Stack
- **Frontend:** React 19, TypeScript, Vite
- **Backend:** FastAPI (Python), SQLAlchemy
- **Auth:** Supabase
- **Hosting:** Cloudflare Pages (frontend), Render (API)
- **Monitoring:** Sentry

### Security Measures Already in Place
- CORS configured for known origins
- Security headers (CSP, X-Frame-Options, etc.)
- Rate limiting via slowapi
- Input validation via Pydantic
- GZip compression
- Sentry error monitoring

### Key Files to Audit
```
/apps/api/main.py           → CORS, headers, middleware
/apps/api/api/routers/      → API endpoints
/apps/api/models.py         → Database models
/apps/api/schemas.py        → Pydantic validation
/apps/web/src/contexts/AuthContext.tsx → Auth state
/apps/web/src/lib/          → API client, utilities
```

---

## Current Threat Landscape (2025-2026)

### Top Web Application Threats
1. **API Abuse** — Automated attacks on APIs increasing 300%
2. **Supply Chain Attacks** — Compromised npm/PyPI packages
3. **Credential Stuffing** — Automated login attempts with leaked credentials
4. **Business Logic Flaws** — Exploiting application-specific logic
5. **AI-Powered Attacks** — Automated vulnerability discovery

### Gaming/Community Platform Specific Threats
- Account takeover for competitive advantage
- Data scraping for competitive intelligence
- DDoS during high-traffic events (KvK)
- Social engineering via Discord
- Fake data submission to manipulate rankings

---

## OWASP Top 10 (2021) Quick Reference

| # | Vulnerability | Key Prevention |
|---|---------------|----------------|
| A01 | Broken Access Control | Deny by default, verify on every request |
| A02 | Cryptographic Failures | TLS everywhere, no sensitive data in URLs |
| A03 | Injection | Parameterized queries, input validation |
| A04 | Insecure Design | Threat modeling, secure patterns |
| A05 | Security Misconfiguration | Hardened defaults, no debug in prod |
| A06 | Vulnerable Components | Regular scanning, minimal dependencies |
| A07 | Auth Failures | Strong passwords, rate limiting, MFA |
| A08 | Integrity Failures | Verify dependencies, secure CI/CD |
| A09 | Logging Failures | Log security events, protect logs |
| A10 | SSRF | Validate URLs, allowlist external calls |

---

## FastAPI Security Best Practices

### Authentication
```python
# ✅ Good: Dependency injection for auth
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer

security = HTTPBearer()

async def get_current_user(token: str = Depends(security)):
    user = verify_token(token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    return user

@router.get("/protected")
async def protected_route(user: User = Depends(get_current_user)):
    return {"user": user.id}
```

### Input Validation
```python
# ✅ Good: Pydantic with constraints
from pydantic import BaseModel, Field, validator

class KingdomSearch(BaseModel):
    kingdom_number: int = Field(..., ge=1, le=9999)
    name: str = Field(None, max_length=100)
    
    @validator('name')
    def sanitize_name(cls, v):
        if v:
            # Remove potential injection characters
            return v.strip()[:100]
        return v
```

### SQL Injection Prevention
```python
# ✅ Good: SQLAlchemy ORM (parameterized)
kingdom = db.query(Kingdom).filter(Kingdom.number == kingdom_number).first()

# ❌ Bad: String concatenation
query = f"SELECT * FROM kingdoms WHERE number = {kingdom_number}"
```

### Rate Limiting
```python
# ✅ Good: slowapi rate limiting
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@router.get("/kingdoms")
@limiter.limit("100/minute")
async def list_kingdoms(request: Request):
    ...
```

---

## React Security Best Practices

### XSS Prevention
```typescript
// ✅ Good: React auto-escapes
return <div>{userInput}</div>;

// ❌ Bad: dangerouslySetInnerHTML
return <div dangerouslySetInnerHTML={{ __html: userInput }} />;

// If HTML is needed, sanitize first
import DOMPurify from 'dompurify';
const clean = DOMPurify.sanitize(userInput);
return <div dangerouslySetInnerHTML={{ __html: clean }} />;
```

### Sensitive Data Handling
```typescript
// ✅ Good: Don't log sensitive data
console.log('User logged in:', user.id);

// ❌ Bad: Logging tokens or passwords
console.log('Token:', authToken);
```

### API Calls
```typescript
// ✅ Good: Use environment variables, validate responses
const API_URL = import.meta.env.VITE_API_URL;

const response = await fetch(`${API_URL}/kingdoms/${id}`);
if (!response.ok) {
    throw new Error('Failed to fetch');
}
const data = await response.json();
// Validate data shape before using
```

---

## Security Headers Reference

### Recommended Headers
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), camera=(), microphone=()
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; ...
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

### CSP Directives
```
default-src 'self'                    # Default fallback
script-src 'self' 'unsafe-inline'     # Scripts (unsafe-inline for React)
style-src 'self' 'unsafe-inline'      # Styles (unsafe-inline for Tailwind)
img-src 'self' data: https:           # Images
font-src 'self' https://fonts.gstatic.com
connect-src 'self' https://*.supabase.co https://*.sentry.io
frame-ancestors 'none'                # Prevent framing
```

---

## Dependency Security

### npm Audit Commands
```bash
# Check for vulnerabilities
npm audit

# Fix automatically where possible
npm audit fix

# Force fix (may have breaking changes)
npm audit fix --force

# Generate report
npm audit --json > audit-report.json
```

### Python Audit Commands
```bash
# Using pip-audit
pip-audit

# Using safety
safety check

# Check specific requirements file
pip-audit -r requirements.txt
```

### High-Risk Dependencies to Monitor
- **Authentication libraries** — Any auth-related package
- **Crypto libraries** — Encryption, hashing
- **HTTP clients** — axios, requests, fetch wrappers
- **Database drivers** — SQLAlchemy, asyncpg
- **Serialization** — JSON parsers, YAML parsers

---

## Common Vulnerability Patterns

### Broken Access Control
```python
# ❌ Vulnerable: No ownership check
@router.get("/user/{user_id}/data")
async def get_user_data(user_id: int):
    return db.query(UserData).filter(UserData.user_id == user_id).all()

# ✅ Fixed: Verify ownership
@router.get("/user/{user_id}/data")
async def get_user_data(user_id: int, current_user: User = Depends(get_current_user)):
    if current_user.id != user_id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    return db.query(UserData).filter(UserData.user_id == user_id).all()
```

### Mass Assignment
```python
# ❌ Vulnerable: Accepting all fields
@router.put("/user/{user_id}")
async def update_user(user_id: int, data: dict):
    user = db.query(User).get(user_id)
    for key, value in data.items():
        setattr(user, key, value)  # Could set is_admin=True!

# ✅ Fixed: Explicit allowed fields
class UserUpdate(BaseModel):
    name: str = None
    email: str = None
    # is_admin NOT included

@router.put("/user/{user_id}")
async def update_user(user_id: int, data: UserUpdate):
    ...
```

### Information Disclosure
```python
# ❌ Vulnerable: Detailed error messages
except Exception as e:
    return {"error": str(e)}  # May leak internal details

# ✅ Fixed: Generic messages, log details
except Exception as e:
    logger.error(f"Error processing request: {e}")
    return {"error": "An error occurred"}
```

---

## Incident Response Checklist

### Detection
- [ ] Identify the incident type
- [ ] Determine scope (what's affected)
- [ ] Assess severity
- [ ] Preserve evidence (logs, screenshots)

### Containment
- [ ] Isolate affected systems if needed
- [ ] Revoke compromised credentials
- [ ] Block malicious IPs/users
- [ ] Enable additional logging

### Eradication
- [ ] Remove malicious code/data
- [ ] Patch vulnerabilities
- [ ] Update dependencies
- [ ] Rotate secrets if exposed

### Recovery
- [ ] Restore from clean backup if needed
- [ ] Verify system integrity
- [ ] Re-enable services gradually
- [ ] Monitor for recurrence

### Post-Incident
- [ ] Document timeline
- [ ] Identify root cause
- [ ] Update security measures
- [ ] Communicate to stakeholders if needed

---

## Security Testing Tools

### Free/Open Source
| Tool | Purpose |
|------|---------|
| **OWASP ZAP** | Web app scanner |
| **Burp Suite Community** | Proxy/scanner |
| **Nikto** | Web server scanner |
| **SQLMap** | SQL injection testing |
| **Nuclei** | Vulnerability scanner |
| **TruffleHog** | Secrets detection |
| **Semgrep** | Static analysis |
| **Bandit** | Python security linter |

### Online Services
| Service | Purpose |
|---------|---------|
| **securityheaders.com** | Header analysis |
| **SSL Labs** | TLS configuration |
| **Mozilla Observatory** | Web security scan |
| **Snyk** | Dependency scanning |

---

## Compliance Quick Reference

### GDPR (If EU Users)
- Lawful basis for data processing
- Right to access, rectify, delete
- Data breach notification (72 hours)
- Privacy by design

### General Best Practices
- Minimize data collection
- Encrypt sensitive data
- Implement access controls
- Maintain audit logs
- Regular security assessments

---

## Security Metrics to Track

| Metric | Target |
|--------|--------|
| Time to patch critical vulnerabilities | < 24 hours |
| Dependency vulnerabilities (critical/high) | 0 |
| Failed login attempts (unusual spikes) | Monitor |
| Security header score | A+ |
| SSL Labs grade | A+ |
| Time since last security audit | < 30 days |

---

*Knowledge maintained by Security Specialist*

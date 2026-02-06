# Security Audit Checklist

**Last Updated:** 2026-02-06  
**Owner:** Ops Lead  
**Review Frequency:** Monthly

---

## Quick Status

| Category | Status | Last Checked |
|----------|--------|--------------|
| HTTPS & TLS | ✅ Pass | 2026-01-29 |
| Security Headers | ✅ Pass | 2026-01-29 |
| Authentication | ✅ Pass | 2026-01-29 |
| API Security | ✅ Pass | 2026-01-29 |
| Data Protection | ✅ Pass | 2026-01-29 |
| Dependencies | ⚠️ Review | - |

---

## 1. Transport Security

### HTTPS Configuration
- [x] All traffic served over HTTPS
- [x] HTTP redirects to HTTPS (Cloudflare automatic)
- [x] HSTS header enabled (`max-age=31536000; includeSubDomains; preload`)
- [ ] HSTS preload list submission (optional)
- [x] Valid SSL certificate (Cloudflare managed)

### Verification Commands
```bash
# Check HTTPS redirect
curl -I http://ks-atlas.com

# Check HSTS header
curl -I https://ks-atlas.com | grep -i strict

# Check SSL certificate
openssl s_client -connect ks-atlas.com:443 -servername ks-atlas.com
```

---

## 2. Security Headers

### Required Headers (_headers)
- [x] `X-Frame-Options: DENY` - Prevents clickjacking
- [x] `X-Content-Type-Options: nosniff` - Prevents MIME sniffing
- [x] `X-XSS-Protection: 1; mode=block` - XSS filter (legacy browsers)
- [x] `Referrer-Policy: strict-origin-when-cross-origin` - Controls referrer info
- [x] `Permissions-Policy` - Restricts browser features
- [x] `Content-Security-Policy` - Controls resource loading
- [x] `Strict-Transport-Security` - Enforces HTTPS

### CSP Directives Configured
```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.stripe.com https://plausible.io;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
img-src 'self' data: https: blob:;
font-src 'self' https://fonts.gstatic.com;
connect-src 'self' https://*.supabase.co https://*.sentry.io https://api.stripe.com https://plausible.io wss://*.supabase.co;
frame-src https://*.stripe.com;
frame-ancestors 'none';
```

### Verification
```bash
# Check all security headers
curl -I https://ks-atlas.com | grep -E "(X-Frame|X-Content|X-XSS|Referrer|Permissions|Content-Security|Strict-Transport)"
```

---

## 3. Authentication Security

### Supabase Auth
- [x] OAuth providers configured (Google, Discord)
- [x] Email/password with secure defaults
- [x] JWT tokens with appropriate expiry
- [x] Row Level Security (RLS) enabled on all tables
- [x] No sensitive data in JWT payload

### Session Management
- [x] Secure session storage (Supabase handles)
- [x] Session invalidation on logout
- [x] No session data in URL parameters

### Password Policy (if email auth enabled)
- [x] Minimum 8 characters (Supabase default)
- [x] Rate limiting on login attempts

---

## 4. API Security

### Backend (FastAPI)
- [x] CORS restricted to known origins
- [x] Rate limiting enabled (slowapi)
- [x] Input validation (Pydantic schemas)
- [x] SQL injection prevention (SQLAlchemy ORM)
- [x] Error messages don't leak internal details

### Frontend
- [x] Client-side rate limiting implemented
- [x] API errors handled gracefully
- [x] No sensitive data in localStorage (except auth tokens)
- [x] XSS prevention (React auto-escapes)

### CORS Configuration
```python
ALLOWED_ORIGINS = [
    "https://ks-atlas.com",
    "https://www.ks-atlas.com",
    "https://ks-atlas.pages.dev",
    "http://localhost:3000",  # Development only
]
```

---

## 5. Data Protection

### Sensitive Data Handling
- [x] No PII stored unnecessarily
- [x] Passwords never stored (OAuth only, or Supabase handles)
- [x] API keys in environment variables only
- [x] No secrets in client-side code
- [x] No secrets committed to git

### Environment Variables
```
# NEVER commit these:
- SUPABASE_JWT_SECRET
- SECRET_KEY
- ANTHROPIC_API_KEY
- SENTRY_DSN (optional but sensitive)
- STRIPE_SECRET_KEY
```

### Data Retention
- Analytics: 30 days local, then cleared
- Session data: Until logout
- User preferences: Indefinite (non-sensitive)

---

## 6. Dependency Security

### Regular Checks
```bash
# Frontend - check for vulnerabilities
cd apps/web && npm audit

# Backend - check for vulnerabilities
cd apps/api && pip-audit  # or safety check
```

### Update Policy
- **Critical vulnerabilities:** Patch within 24 hours
- **High vulnerabilities:** Patch within 1 week
- **Medium/Low:** Include in next release

### Automated Scanning
- [ ] Enable Dependabot (GitHub)
- [ ] Enable npm audit in CI
- [ ] Enable pip-audit in CI

---

## 7. Infrastructure Security

### Cloudflare Pages (Frontend)
- [x] Deploy previews restricted (if sensitive)
- [x] Build logs don't expose secrets
- [x] Environment variables properly scoped

### Render (Backend)
- [x] Environment variables encrypted
- [x] No public access to database
- [x] Logs don't contain sensitive data

### DNS
- [x] DNSSEC enabled (if supported by registrar)
- [x] CAA records configured (optional)

---

## 8. Monitoring & Incident Response

### Error Monitoring
- [x] Sentry configured for frontend
- [x] Sentry configured for backend
- [x] Sensitive data filtered from error reports

### Logging
- [x] No sensitive data in logs
- [x] Production logs don't include debug info
- [x] Log retention policy defined

### Incident Response
- [ ] Security contact published (security@ks-atlas.com)
- [ ] Incident response plan documented
- [ ] Regular security review scheduled

---

## 9. Code Security

### Best Practices
- [x] No `eval()` or `dangerouslySetInnerHTML` without sanitization
- [x] User input always validated
- [x] File uploads restricted (if applicable)
- [x] No hardcoded credentials

### Review Checklist (for PRs)
- [ ] No new dependencies without review
- [ ] No sensitive data exposure
- [ ] Input validation on new endpoints
- [ ] Error handling doesn't leak info

---

## 10. Compliance

### Privacy
- [x] Privacy policy published
- [x] Cookie consent (if required)
- [x] Data deletion capability (via Supabase)

### Third-Party Services
| Service | Data Shared | Privacy Policy |
|---------|-------------|----------------|
| Supabase | Auth data | ✅ |
| Sentry | Error data | ✅ |
| Plausible | Page views (no PII) | ✅ |
| Stripe | Payment data | ✅ |

---

## Monthly Review Tasks

1. [ ] Run `npm audit` and `pip-audit`
2. [ ] Check Sentry for security-related errors
3. [ ] Review access logs for anomalies
4. [ ] Verify all environment variables are current
5. [ ] Test authentication flows
6. [ ] Verify HTTPS and headers with online tools
7. [ ] Update this checklist status

### Useful Tools
- https://securityheaders.com/?q=ks-atlas.com
- https://observatory.mozilla.org/analyze/ks-atlas.com
- https://www.ssllabs.com/ssltest/analyze.html?d=ks-atlas.com

---

*Maintained by Ops Lead — Review monthly*

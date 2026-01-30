---
description: Comprehensive security testing workflow for Kingshot Atlas system
---

# Security Testing Workflow (securitytest)

**Purpose:** Perform comprehensive security analysis of the Kingshot Atlas system including vulnerability assessment, penetration testing, and security posture evaluation.

**Usage:** Run "Security-specialist, do a securitytest" to execute this workflow.

## Phase 1: Reconnaissance & Information Gathering

### 1.1 System Architecture Analysis
- Map all entry points: API endpoints, web interfaces, database connections
- Identify technology stack: React, FastAPI, Supabase/PostgreSQL
- Document data flow: client → API → database → external services
- List all external dependencies and third-party services

### 1.2 Configuration Review
- Examine environment variables and secrets management
- Review CORS policies and CSP headers
- Check authentication and authorization configurations
- Analyze API rate limiting and input validation

### 1.3 Attack Surface Mapping
- Identify all user input vectors
- Map file upload/download capabilities
- Document API endpoints and their access levels
- List administrative interfaces and privileged operations

## Phase 2: Vulnerability Assessment

### 2.1 Web Application Security
- Test for OWASP Top 10 vulnerabilities:
  - Injection attacks (SQL, NoSQL, command)
  - Broken authentication
  - Sensitive data exposure
  - XML external entities (XXE)
  - Broken access control
  - Security misconfiguration
  - Cross-site scripting (XSS)
  - Insecure deserialization
  - Using components with known vulnerabilities
  - Insufficient logging & monitoring

### 2.2 API Security Testing
- Test authentication bypasses
- Check for authorization flaws
- Validate input sanitization
- Test for rate limiting bypasses
- Examine error message information disclosure

### 2.3 Database Security
- Test for SQL injection vulnerabilities
- Check database connection security
- Review data encryption at rest and in transit
- Examine database access controls

### 2.4 Infrastructure Security
- Review deployment configurations
- Check for exposed services
- Test network security controls
- Examine logging and monitoring

## Phase 3: Penetration Testing

### 3.1 Authenticated Testing
- Test privilege escalation paths
- Examine session management
- Test user impersonation risks
- Check for lateral movement opportunities

### 3.2 Unauthenticated Testing
- Test for anonymous access to protected resources
- Check for information disclosure
- Test for account enumeration
- Examine password reset flows

### 3.3 Client-Side Security
- Test for XSS vulnerabilities
- Check for CSRF protection
- Examine client-side data storage
- Test for insecure direct object references

## Phase 4: Security Configuration Review

### 4.1 Headers & Policies
- Verify security headers (HSTS, CSP, X-Frame-Options)
- Check CORS configuration
- Review cookie security settings
- Examine content security policies

### 4.2 Authentication & Authorization
- Review password policies
- Check multi-factor authentication
- Examine session timeout settings
- Test account lockout mechanisms

### 4.3 Data Protection
- Verify encryption implementation
- Check data masking in logs
- Review PII handling
- Test data backup security

## Phase 5: Reporting & Recommendations

### 5.1 Risk Assessment
- Categorize vulnerabilities by severity (Critical, High, Medium, Low)
- Assess potential impact and likelihood
- Calculate risk scores
- Prioritize remediation efforts

### 5.2 Security Score Calculation
- Calculate overall security posture score (0-100)
- Provide confidence levels for assessments
- Generate trend analysis if previous tests exist
- Benchmark against industry standards

### 5.3 Remediation Plan
- Provide specific fix recommendations
- Estimate remediation effort and complexity
- Suggest security controls to implement
- Recommend monitoring improvements

## Execution Commands

### Automated Security Scans
```bash
# Dependency vulnerability scanning
npm audit
pip-audit

# Static code analysis
semgrep --config=auto .
bandit -r apps/api/

# Infrastructure scanning
nmap -sV -oX nmap_scan.xml localhost
sslyze --regular ks-atlas.com
```

### Manual Testing Procedures
```bash
# API endpoint enumeration
curl -s https://ks-atlas.com/api/v1/ | jq .

# Header analysis
curl -I https://ks-atlas.com

# CORS testing
curl -H "Origin: https://evil.com" https://ks-atlas.com/api/kingdoms
```

## Security Report Template

### Executive Summary
- Overall security posture: [Score]/100
- Critical vulnerabilities found: [Count]
- High-risk issues: [Count]
- Confidence level: [High/Medium/Low]

### Detailed Findings
| Vulnerability | Severity | Impact | Likelihood | Risk Score | Recommendation |
|---------------|----------|---------|------------|------------|---------------|

### Compliance Assessment
- OWASP Top 10 compliance: [Score]%
- Industry standards alignment: [Status]
- Data protection compliance: [Status]

### Action Items
1. [Immediate critical fixes]
2. [High-priority improvements]
3. [Medium-term enhancements]
4. [Long-term security roadmap]

## Tools & Resources

### Security Testing Tools
- **OWASP ZAP** - Web application security scanner
- **Burp Suite** - Web vulnerability testing
- **SQLMap** - SQL injection testing
- **Nikto** - Web server scanner
- **Nmap** - Network discovery and security auditing

### Code Analysis Tools
- **Semgrep** - Static analysis
- **Bandit** - Python security linter
- **ESLint Security Plugin** - JavaScript security
- **Safety** - Python dependency scanning

### Monitoring & Logging
- Security event logging
- Intrusion detection systems
- Access pattern analysis
- Anomaly detection

## Success Criteria

- All critical vulnerabilities identified and documented
- Security posture score calculated with confidence intervals
- Actionable remediation plan provided
- Security baseline established for future comparisons
- Executive summary suitable for non-technical stakeholders

## Notes & Considerations

- Always obtain proper authorization before testing
- Test in non-production environments first
- Document all findings with reproducible steps
- Consider business context when assessing risk
- Provide both technical and business impact assessments

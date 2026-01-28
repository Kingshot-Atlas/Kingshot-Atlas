# Business & Maintenance - Latest Knowledge

**Last Verified:** 2026-01-27  
**Next Review:** Before each major task

---

## SEO Best Practices (2025-2026)

### Meta Tags
```html
<title>Primary Keyword - Brand Name</title>
<meta name="description" content="155-160 chars, include keywords naturally">
<link rel="canonical" href="https://example.com/page">
```

### Core Web Vitals
- LCP, INP, CLS directly affect rankings
- Mobile-first indexing is standard

---

## Analytics (2025)

### Privacy-First Options
- GA4 with consent mode
- Plausible, Fathom for GDPR compliance
- Server-side tracking for accuracy

### Key Metrics
- Acquisition: Traffic sources
- Engagement: Time on site
- Conversion: Goal completions
- Technical: Errors, uptime

---

## CI/CD (GitHub Actions)

### Basic Workflow
```yaml
name: CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build
```

---

## Deployment Platforms

### Netlify
- Auto-deploy from git
- Preview deploys for PRs
- Serverless functions
- Forms, identity built-in

### Vercel
- Next.js optimized
- Edge functions
- Analytics built-in

### Railway
- Backend/API hosting
- PostgreSQL, Redis
- Auto-scaling

---

## Monitoring

### Error Tracking
- Sentry for JS errors
- Source maps for debugging

### Uptime
- UptimeRobot, Better Uptime
- Status pages for transparency

### Alerts
- PagerDuty, Opsgenie for on-call
- Slack/Discord integrations

---

## Security

### Environment Variables
- Never commit secrets
- Use platform secret management
- Rotate keys periodically

### Dependencies
- Run npm audit regularly
- Dependabot for updates
- Review before merging

---

*Knowledge evolves. Verify before applying.*

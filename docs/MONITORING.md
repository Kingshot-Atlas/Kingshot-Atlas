# Monitoring & Uptime Configuration

**Last Updated:** 2026-01-29  
**Owner:** Ops Lead

---

## Overview

This document outlines the monitoring setup for Kingshot Atlas, including uptime monitoring, error tracking, and alerting configuration.

---

## Uptime Monitoring (UptimeRobot)

### Recommended Monitors

| Monitor Name | URL | Check Interval | Alert Threshold |
|--------------|-----|----------------|-----------------|
| KS Atlas - Homepage | `https://ks-atlas.com/` | 5 min | 2 failures |
| KS Atlas - API Health | `https://kingshot-atlas.onrender.com/health` | 5 min | 2 failures |
| KS Atlas - Kingdoms API | `https://kingshot-atlas.onrender.com/api/kingdoms?page_size=1` | 5 min | 3 failures |

> ⚠️ **IMPORTANT:** The API URL is `kingshot-atlas.onrender.com` (NOT `kingshot-atlas-api`)

### Setup Instructions

1. **Create UptimeRobot Account**
   - Go to https://uptimerobot.com/
   - Sign up for free (50 monitors included)

2. **Add Monitors**
   ```
   Monitor Type: HTTP(s)
   Friendly Name: KS Atlas - Homepage
   URL: https://ks-atlas.com/
   Monitoring Interval: 5 minutes
   ```

3. **Configure Alerts**
   - Add email notification
   - Optional: Add Discord webhook for #alerts channel
   - Set alert threshold to 2 consecutive failures

4. **Status Page (Optional)**
   - Create public status page at: `status.ks-atlas.com`
   - Include all monitors
   - Share with community for transparency

### Discord Webhook Integration

```
Webhook URL: https://discord.com/api/webhooks/YOUR_WEBHOOK_ID
Alert Format: 
  - Down: "🔴 {monitorFriendlyName} is DOWN"
  - Up: "🟢 {monitorFriendlyName} is back UP"
```

---

## Error Tracking (Sentry)

### Setup Instructions

1. **Create Sentry Project**
   - Go to https://sentry.io/
   - Create new project: `kingshot-atlas-web` (React)
   - Create new project: `kingshot-atlas-api` (Python/FastAPI)

2. **Get DSN**
   - Project Settings → Client Keys (DSN)
   - Copy the DSN URL

3. **Configure Environment Variables**

   **Frontend (Netlify):**
   ```
   REACT_APP_SENTRY_DSN=https://xxx@sentry.io/xxx
   REACT_APP_ENVIRONMENT=production
   REACT_APP_VERSION=1.0.0
   ```

   **Backend (Railway/Render):**
   ```
   SENTRY_DSN=https://xxx@sentry.io/xxx
   ENVIRONMENT=production
   ```

4. **Configure Alerts**
   - Set up alert rules for:
     - New issues (first occurrence)
     - High-frequency issues (>10/hour)
     - Regression (issue reappears after resolution)

### Sentry Features Enabled

| Feature | Frontend | Backend |
|---------|----------|---------|
| Error Tracking | ✅ | ✅ |
| Performance Monitoring | ✅ (10% sample) | ✅ (10% sample) |
| Session Replay | ✅ (errors only) | N/A |
| Release Tracking | ✅ | ✅ |

### Ignored Errors (Frontend)

The following errors are filtered out to reduce noise:
- Browser extension errors
- Network failures (handled gracefully)
- User-initiated aborts

---

## Performance Monitoring

### Core Web Vitals Targets

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| LCP (Largest Contentful Paint) | < 2.5s | > 4s |
| FID (First Input Delay) | < 100ms | > 300ms |
| CLS (Cumulative Layout Shift) | < 0.1 | > 0.25 |
| INP (Interaction to Next Paint) | < 200ms | > 500ms |

### Lighthouse CI Thresholds

Configured in `apps/web/lighthouserc.js`:
- Performance: ≥ 80%
- Accessibility: ≥ 90%
- Best Practices: ≥ 90%
- SEO: ≥ 90%

---

## Alerting Channels

### Priority Levels

| Level | Response Time | Channel |
|-------|---------------|---------|
| P1 - Critical | < 15 min | SMS + Discord + Email |
| P2 - High | < 1 hour | Discord + Email |
| P3 - Medium | < 4 hours | Email |
| P4 - Low | Next business day | Email digest |

### Alert Routing

| Alert Type | Priority | Channel |
|------------|----------|---------|
| Site down | P1 | All |
| API down | P1 | All |
| Error spike (>50/min) | P2 | Discord + Email |
| New error type | P3 | Email |
| Performance degradation | P3 | Email |

---

## Runbook

### Site Down

1. Check UptimeRobot for details
2. Check Netlify deploy status
3. Check DNS resolution: `dig ks-atlas.com`
4. Check SSL certificate: `curl -I https://ks-atlas.com`
5. If Netlify issue, check status.netlify.com
6. Rollback to previous deploy if recent change caused issue

### API Down

1. Check Railway/Render dashboard
2. Check API logs for errors
3. Check database connectivity
4. Restart service if needed
5. Check for rate limiting or DDoS

### Error Spike

1. Check Sentry for error details
2. Identify affected users/pages
3. Check recent deployments
4. Rollback if deployment-related
5. Hotfix if code issue

---

## Maintenance Windows

- **Preferred:** Tuesday/Wednesday, 2-4 AM UTC
- **Avoid:** KvK Battle Phase (Saturday 10:00-22:00 UTC)
- **Notification:** Post in Discord #announcements 24h before

---

*Maintained by Ops Lead*
